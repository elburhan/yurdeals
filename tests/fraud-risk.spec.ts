import { expect, test } from '@playwright/test';
import {
  PaymentProvider,
  PaymentStatus,
  PrismaClient,
  ProductApprovalStatus,
  ProductStockType,
} from '@prisma/client';
import { getAdminOrder, updateAdminOrderRiskReview, updateAdminOrderStatus } from '../apps/backend/src/services/admin.service';
import { createOrderFromCart, createGuestOrderFromCart } from '../apps/backend/src/services/order.service';
import { initiatePayment } from '../apps/backend/src/services/payment.service';
import { handleOrderStatusTransition } from '../apps/backend/src/services/shipmentEvent.service';
import { evaluateAndPersistOrderRisk } from '../apps/backend/src/services/fraudRisk.service';
import { AppError } from '../apps/backend/src/middleware/errorHandler';

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('low-value customer order stays low risk and payment initiation remains available', async () => {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fixture = await createLowRiskCustomerFixture(uniqueSuffix);
  const originalFetch = globalThis.fetch;
  let orderId = '';

  try {
    let mockedCallbackUrl = '';
    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const body =
        typeof init?.body === 'string'
          ? (JSON.parse(init.body) as { callback_url?: string; reference?: string })
          : {};
      mockedCallbackUrl = body.callback_url ?? '';

      return new Response(
        JSON.stringify({
          status: true,
          message: 'Authorization URL created',
          data: {
            authorization_url: 'https://checkout.paystack.test/authorize/mock',
            reference: body.reference ?? `YD-TEST-MOCK-${uniqueSuffix}`,
            access_code: `ACCESS_${uniqueSuffix}`,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    };

    const created = await createOrderFromCart(
      fixture.customerUserId,
      { address_id: fixture.addressId, notes: 'Low-risk QA order' },
      {
        userId: fixture.customerUserId,
        ipAddress: fixture.ipAddress,
        userAgent: 'Playwright QA',
      },
    );
    orderId = created.order.id;

    expect(hasOwn(created.order, 'riskLevel')).toBeFalsy();
    expect(hasOwn(created.order, 'riskFlags')).toBeFalsy();
    expect(hasOwn(created.order, 'holdForManualReview')).toBeFalsy();

    const storedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        riskLevel: true,
        riskFlags: true,
        holdForManualReview: true,
      },
    });

    expect(storedOrder.riskLevel).toBe('LOW');
    expect(storedOrder.riskFlags).toEqual([]);
    expect(storedOrder.holdForManualReview).toBeFalsy();

    const payment = await initiatePayment(
      fixture.customerUserId,
      orderId,
      { provider: 'PAYSTACK' },
      { ipAddress: fixture.ipAddress },
    );

    expect(payment.authorizationUrl).toBe('https://checkout.paystack.test/authorize/mock');
    expect(mockedCallbackUrl).toContain('orderId=');
    expect(mockedCallbackUrl).toContain('paymentId=');
    expect(mockedCallbackUrl).toContain('reference=');

    const afterPaymentInit = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        riskLevel: true,
        riskFlags: true,
        holdForManualReview: true,
      },
    });

    expect(afterPaymentInit.riskLevel).toBe('LOW');
    expect(afterPaymentInit.riskFlags).toEqual([]);
    expect(afterPaymentInit.holdForManualReview).toBeFalsy();

    await prisma.payment.createMany({
      data: [
        {
          orderId,
          provider: PaymentProvider.PAYSTACK,
          status: PaymentStatus.FAILED,
          reference: `YD-RISK-FAILED-A-${uniqueSuffix}`.slice(0, 64),
          providerRef: `YD-RISK-FAILED-A-${uniqueSuffix}`.slice(0, 64),
          customerEmail: fixture.customerEmail,
          amount: '1500.00',
          currency: 'NGN',
        },
        {
          orderId,
          provider: PaymentProvider.PAYSTACK,
          status: PaymentStatus.ABANDONED,
          reference: `YD-RISK-FAILED-B-${uniqueSuffix}`.slice(0, 64),
          providerRef: `YD-RISK-FAILED-B-${uniqueSuffix}`.slice(0, 64),
          customerEmail: fixture.customerEmail,
          amount: '1500.00',
          currency: 'NGN',
        },
      ],
    });

    const elevatedRisk = await evaluateAndPersistOrderRisk({
      orderId,
      ipAddress: fixture.ipAddress,
      stage: 'PAYMENT_FAILED',
    });

    expect(elevatedRisk).not.toBeNull();
    expect(elevatedRisk?.riskLevel).toBe('MEDIUM');
    expect(elevatedRisk?.riskFlags).toContain('MULTIPLE_FAILED_PAYMENT_ATTEMPTS');
    expect(elevatedRisk?.holdForManualReview).toBeFalsy();
  } finally {
    globalThis.fetch = originalFetch;
    await cleanupTestData({
      orderIds: orderId ? [orderId] : [],
      userIds: [fixture.customerUserId],
      addressIds: [fixture.addressId],
      cartIds: [fixture.cartId],
      productIds: [fixture.productId],
      variantIds: [fixture.variantId],
      categoryIds: [fixture.categoryId],
    });
  }
});

test('high-risk guest order is flagged, held for review, and can be cleared by admin', async () => {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fixture = await createHighRiskGuestFixture(uniqueSuffix);
  let orderId = '';
  let guestUserId = '';

  try {
    const created = await createGuestOrderFromCart(
      {
        guest: {
          full_name: 'Risky Guest Customer',
          phone: '+2348012345678',
          email: `risk-${uniqueSuffix}@mailinator.com`,
          state: 'Lagos',
          lga: 'Ikeja',
          city: 'Ikeja',
          area: 'Computer Village District',
          street: '12 Olaide Street',
          landmark: 'Opposite the large electronics plaza',
          preferred_contact_method: 'WHATSAPP',
        },
        items: [
          {
            product_id: fixture.productId,
            quantity: 6,
          },
        ],
        notes: 'Fraud risk QA guest order',
      },
      {
        ipAddress: fixture.ipAddress,
        userAgent: 'Playwright QA',
      },
    );
    orderId = created.order.id;

    const storedGuestOrder = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        userId: true,
        riskLevel: true,
        riskFlags: true,
        holdForManualReview: true,
      },
    });
    guestUserId = storedGuestOrder.userId;

    expect(hasOwn(created.order, 'riskLevel')).toBeFalsy();
    expect(storedGuestOrder.riskLevel).toBe('HIGH');
    expect(storedGuestOrder.holdForManualReview).toBeTruthy();
    expect(storedGuestOrder.riskFlags).toContain('HIGH_VALUE_GUEST_ORDER');
    expect(storedGuestOrder.riskFlags).toContain('DISPOSABLE_EMAIL_DOMAIN');
    expect(storedGuestOrder.riskFlags).toContain('PREORDER_QUANTITY_SPIKE');

    await prisma.payment.createMany({
      data: [
        {
          orderId,
          provider: PaymentProvider.PAYSTACK,
          status: PaymentStatus.FAILED,
          reference: `YD-RISK-GUEST-A-${uniqueSuffix}`.slice(0, 64),
          providerRef: `YD-RISK-GUEST-A-${uniqueSuffix}`.slice(0, 64),
          customerEmail: `risk-${uniqueSuffix}@mailinator.com`,
          amount: '360000.00',
          currency: 'NGN',
        },
        {
          orderId,
          provider: PaymentProvider.PAYSTACK,
          status: PaymentStatus.ABANDONED,
          reference: `YD-RISK-GUEST-B-${uniqueSuffix}`.slice(0, 64),
          providerRef: `YD-RISK-GUEST-B-${uniqueSuffix}`.slice(0, 64),
          customerEmail: `risk-${uniqueSuffix}@mailinator.com`,
          amount: '360000.00',
          currency: 'NGN',
        },
      ],
    });

    const paymentFailureRisk = await evaluateAndPersistOrderRisk({
      orderId,
      ipAddress: fixture.ipAddress,
      stage: 'PAYMENT_FAILED',
    });

    expect(paymentFailureRisk?.riskFlags).toContain('MULTIPLE_FAILED_PAYMENT_ATTEMPTS');
    expect(paymentFailureRisk?.holdForManualReview).toBeTruthy();

    const shipmentEventCountBefore = await prisma.shipmentEvent.count({
      where: { shipment: { orderId } },
    });

    await expect(handleOrderStatusTransition(orderId, 'PAYMENT_CONFIRMED')).resolves.toBeUndefined();

    const shipmentEventCountAfter = await prisma.shipmentEvent.count({
      where: { shipment: { orderId } },
    });
    expect(shipmentEventCountAfter).toBe(shipmentEventCountBefore);

    await expect(
      updateAdminOrderStatus(orderId, 'PROCESSING', {
        userId: fixture.adminUserId,
        ipAddress: fixture.ipAddress,
        userAgent: 'Playwright QA',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'ORDER_ON_MANUAL_REVIEW',
    } satisfies Partial<AppError>);

    const reviewed = await updateAdminOrderRiskReview(
      orderId,
      {
        hold_for_manual_review: false,
        fraud_notes: 'Reviewed by QA and cleared for fulfillment',
        risk_level_override: 'MEDIUM',
      },
      {
        userId: fixture.adminUserId,
        ipAddress: fixture.ipAddress,
        userAgent: 'Playwright QA',
      },
    );

    expect(reviewed.order.holdForManualReview).toBeFalsy();
    expect(reviewed.order.riskLevel).toBe('MEDIUM');
    expect(reviewed.order.fraudNotes).toBe('Reviewed by QA and cleared for fulfillment');
    expect(reviewed.order.riskReviewedBy).toBe(fixture.adminUserId);
    expect(reviewed.order.riskReviewedByName).toContain('Admin');

    const advanced = await updateAdminOrderStatus(orderId, 'PROCESSING', {
      userId: fixture.adminUserId,
      ipAddress: fixture.ipAddress,
      userAgent: 'Playwright QA',
    });
    expect(advanced.order.status).toBe('PROCESSING');

    const adminView = await getAdminOrder(orderId);
    expect(adminView.order.riskLevel).toBe('MEDIUM');
    expect(adminView.order.riskFlags.length).toBeGreaterThan(0);
    expect(adminView.order.holdForManualReview).toBeFalsy();
    expect(adminView.order.fraudNotes).toBe('Reviewed by QA and cleared for fulfillment');

    const guestUserNotification = await prisma.notification.findFirst({
      where: {
        userId: guestUserId,
        type: 'ORDER_CREATED',
      },
      select: {
        id: true,
      },
    });
    expect(guestUserNotification).toBeTruthy();
  } finally {
    await cleanupTestData({
      orderIds: orderId ? [orderId] : [],
      userIds: [guestUserId, fixture.adminUserId].filter(Boolean),
      productIds: [fixture.productId],
      categoryIds: [fixture.categoryId],
    });
  }
});

async function createLowRiskCustomerFixture(uniqueSuffix: string): Promise<{
  categoryId: string;
  productId: string;
  variantId: string;
  customerUserId: string;
  customerEmail: string;
  addressId: string;
  cartId: string;
  ipAddress: string;
}> {
  const ipAddress = `198.51.100.${Math.floor(Math.random() * 100) + 1}`;
  const category = await prisma.category.create({
    data: {
      name: `Fraud QA Customer ${uniqueSuffix}`,
      slug: `fraud-qa-customer-${uniqueSuffix}`,
      description: 'Temporary category for fraud risk QA.',
      sortOrder: 998,
      isActive: true,
    },
    select: { id: true },
  });

  const product = await prisma.product.create({
    data: {
      name: `Fraud QA Customer Product ${uniqueSuffix}`,
      slug: `fraud-qa-customer-product-${uniqueSuffix}`,
      description: 'Low-value product for fraud risk QA.',
      shortDesc: 'Low-value QA product',
      categoryId: category.id,
      basePrice: '1500.00',
      currency: 'NGN',
      stockType: ProductStockType.IN_STOCK,
      approvalStatus: ProductApprovalStatus.APPROVED,
      isPublished: true,
      isActive: true,
      sku: `YD-FR-QA-CUST-${uniqueSuffix}`.slice(0, 64),
    },
    select: { id: true },
  });

  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      name: 'Default',
      sku: `YD-FR-QA-CUST-${uniqueSuffix}-DEF`.slice(0, 64),
      price: '1500.00',
      stock: 12,
      attributes: {},
      isActive: true,
    },
    select: { id: true },
  });

  const user = await prisma.user.create({
    data: {
      email: `customer-${uniqueSuffix}@example.com`,
      passwordHash: 'test-password-hash',
      firstName: 'Low',
      lastName: 'Risk',
      phone: '+2348000000001',
      isVerified: true,
    },
    select: { id: true, email: true },
  });

  const address = await prisma.address.create({
    data: {
      userId: user.id,
      label: 'Home',
      firstName: 'Low',
      lastName: 'Risk',
      phone: '+2348000000001',
      street: '15 Adeola Odeku Street',
      city: 'Ikeja',
      state: 'Lagos',
      lga: 'Ikeja',
      area: 'Allen Avenue',
      landmark: 'Beside the banking hall',
      country: 'Nigeria',
      isDefault: true,
    },
    select: { id: true },
  });

  const cart = await prisma.cart.create({
    data: {
      userId: user.id,
      items: {
        create: [
          {
            productId: product.id,
            variantId: variant.id,
            quantity: 1,
            priceSnapshot: '1500.00',
            currency: 'NGN',
          },
        ],
      },
    },
    select: { id: true },
  });

  return {
    categoryId: category.id,
    productId: product.id,
    variantId: variant.id,
    customerUserId: user.id,
    customerEmail: user.email,
    addressId: address.id,
    cartId: cart.id,
    ipAddress,
  };
}

async function createHighRiskGuestFixture(uniqueSuffix: string): Promise<{
  categoryId: string;
  productId: string;
  adminUserId: string;
  ipAddress: string;
}> {
  const ipAddress = `203.0.113.${Math.floor(Math.random() * 100) + 1}`;
  const category = await prisma.category.create({
    data: {
      name: `Fraud QA Guest ${uniqueSuffix}`,
      slug: `fraud-qa-guest-${uniqueSuffix}`,
      description: 'Temporary guest fraud category.',
      sortOrder: 997,
      isActive: true,
    },
    select: { id: true },
  });

  const product = await prisma.product.create({
    data: {
      name: `Fraud QA Guest Product ${uniqueSuffix}`,
      slug: `fraud-qa-guest-product-${uniqueSuffix}`,
      description: 'High-risk guest preorder product.',
      shortDesc: 'High-risk guest preorder',
      categoryId: category.id,
      basePrice: '60000.00',
      currency: 'NGN',
      stockType: ProductStockType.PREORDER,
      approvalStatus: ProductApprovalStatus.APPROVED,
      isPublished: true,
      isActive: true,
      sku: `YD-FR-QA-GUEST-${uniqueSuffix}`.slice(0, 64),
      preorderSlotsTotal: 50,
      preorderSlotsRemaining: 50,
    },
    select: { id: true },
  });

  const admin = await prisma.user.create({
    data: {
      email: `admin-${uniqueSuffix}@example.com`,
      passwordHash: 'test-password-hash',
      firstName: 'Admin',
      lastName: 'Reviewer',
      phone: '+2348000000009',
      role: 'ADMIN',
      isVerified: true,
    },
    select: { id: true },
  });

  return {
    categoryId: category.id,
    productId: product.id,
    adminUserId: admin.id,
    ipAddress,
  };
}

async function cleanupTestData(input: {
  orderIds: string[];
  userIds?: string[];
  addressIds?: string[];
  cartIds?: string[];
  productIds?: string[];
  variantIds?: string[];
  categoryIds?: string[];
}): Promise<void> {
  if (input.orderIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: {
        entityId: { in: input.orderIds },
      },
    });
    await prisma.paymentEvent.deleteMany({
      where: { payment: { orderId: { in: input.orderIds } } },
    });
    await prisma.payment.deleteMany({ where: { orderId: { in: input.orderIds } } });
    await prisma.inventoryReservation.deleteMany({
      where: { orderItem: { orderId: { in: input.orderIds } } },
    });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: input.orderIds } } });
    await prisma.shipmentEvent.deleteMany({
      where: { shipment: { orderId: { in: input.orderIds } } },
    });
    await prisma.shipment.deleteMany({ where: { orderId: { in: input.orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: input.orderIds } } });
  }

  if (input.cartIds?.length) {
    await prisma.cartItem.deleteMany({ where: { cartId: { in: input.cartIds } } });
    await prisma.cart.deleteMany({ where: { id: { in: input.cartIds } } });
  }

  if (input.addressIds?.length) {
    await prisma.address.deleteMany({ where: { id: { in: input.addressIds } } });
  }

  if (input.userIds?.length) {
    await prisma.notification.deleteMany({ where: { userId: { in: input.userIds } } });
    await prisma.address.deleteMany({ where: { userId: { in: input.userIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: input.userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: input.userIds } } });
  }

  if (input.variantIds?.length) {
    await prisma.productVariant.deleteMany({ where: { id: { in: input.variantIds } } });
  }

  if (input.productIds?.length) {
    await prisma.productImage.deleteMany({ where: { productId: { in: input.productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: input.productIds } } });
  }

  if (input.categoryIds?.length) {
    await prisma.category.deleteMany({ where: { id: { in: input.categoryIds } } });
  }
}

function hasOwn(target: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}
