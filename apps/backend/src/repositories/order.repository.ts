// ============================================
// Order Repository
// ============================================

import { OrderStatus, PaymentStatus, Prisma, StockType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { OrderCreationData, OrderItemSummary, OrderSummary } from '@yurdeals/shared';
import { prisma } from '../config';
import { CreateGuestOrderInput, CreateOrderInput } from '../schemas/order.schema';
import { AppError } from '../middleware/errorHandler';

export const WHATSAPP_CHECKOUT_NOTE_TAG = '[checkoutMethod:WHATSAPP]';
export const GUEST_CUSTOMER_NOTE_TAG = '[customerType:GUEST]';
export const GUEST_ACCESS_TOKEN_PREFIX = '[guestAccessToken:';

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  subtotal: true,
  shippingFee: true,
  tax: true,
  discount: true,
  total: true,
  currency: true,
  createdAt: true,
  shippingAddress: {
    select: {
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
    },
  },
  items: {
    select: {
      id: true,
      productId: true,
      variantId: true,
      name: true,
      price: true,
      quantity: true,
      total: true,
    },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.OrderSelect;

type OrderRecord = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>;

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
      status: { in: [PaymentStatus.SUCCESS, PaymentStatus.FAILED] },
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

export type OrderEventRecord = Prisma.OrderGetPayload<{ select: typeof ORDER_EVENT_SELECT }>;
export type OrderTrackingRecord = Prisma.OrderGetPayload<{
  select: typeof ORDER_TRACKING_SELECT;
}>;

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
            select: { status: true },
          },
        },
      });

      if (!existingOrder) {
        throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      }

      if (existingOrder.status !== OrderStatus.PENDING) {
        throw new AppError('Only pending orders can be cancelled', 409, 'ORDER_NOT_CANCELLABLE');
      }

      if (existingOrder.payments.some((payment) => payment.status === PaymentStatus.SUCCESS)) {
        throw new AppError('Paid orders cannot be cancelled here', 409, 'ORDER_ALREADY_PAID');
      }

      await tx.payment.updateMany({
        where: {
          orderId,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
        },
        data: { status: PaymentStatus.FAILED },
      });

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
    const order = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findFirst({
        where: { id: orderId, userId },
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
        where: { id: orderId },
        data: { notes: nextNotes },
        select: ORDER_SELECT,
      });
    });

    return mapOrder(order);
  }

  async markGuestWhatsappCheckout(orderId: string, guestAccessToken: string): Promise<OrderSummary> {
    const order = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findFirst({
        where: {
          id: orderId,
          notes: { contains: createGuestTokenTag(guestAccessToken) },
        },
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
        where: { id: orderId },
        data: { notes: nextNotes },
        select: ORDER_SELECT,
      });
    });

    return mapOrder(order);
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
                  stockType: true,
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

      for (const item of cart.items) {
        if (!item.product.isActive || !item.product.category.isActive) {
          throw new AppError(
            `Product "${item.product.name}" is no longer available`,
            409,
            'PRODUCT_UNAVAILABLE',
          );
        }

        if (item.product.stockType === StockType.LOCAL && item.variant) {
          if (!item.variant.isActive || item.quantity > item.variant.stock) {
            throw new AppError(
              `Insufficient stock for "${item.product.name}"`,
              409,
              'INSUFFICIENT_STOCK',
            );
          }
        }
      }

      const currency = cart.items[0]?.currency ?? 'NGN';
      const subtotal = cart.items.reduce(
        (total, item) => total.add(item.priceSnapshot.mul(item.quantity)),
        new Prisma.Decimal(0),
      );
      const shippingFee = new Prisma.Decimal(0);
      const tax = new Prisma.Decimal(0);
      const discount = new Prisma.Decimal(0);
      const orderTotal = subtotal.add(shippingFee).add(tax).sub(discount);

      const createdOrder = await tx.order.create({
        data: {
          orderNumber: createOrderNumber(),
          userId,
          status: OrderStatus.PENDING,
          subtotal,
          shippingFee,
          tax,
          discount,
          total: orderTotal,
          currency,
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
    const guestAccessToken = crypto.randomBytes(24).toString('hex');
    const providedGuestEmail = input.guest.email?.toLowerCase();
    const { firstName, lastName } = splitFullName(input.guest.full_name);
    const guestStreet = buildGuestStreet(input.guest);

    const order = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: {
          id: { in: input.items.map((item) => item.product_id) },
          isActive: true,
          category: { isActive: true },
        },
        select: {
          id: true,
          name: true,
          basePrice: true,
          currency: true,
          stockType: true,
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

        if (product.stockType === StockType.LOCAL) {
          if (product.variants.length > 0 && !variant) {
            throw new AppError('Select a product variant before checkout', 422, 'VARIANT_REQUIRED');
          }

          if (variant && item.quantity > variant.stock) {
            throw new AppError('Requested quantity exceeds available stock', 409, 'INSUFFICIENT_STOCK');
          }
        }

        const price = variant?.price ?? product.basePrice;
        return {
          productId: product.id,
          variantId: variant?.id,
          name: product.name,
          price,
          quantity: item.quantity,
          total: price.mul(item.quantity),
          currency: product.currency,
        };
      });

      const currency = orderItems[0]?.currency ?? 'NGN';
      const subtotal = orderItems.reduce(
        (total, item) => total.add(item.total),
        new Prisma.Decimal(0),
      );
      const shippingFee = new Prisma.Decimal(0);
      const tax = new Prisma.Decimal(0);
      const discount = new Prisma.Decimal(0);
      const orderTotal = subtotal.add(shippingFee).add(tax).sub(discount);

      const existingUser = providedGuestEmail
        ? await tx.user.findUnique({
            where: { email: providedGuestEmail },
            select: { id: true },
          })
        : null;

      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            email: providedGuestEmail ?? createInternalGuestEmail(),
            passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
            firstName,
            lastName,
            phone: normalizePhone(input.guest.phone),
            isVerified: false,
          },
          select: { id: true },
        }));

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

      return tx.order.create({
        data: {
          orderNumber: createOrderNumber(),
          userId: user.id,
          status: OrderStatus.PENDING,
          subtotal,
          shippingFee,
          tax,
          discount,
          total: orderTotal,
          currency,
          shippingAddressId: address.id,
          billingAddressId: address.id,
          notes: buildGuestOrderNotes(input, guestAccessToken),
          items: {
            create: orderItems.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              total: item.total,
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
}

function buildGuestOrderNotes(input: CreateGuestOrderInput, guestAccessToken: string): string {
  return [
    GUEST_CUSTOMER_NOTE_TAG,
    createGuestTokenTag(guestAccessToken),
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

export function createGuestTokenTag(guestAccessToken: string): string {
  return `${GUEST_ACCESS_TOKEN_PREFIX}${guestAccessToken}]`;
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

function createOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `YD-${timestamp}-${suffix}`;
}

function mapOrder(order: OrderRecord): OrderSummary {
  const items = order.items.map(mapOrderItem);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
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
    items,
    createdAt: order.createdAt.toISOString(),
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
  };
}

export const orderRepository = new OrderRepository();
