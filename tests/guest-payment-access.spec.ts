import { expect, test } from '@playwright/test';
import {
  PaymentProvider,
  PaymentStatus,
  PrismaClient,
  ProductApprovalStatus,
  ProductStockType,
} from '@prisma/client';
import { initiateGuestPayment } from '../apps/backend/src/services/payment.service';

const BACKEND_BASE_URL = process.env.PLAYWRIGHT_BACKEND_URL ?? 'http://localhost:4000/api/v1';

const prisma = new PrismaClient();

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

interface GuestOrderResponse {
  order: {
    id: string;
    orderNumber: string;
  };
  guestAccessToken?: string;
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('guest order access uses hashed token storage and still authorizes guest payment access', async ({
  request,
}) => {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sharedEmail = `user-${uniqueSuffix}@example.com`;
  const fixture = await createCheckoutFixture(uniqueSuffix);
  let orderId = '';
  let guestUserId = '';
  let registeredUserId = '';
  const originalFetch = globalThis.fetch;
  let mockedCallbackUrl = '';

  try {
    const registeredUser = await prisma.user.create({
      data: {
        email: sharedEmail,
        passwordHash: 'test-password-hash',
        firstName: 'Registered',
        lastName: 'Customer',
        phone: '+2348099999999',
        isVerified: true,
      },
      select: { id: true },
    });
    registeredUserId = registeredUser.id;

    const guestOrderResponse = await request.post(`${BACKEND_BASE_URL}/orders/guest`, {
      data: {
        guest: {
          full_name: 'Yurdeals Guest Tester',
          phone: '+2348012345678',
          email: sharedEmail,
          state: 'Lagos',
          city: 'Ikeja',
          area: 'Computer Village',
          preferred_contact_method: 'WHATSAPP',
        },
        items: [
          {
            product_id: fixture.productId,
            variant_id: fixture.variantId,
            quantity: 1,
          },
        ],
        notes: 'Guest payment access smoke test',
      },
    });

    expect(guestOrderResponse.ok()).toBeTruthy();
    const guestOrderBody = (await guestOrderResponse.json()) as ApiEnvelope<GuestOrderResponse>;
    const guestAccessToken = guestOrderBody.data.guestAccessToken;
    orderId = guestOrderBody.data.order.id;

    expect(orderId).toBeTruthy();
    expect(guestAccessToken).toBeTruthy();

    const orderRecord = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        notes: true,
        guestAccessTokenHash: true,
        guestAccessTokenExpiresAt: true,
      },
    });
    guestUserId = orderRecord.userId;

    expect(orderRecord.userId).not.toBe(registeredUserId);
    expect(orderRecord.guestAccessTokenHash).toBeTruthy();
    expect(orderRecord.guestAccessTokenHash).toContain('hmac-sha256:');
    expect(orderRecord.guestAccessTokenExpiresAt).toBeInstanceOf(Date);
    expect(orderRecord.notes ?? '').not.toContain('[guestAccessToken:');
    expect(orderRecord.notes ?? '').not.toContain(guestAccessToken);
    expect(orderRecord.notes ?? '').toContain(`[guestEmail:${sharedEmail}]`);

    const registeredUserAddresses = await prisma.address.count({
      where: { userId: registeredUserId },
    });
    expect(registeredUserAddresses).toBe(0);

    const registeredUserOrders = await prisma.order.count({
      where: { userId: registeredUserId },
    });
    expect(registeredUserOrders).toBe(0);

    const registeredUserNotifications = await prisma.notification.count({
      where: { userId: registeredUserId },
    });
    expect(registeredUserNotifications).toBe(0);

    const failedPayment = await prisma.payment.create({
      data: {
        orderId,
        provider: PaymentProvider.PAYSTACK,
        status: PaymentStatus.FAILED,
        reference: `YD-TEST-FAILED-${uniqueSuffix}`.slice(0, 64),
        providerRef: `YD-TEST-FAILED-${uniqueSuffix}`.slice(0, 64),
        customerEmail: sharedEmail,
        amount: '1500.00',
        currency: 'NGN',
      },
      select: { id: true },
    });

    const validStatusResponse = await request.get(
      `${BACKEND_BASE_URL}/orders/${orderId}/payments/${failedPayment.id}/guest`,
      {
        params: {
          guest_access_token: guestAccessToken ?? '',
        },
      },
    );
    expect(validStatusResponse.ok()).toBeTruthy();

    const wrongTokenResponse = await request.get(
      `${BACKEND_BASE_URL}/orders/${orderId}/payments/${failedPayment.id}/guest`,
      {
        params: {
          guest_access_token: `wrong-${uniqueSuffix}`.padEnd(24, 'x'),
        },
      },
    );
    expect(wrongTokenResponse.ok()).toBeFalsy();
    expect(wrongTokenResponse.status()).toBe(404);

    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const body =
        typeof init?.body === 'string'
          ? JSON.parse(init.body) as { callback_url?: string; reference?: string }
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

    const initiatedPayment = await initiateGuestPayment(orderId, {
      provider: 'PAYSTACK',
      guest_access_token: guestAccessToken ?? '',
    });

    expect(initiatedPayment.authorizationUrl).toBe('https://checkout.paystack.test/authorize/mock');
    expect(initiatedPayment.reference).toBeTruthy();
    expect(mockedCallbackUrl).toContain('orderId=');
    expect(mockedCallbackUrl).toContain('paymentId=');
    expect(mockedCallbackUrl).toContain('reference=');
    expect(mockedCallbackUrl).not.toContain('guestAccessToken');
    expect(mockedCallbackUrl).not.toContain(guestAccessToken);

    const trackingResponse = await request.get(`${BACKEND_BASE_URL}/orders/track`, {
      params: {
        phone: '+2348012345678',
        orderNumber: guestOrderBody.data.order.orderNumber,
      },
    });
    expect(trackingResponse.ok()).toBeTruthy();
    const trackingBody = (await trackingResponse.json()) as ApiEnvelope<{
      orderNumber: string;
      status: string;
      paymentStatus: string | null;
      shipmentStatus: string | null;
      eta: string | null;
      itemCount: number;
      itemSummary: string[];
      tracking: {
        currentStatus: string;
        eta: string | null;
        timeline: Array<{ status: string; label: string }>;
      };
    }>;
    expect(trackingBody.data.orderNumber).toBe(guestOrderBody.data.order.orderNumber);
    expect(trackingBody.data.itemCount).toBe(1);
    expect(trackingBody.data.itemSummary).toEqual(['1 x Guest Payment QA Product ' + uniqueSuffix]);
    expect(trackingBody.data.tracking.currentStatus).toBeTruthy();
    expect(trackingBody.data).not.toHaveProperty('id');
    expect(trackingBody.data).not.toHaveProperty('total');
    expect(trackingBody.data).not.toHaveProperty('paymentReference');
    expect(trackingBody.data).not.toHaveProperty('shippingAddress');

    const phoneOnlyTrackingResponse = await request.get(`${BACKEND_BASE_URL}/orders/track`, {
      params: {
        phone: '+2348012345678',
      },
    });
    expect(phoneOnlyTrackingResponse.ok()).toBeFalsy();
    expect(phoneOnlyTrackingResponse.status()).toBe(422);
    const phoneOnlyTrackingBody = (await phoneOnlyTrackingResponse.json()) as {
      success: false;
      error?: {
        code?: string;
        message?: string;
        details?: Array<{ field: string; message: string }>;
      };
    };
    expect(phoneOnlyTrackingBody.error?.code).toBe('VALIDATION_ERROR');
    expect(
      phoneOnlyTrackingBody.error?.details?.some(
        (detail) => detail.field === 'orderNumber' && detail.message.length > 0,
      ),
    ).toBeTruthy();

    const storedInitiatedPayment = await prisma.payment.findUniqueOrThrow({
      where: { id: initiatedPayment.payment.id },
      select: {
        status: true,
        authorizationUrl: true,
        accessCode: true,
      },
    });

    expect(storedInitiatedPayment.status).toBe(PaymentStatus.PENDING);
    expect(storedInitiatedPayment.authorizationUrl).toBe(
      'https://checkout.paystack.test/authorize/mock',
    );
    expect(storedInitiatedPayment.accessCode).toBe(`ACCESS_${uniqueSuffix}`);
  } finally {
    globalThis.fetch = originalFetch;
    await cleanupFixture({
      orderId,
      guestUserId,
      registeredUserId,
      ...fixture,
    });
  }
});

async function createCheckoutFixture(uniqueSuffix: string): Promise<{
  categoryId: string;
  productId: string;
  variantId: string;
}> {
  const category = await prisma.category.create({
    data: {
      name: `Guest Payment QA ${uniqueSuffix}`,
      slug: `guest-payment-qa-${uniqueSuffix}`,
      description: 'Temporary category for guest payment access smoke testing.',
      sortOrder: 999,
      isActive: true,
    },
    select: { id: true },
  });

  const product = await prisma.product.create({
    data: {
      name: `Guest Payment QA Product ${uniqueSuffix}`,
      slug: `guest-payment-qa-product-${uniqueSuffix}`,
      description: 'Temporary product for guest payment access smoke testing.',
      shortDesc: 'Guest payment QA product.',
      categoryId: category.id,
      basePrice: '1500.00',
      currency: 'NGN',
      stockType: ProductStockType.IN_STOCK,
      approvalStatus: ProductApprovalStatus.APPROVED,
      isPublished: true,
      isActive: true,
      sku: `YD-GPQA-${uniqueSuffix}`.slice(0, 64),
    },
    select: { id: true },
  });

  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      name: 'Default',
      sku: `YD-GPQA-${uniqueSuffix}-DEFAULT`.slice(0, 64),
      price: '1500.00',
      stock: 10,
      attributes: {},
      isActive: true,
    },
    select: { id: true },
  });

  return {
    categoryId: category.id,
    productId: product.id,
    variantId: variant.id,
  };
}

async function cleanupFixture(input: {
  orderId: string;
  guestUserId: string;
  registeredUserId: string;
  categoryId: string;
  productId: string;
  variantId: string;
}): Promise<void> {
  if (input.orderId) {
    await prisma.paymentEvent.deleteMany({
      where: { payment: { orderId: input.orderId } },
    });
    await prisma.payment.deleteMany({ where: { orderId: input.orderId } });
    await prisma.orderItem.deleteMany({ where: { orderId: input.orderId } });
    await prisma.shipmentEvent.deleteMany({
      where: { shipment: { orderId: input.orderId } },
    });
    await prisma.shipment.deleteMany({ where: { orderId: input.orderId } });
    await prisma.order.deleteMany({ where: { id: input.orderId } });
  }

  if (input.guestUserId) {
    await prisma.notification.deleteMany({ where: { userId: input.guestUserId } });
    await prisma.address.deleteMany({ where: { userId: input.guestUserId } });
    await prisma.user.deleteMany({ where: { id: input.guestUserId } });
  }

  if (input.registeredUserId) {
    await prisma.notification.deleteMany({ where: { userId: input.registeredUserId } });
    await prisma.address.deleteMany({ where: { userId: input.registeredUserId } });
    await prisma.user.deleteMany({ where: { id: input.registeredUserId } });
  }

  await prisma.productVariant.deleteMany({ where: { id: input.variantId } });
  await prisma.productImage.deleteMany({ where: { productId: input.productId } });
  await prisma.product.deleteMany({ where: { id: input.productId } });
  await prisma.category.deleteMany({ where: { id: input.categoryId } });
}
