// ============================================
// Order Repository
// ============================================

import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductApprovalStatus,
  ProductStockType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { OrderCreationData, OrderItemSummary, OrderSummary, PaymentSummary } from '@yurdeals/shared';
import { prisma } from '../config';
import { AppError } from '../middleware/errorHandler';
import { CreateGuestOrderInput, CreateOrderInput } from '../schemas/order.schema';
import {
  generateGuestAccessToken,
  getGuestAccessTokenExpiry,
  hashGuestAccessToken,
} from '../services/guestOrderAccess.service';
import { releaseOrderInventoryReservations } from '../services/inventoryReservation.service';
import { assertProductAvailabilityForQuantity } from '../utils/productAvailability';

export const WHATSAPP_CHECKOUT_NOTE_TAG = '[checkoutMethod:WHATSAPP]';
export const GUEST_CUSTOMER_NOTE_TAG = '[customerType:GUEST]';

const ADDRESS_SELECT = {
  id: true,
  label: true,
  firstName: true,
  lastName: true,
  phone: true,
  street: true,
  city: true,
  state: true,
  country: true,
  postalCode: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AddressSelect;

const ORDER_ITEM_SELECT = {
  id: true,
  productId: true,
  variantId: true,
  name: true,
  price: true,
  quantity: true,
  total: true,
  stockTypeSnapshot: true,
  inspectionRequired: true,
} satisfies Prisma.OrderItemSelect;

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  inspectionStatus: true,
  paymentReference: true,
  subtotal: true,
  shippingFee: true,
  tax: true,
  discount: true,
  total: true,
  currency: true,
  trackingNumber: true,
  trackingCarrier: true,
  trackingUrl: true,
  paidAt: true,
  shippedAt: true,
  deliveredAt: true,
  createdAt: true,
  updatedAt: true,
  shippingAddress: {
    select: ADDRESS_SELECT,
  },
  items: {
    select: ORDER_ITEM_SELECT,
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.OrderSelect;

const ORDER_WITH_USER_AND_PAYMENTS_SELECT = {
  ...ORDER_SELECT,
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  },
  payments: {
    select: {
      id: true,
      orderId: true,
      provider: true,
      status: true,
      reference: true,
      providerRef: true,
      providerTransactionId: true,
      authorizationUrl: true,
      accessCode: true,
      customerEmail: true,
      amount: true,
      amountCaptured: true,
      amountRefunded: true,
      fees: true,
      currency: true,
      channel: true,
      gatewayResponse: true,
      paidAt: true,
      verifiedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.OrderSelect;

const ORDER_EVENT_SELECT = {
  id: true,
  orderNumber: true,
  userId: true,
  status: true,
} satisfies Prisma.OrderSelect;

const ORDER_TRACKING_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  createdAt: true,
  payments: {
    where: {
      status: { in: [PaymentStatus.SUCCESS, PaymentStatus.FAILED, PaymentStatus.AUTHORIZED] },
    },
    select: {
      status: true,
      paidAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'asc' },
  },
  shipments: {
    select: {
      estimatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
    take: 1,
  },
} satisfies Prisma.OrderSelect;

const PUBLIC_TRACKING_LOOKUP_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  createdAt: true,
  payments: {
    where: {
      status: { in: [PaymentStatus.SUCCESS, PaymentStatus.FAILED, PaymentStatus.AUTHORIZED] },
    },
    select: {
      status: true,
      paidAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'asc' },
  },
  shipments: {
    select: {
      estimatedAt: true,
      status: true,
    },
    orderBy: { createdAt: 'asc' },
    take: 1,
  },
  items: {
    select: {
      name: true,
      quantity: true,
    },
    orderBy: { id: 'asc' },
  },
  shippingAddress: {
    select: {
      phone: true,
    },
  },
} satisfies Prisma.OrderSelect;

type OrderRecord = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>;
type OrderWithUserAndPaymentsRecord = Prisma.OrderGetPayload<{
  select: typeof ORDER_WITH_USER_AND_PAYMENTS_SELECT;
}>;
type OrderEventRecord = Prisma.OrderGetPayload<{ select: typeof ORDER_EVENT_SELECT }>;
type OrderTrackingRecord = Prisma.OrderGetPayload<{ select: typeof ORDER_TRACKING_SELECT }>;
type PublicTrackingLookupRecord = Prisma.OrderGetPayload<{
  select: typeof PUBLIC_TRACKING_LOOKUP_SELECT;
}>;
interface CartCheckoutItem {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  priceSnapshot: Prisma.Decimal;
  currency: string;
  product: {
    id: string;
    name: string;
    isActive: boolean;
    isPublished: boolean;
    approvalStatus: ProductApprovalStatus;
    stockType: ProductStockType;
    inventoryQuantity: number | null;
    preorderSlotsRemaining: number | null;
    preorderStartsAt: Date | null;
    preorderEndsAt: Date | null;
    category: { isActive: boolean };
  };
  variant: {
    id: string;
    stock: number;
    isActive: boolean;
  } | null;
}

export type { OrderEventRecord, OrderTrackingRecord, PublicTrackingLookupRecord };

export class OrderRepository {
  async findUserOrders(
    userId: string,
    query: { page: number; limit: number },
  ): Promise<{ orders: OrderSummary[]; total: number }> {
    const skip = (query.page - 1) * query.limit;

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where: { userId, status: { not: OrderStatus.CANCELLED } },
        select: ORDER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      prisma.order.count({ where: { userId, status: { not: OrderStatus.CANCELLED } } }),
    ]);

    return {
      orders: orders.map(mapOrder),
      total,
    };
  }

  async findUserOrder(userId: string, orderId: string): Promise<OrderSummary | null> {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      select: ORDER_SELECT,
    });

    return order ? mapOrder(order) : null;
  }

  async cancelPendingOrder(userId: string, orderId: string): Promise<OrderSummary> {
    const order = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findFirst({
        where: { id: orderId, userId },
        select: {
          id: true,
          status: true,
          payments: {
            select: { id: true, provider: true, status: true },
          },
        },
      });

      if (!existingOrder) {
        throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      }

      if (
        existingOrder.payments.some(
          (payment) =>
            payment.status === PaymentStatus.SUCCESS ||
            payment.status === PaymentStatus.AUTHORIZED,
        )
      ) {
        throw new AppError(
          'Paid orders cannot be cancelled from your account. Please contact support if you need help.',
          409,
          'ORDER_ALREADY_PAID',
        );
      }

      if (existingOrder.status !== OrderStatus.PENDING) {
        throw new AppError(
          'Only pending orders can be cancelled. Orders already in processing or shipping cannot be cancelled here.',
          409,
          'ORDER_NOT_CANCELLABLE',
        );
      }

      await tx.payment.updateMany({
        where: {
          orderId,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED] },
        },
        data: { status: PaymentStatus.ABANDONED },
      });

      const auditPayment = existingOrder.payments.find(
        (payment) =>
          payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.AUTHORIZED,
      );
      if (auditPayment) {
        await releaseOrderInventoryReservations(tx, orderId, {
          reason: 'ORDER_CANCELLED',
          payment: {
            paymentId: auditPayment.id,
            provider: auditPayment.provider,
          },
        });
      } else {
        await releaseOrderInventoryReservations(tx, orderId, {
          reason: 'ORDER_CANCELLED',
        });
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: 'Cancelled by customer',
        },
        select: ORDER_SELECT,
      });
    });

    return mapOrder(order);
  }

  async markWhatsappCheckout(userId: string, orderId: string): Promise<OrderSummary> {
    return this.markWhatsappCheckoutInternal({
      where: { id: orderId, userId },
    });
  }

  async markGuestWhatsappCheckout(orderId: string): Promise<OrderSummary> {
    return this.markWhatsappCheckoutInternal({
      where: { id: orderId },
    });
  }

  async createFromCart(userId: string, input: CreateOrderInput): Promise<OrderCreationData> {
    const order = await prisma.$transaction(async (tx) => {
      const address = await tx.address.findFirst({
        where: { id: input.address_id, userId },
        select: { id: true },
      });

      if (!address) {
        throw new AppError('Address not found', 404, 'ADDRESS_NOT_FOUND');
      }

      const cart = await tx.cart.findUnique({
        where: { userId },
        select: {
          id: true,
          items: {
            select: {
              id: true,
              productId: true,
              variantId: true,
              quantity: true,
              priceSnapshot: true,
              currency: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  isActive: true,
                  isPublished: true,
                  approvalStatus: true,
                  stockType: true,
                  inventoryQuantity: true,
                  preorderSlotsRemaining: true,
                  preorderStartsAt: true,
                  preorderEndsAt: true,
                  category: {
                    select: { isActive: true },
                  },
                },
              },
              variant: {
                select: {
                  id: true,
                  stock: true,
                  isActive: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        throw new AppError('Cart is empty', 422, 'EMPTY_CART');
      }

      validateCartCheckoutItems(cart.items);

      const totals = calculateTotals(cart.items);
      const orderNumber = await getNextOrderNumber(tx);

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          status: OrderStatus.PENDING,
          stockTypeSnapshot: deriveOrderStockSnapshot(cart.items),
          subtotal: totals.subtotal,
          shippingFee: totals.shippingFee,
          tax: totals.tax,
          discount: totals.discount,
          total: totals.total,
          currency: totals.currency,
          shippingAddressId: address.id,
          billingAddressId: address.id,
          notes: input.notes,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              name: item.product.name,
              price: item.priceSnapshot,
              quantity: item.quantity,
              total: item.priceSnapshot.mul(item.quantity),
              stockTypeSnapshot: item.product.stockType,
              inspectionRequired: item.product.stockType === ProductStockType.PREORDER,
            })),
          },
        },
        select: ORDER_SELECT,
      });

      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return createdOrder;
    });

    return { order: mapOrder(order) };
  }

  async createGuestOrder(input: CreateGuestOrderInput): Promise<OrderCreationData> {
    const guestAccessToken = generateGuestAccessToken();
    const { firstName, lastName } = splitFullName(input.guest.full_name);
    const guestStreet = buildGuestStreet(input.guest);

    const order = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: {
          id: { in: input.items.map((item) => item.product_id) },
          isActive: true,
          isPublished: true,
          approvalStatus: ProductApprovalStatus.APPROVED,
          category: { isActive: true },
        },
        select: {
          id: true,
          name: true,
          basePrice: true,
          currency: true,
          stockType: true,
          inventoryQuantity: true,
          preorderSlotsRemaining: true,
          preorderStartsAt: true,
          preorderEndsAt: true,
          variants: {
            where: { isActive: true },
            select: {
              id: true,
              price: true,
              stock: true,
              isActive: true,
            },
          },
        },
      });
      const productById = new Map(products.map((product) => [product.id, product]));

      const orderItems = input.items.map((item) => {
        const product = productById.get(item.product_id);
        if (!product) {
          throw new AppError('Product not found or inactive', 404, 'PRODUCT_NOT_FOUND');
        }

        const variant = item.variant_id
          ? product.variants.find((candidate) => candidate.id === item.variant_id)
          : null;

        if (item.variant_id && !variant) {
          throw new AppError('Variant not found or inactive', 404, 'VARIANT_NOT_FOUND');
        }

        if (product.stockType === ProductStockType.IN_STOCK) {
          if (product.variants.length > 0 && !variant) {
            throw new AppError('Select a product variant before checkout', 422, 'VARIANT_REQUIRED');
          }

          if (variant && item.quantity > variant.stock) {
            throw new AppError('Requested quantity exceeds available stock', 409, 'INSUFFICIENT_STOCK');
          }
        }

        assertProductAvailabilityForQuantity({
          product,
          quantity: item.quantity,
          variant,
        });

        const price = variant?.price ?? product.basePrice;
        return {
          productId: product.id,
          variantId: variant?.id ?? null,
          name: product.name,
          price,
          quantity: item.quantity,
          total: price.mul(item.quantity),
          currency: product.currency,
          stockTypeSnapshot: product.stockType,
          inspectionRequired: product.stockType === ProductStockType.PREORDER,
        };
      });

      const totals = calculateGuestTotals(orderItems);

      const user = await tx.user.create({
        data: {
          // Guest checkouts always get an isolated shadow user so public checkout data
          // cannot attach orders or addresses to an existing registered account.
          email: createInternalGuestEmail(),
          passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
          firstName,
          lastName,
          phone: normalizePhone(input.guest.phone),
          isVerified: false,
        },
        select: { id: true },
      });

      const address = await tx.address.create({
        data: {
          userId: user.id,
          label: 'Guest checkout',
          firstName,
          lastName,
          phone: normalizePhone(input.guest.phone),
          street: guestStreet,
          city: input.guest.city,
          state: input.guest.state,
          country: 'Nigeria',
          isDefault: true,
        },
        select: { id: true },
      });
      const orderNumber = await getNextOrderNumber(tx);

      return tx.order.create({
        data: {
          orderNumber,
          userId: user.id,
          status: OrderStatus.PENDING,
          stockTypeSnapshot: deriveOrderStockSnapshot(orderItems),
          subtotal: totals.subtotal,
          shippingFee: totals.shippingFee,
          tax: totals.tax,
          discount: totals.discount,
          total: totals.total,
          currency: totals.currency,
          shippingAddressId: address.id,
          billingAddressId: address.id,
          guestAccessTokenHash: hashGuestAccessToken(guestAccessToken),
          guestAccessTokenExpiresAt: getGuestAccessTokenExpiry(),
          notes: buildGuestOrderNotes(input),
          items: {
            create: orderItems.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              total: item.total,
              stockTypeSnapshot: item.stockTypeSnapshot,
              inspectionRequired: item.inspectionRequired,
            })),
          },
        },
        select: ORDER_SELECT,
      });
    });

    return { order: mapOrder(order), guestAccessToken };
  }

  async findOrderForEvents(orderId: string): Promise<OrderEventRecord | null> {
    return prisma.order.findUnique({
      where: { id: orderId },
      select: ORDER_EVENT_SELECT,
    });
  }

  async findOrderTrackingBase(
    userId: string,
    orderId: string,
  ): Promise<OrderTrackingRecord | null> {
    return prisma.order.findFirst({
      where: { id: orderId, userId },
      select: ORDER_TRACKING_SELECT,
    });
  }

  async findPublicTrackingOrder(
    normalizedPhone: string,
    orderNumber: string,
  ): Promise<PublicTrackingLookupRecord | null> {
    const phoneVariants = createPhoneVariants(normalizedPhone);

    return prisma.order.findFirst({
      where: {
        orderNumber: {
          equals: orderNumber.trim(),
          mode: 'insensitive',
        },
        OR: [
          { shippingAddress: { is: { phone: { in: phoneVariants } } } },
          {
            user: {
              is: {
                phone: { in: phoneVariants },
              },
            },
          },
        ],
      },
      select: PUBLIC_TRACKING_LOOKUP_SELECT,
    });
  }

  private async markWhatsappCheckoutInternal(input: {
    where:
      | { id: string; userId: string }
      | { id: string };
  }): Promise<OrderSummary> {
    const order = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findFirst({
        where: input.where,
        select: { id: true, status: true, notes: true },
      });

      if (!existingOrder) {
        throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      }

      if (existingOrder.status !== OrderStatus.PENDING) {
        throw new AppError('Only pending orders can be completed via WhatsApp', 409, 'ORDER_NOT_PENDING');
      }

      const notes = existingOrder.notes ?? '';
      const nextNotes = notes.includes(WHATSAPP_CHECKOUT_NOTE_TAG)
        ? notes
        : [WHATSAPP_CHECKOUT_NOTE_TAG, notes].filter(Boolean).join('\n').slice(0, 500);

      return tx.order.update({
        where: { id: existingOrder.id },
        data: { notes: nextNotes },
        select: ORDER_SELECT,
      });
    });

    return mapOrder(order);
  }
}

function validateCartCheckoutItems(items: CartCheckoutItem[]): void {
  for (const item of items) {
    if (
      !item.product.isActive ||
      !item.product.isPublished ||
      item.product.approvalStatus !== ProductApprovalStatus.APPROVED ||
      !item.product.category.isActive
    ) {
      throw new AppError(
        `Product "${item.product.name}" is no longer available`,
        409,
        'PRODUCT_UNAVAILABLE',
      );
    }

    if (item.product.stockType === ProductStockType.IN_STOCK && item.variant) {
      if (!item.variant.isActive || item.quantity > item.variant.stock) {
        throw new AppError(
          `Insufficient stock for "${item.product.name}"`,
          409,
          'INSUFFICIENT_STOCK',
        );
      }
    }

    assertProductAvailabilityForQuantity({
      product: item.product,
      quantity: item.quantity,
      variant: item.variant,
    });
  }
}

function calculateTotals(items: Pick<CartCheckoutItem, 'priceSnapshot' | 'quantity' | 'currency'>[]) {
  const currency = items[0]?.currency ?? 'NGN';
  const subtotal = items.reduce(
    (total, item) => total.add(item.priceSnapshot.mul(item.quantity)),
    new Prisma.Decimal(0),
  );
  const shippingFee = new Prisma.Decimal(0);
  const tax = new Prisma.Decimal(0);
  const discount = new Prisma.Decimal(0);
  const total = subtotal.add(shippingFee).add(tax).sub(discount);

  return { subtotal, shippingFee, tax, discount, total, currency };
}

function calculateGuestTotals(
  items: Array<{ total: Prisma.Decimal; currency: string }>,
) {
  const currency = items[0]?.currency ?? 'NGN';
  const subtotal = items.reduce((total, item) => total.add(item.total), new Prisma.Decimal(0));
  const shippingFee = new Prisma.Decimal(0);
  const tax = new Prisma.Decimal(0);
  const discount = new Prisma.Decimal(0);
  const total = subtotal.add(shippingFee).add(tax).sub(discount);

  return { subtotal, shippingFee, tax, discount, total, currency };
}

function deriveOrderStockSnapshot(
  items: Array<{ product?: { stockType: ProductStockType }; stockTypeSnapshot?: ProductStockType }>,
): ProductStockType {
  return items.some((item) => (item.stockTypeSnapshot ?? item.product?.stockType) === ProductStockType.PREORDER)
    ? ProductStockType.PREORDER
    : ProductStockType.IN_STOCK;
}

function buildGuestOrderNotes(input: CreateGuestOrderInput): string {
  return [
    GUEST_CUSTOMER_NOTE_TAG,
    `[preferredContact:${input.guest.preferred_contact_method}]`,
    input.guest.email ? `[guestEmail:${input.guest.email.toLowerCase()}]` : '',
    input.notes ? `Guest notes: ${input.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 500);
}

function buildGuestStreet(guest: CreateGuestOrderInput['guest']): string {
  return [guest.address_line, guest.area, guest.city, guest.state].filter(Boolean).join(', ');
}

function splitFullName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] ?? name.trim();
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName;

  return { firstName, lastName };
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

function createInternalGuestEmail(): string {
  return `guest+${crypto.randomUUID()}@internal.yurdeals.local`;
}

async function getNextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  // Order numbers are generated from a dedicated Postgres sequence so they stay
  // human-readable and concurrency-safe: YD1001, YD1002, ...
  const [result] = await tx.$queryRaw<Array<{ orderNumber: string }>>`
    SELECT CONCAT('YD', nextval('public.order_number_seq')::text) AS "orderNumber"
  `;

  if (!result?.orderNumber) {
    throw new AppError('Unable to generate order number', 500, 'ORDER_NUMBER_GENERATION_FAILED');
  }

  return result.orderNumber;
}

function createPhoneVariants(normalizedPhone: string): string[] {
  const digitsOnly = normalizedPhone.replace(/[^\d]/g, '');
  const localDigits = digitsOnly.startsWith('234') ? digitsOnly.slice(3) : digitsOnly;
  const localFormat = localDigits ? `0${localDigits}` : normalizedPhone;
  const international = digitsOnly.startsWith('234') ? `+${digitsOnly}` : normalizedPhone;
  const compactInternational = digitsOnly.startsWith('234') ? digitsOnly : `234${localDigits}`;

  return Array.from(new Set([normalizedPhone, international, compactInternational, localFormat]));
}

function mapOrder(order: OrderRecord): OrderSummary {
  const items = order.items.map(mapOrderItem);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    inspectionStatus: order.inspectionStatus,
    paymentReference: order.paymentReference,
    subtotal: Number(order.subtotal),
    shippingFee: Number(order.shippingFee),
    tax: Number(order.tax),
    discount: Number(order.discount),
    total: Number(order.total),
    currency: order.currency,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    shippingAddress: order.shippingAddress
      ? {
          id: order.shippingAddress.id,
          label: order.shippingAddress.label,
          firstName: order.shippingAddress.firstName,
          lastName: order.shippingAddress.lastName,
          phone: order.shippingAddress.phone,
          street: order.shippingAddress.street,
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          country: order.shippingAddress.country,
          postalCode: order.shippingAddress.postalCode,
          isDefault: order.shippingAddress.isDefault,
          createdAt: order.shippingAddress.createdAt.toISOString(),
          updatedAt: order.shippingAddress.updatedAt.toISOString(),
        }
      : null,
    trackingNumber: order.trackingNumber,
    trackingCarrier: order.trackingCarrier,
    trackingUrl: order.trackingUrl,
    paidAt: order.paidAt?.toISOString() ?? null,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    items,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

function mapOrderItem(item: OrderRecord['items'][number]): OrderItemSummary {
  return {
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    name: item.name,
    price: Number(item.price),
    quantity: item.quantity,
    total: Number(item.total),
    stockTypeSnapshot: item.stockTypeSnapshot,
    inspectionRequired: item.inspectionRequired,
  };
}

export function mapPayment(
  payment: Pick<
    OrderWithUserAndPaymentsRecord['payments'][number],
    | 'id'
    | 'orderId'
    | 'provider'
    | 'status'
    | 'reference'
    | 'providerRef'
    | 'providerTransactionId'
    | 'authorizationUrl'
    | 'accessCode'
    | 'customerEmail'
    | 'amount'
    | 'amountCaptured'
    | 'amountRefunded'
    | 'fees'
    | 'currency'
    | 'channel'
    | 'gatewayResponse'
    | 'paidAt'
    | 'verifiedAt'
    | 'createdAt'
    | 'updatedAt'
  >,
): PaymentSummary {
  return {
    id: payment.id,
    orderId: payment.orderId,
    provider: payment.provider,
    status: payment.status,
    reference: payment.reference,
    providerRef: payment.providerRef,
    providerTransactionId: payment.providerTransactionId,
    authorizationUrl: payment.authorizationUrl,
    accessCode: payment.accessCode,
    customerEmail: payment.customerEmail,
    amount: Number(payment.amount),
    amountCaptured: payment.amountCaptured ? Number(payment.amountCaptured) : null,
    amountRefunded: Number(payment.amountRefunded),
    fees: payment.fees ? Number(payment.fees) : null,
    currency: payment.currency,
    channel: payment.channel,
    gatewayResponse: payment.gatewayResponse,
    paidAt: payment.paidAt?.toISOString() ?? null,
    verifiedAt: payment.verifiedAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}

export const orderRepository = new OrderRepository();
