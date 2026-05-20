// ============================================
// Admin Order Repository
// ============================================

import { FraudRiskLevel, OrderStatus, Prisma, ShipmentStatus } from '@prisma/client';
import {
  AdminOrderDetailData,
  AdminInventoryReservationSummary,
  AdminOrderListData,
  AdminOrderListItem,
  AdminPaymentAttemptSummary,
  AdminPaymentEventSummary,
  AdminOverviewData,
  OrderItemSummary,
} from '@yurdeals/shared';
import { prisma } from '../config';
import { AdminOrderQueryInput } from '../schemas/admin.schema';
import { getPagination } from '../utils/pagination';
import { GUEST_CUSTOMER_NOTE_TAG, WHATSAPP_CHECKOUT_NOTE_TAG } from './order.repository';

const ADMIN_ORDER_LIST_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  inspectionStatus: true,
  riskLevel: true,
  holdForManualReview: true,
  paymentReference: true,
  total: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
  notes: true,
  user: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  },
  shippingAddress: {
    select: {
      street: true,
      city: true,
      state: true,
      lga: true,
      area: true,
      landmark: true,
      country: true,
    },
  },
  items: {
    select: {
      quantity: true,
    },
  },
} satisfies Prisma.OrderSelect;

const ADMIN_ORDER_DETAIL_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  inspectionStatus: true,
  riskLevel: true,
  riskFlags: true,
  riskReviewedAt: true,
  riskReviewedBy: true,
  holdForManualReview: true,
  fraudNotes: true,
  paymentReference: true,
  subtotal: true,
  shippingFee: true,
  tax: true,
  discount: true,
  total: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  shippedAt: true,
  deliveredAt: true,
  trackingNumber: true,
  trackingCarrier: true,
  trackingUrl: true,
  notes: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  },
  riskReviewer: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
    },
  },
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
      lga: true,
      area: true,
      landmark: true,
      country: true,
      postalCode: true,
      deliveryNotes: true,
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
      stockTypeSnapshot: true,
      inspectionRequired: true,
    },
    orderBy: { id: 'asc' },
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
      events: {
        select: {
          id: true,
          paymentId: true,
          provider: true,
          eventType: true,
          eventId: true,
          status: true,
          payload: true,
          receivedAt: true,
        },
        orderBy: { receivedAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  },
  inventoryReservations: {
    select: {
      id: true,
      orderItemId: true,
      productId: true,
      variantId: true,
      stockType: true,
      quantity: true,
      status: true,
      expiresAt: true,
      confirmedAt: true,
      releasedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.OrderSelect;

type AdminOrderListRecord = Prisma.OrderGetPayload<{ select: typeof ADMIN_ORDER_LIST_SELECT }>;
type AdminOrderDetailRecord = Prisma.OrderGetPayload<{
  select: typeof ADMIN_ORDER_DETAIL_SELECT;
}>;

export interface AdminOrderPageResult {
  data: AdminOrderListData;
  total: number;
}

export class AdminOrderRepository {
  async findOrders(query: AdminOrderQueryInput): Promise<AdminOrderPageResult> {
    const where = buildOrderWhere(query);
    const { skip, take } = getPagination(query);

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        select: ADMIN_ORDER_LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      data: { orders: orders.map(mapAdminOrderListItem) },
      total,
    };
  }

  async findOrder(orderId: string): Promise<AdminOrderDetailData | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: ADMIN_ORDER_DETAIL_SELECT,
    });

    return order ? { order: mapAdminOrderDetail(order) } : null;
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<AdminOrderDetailData> {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      select: ADMIN_ORDER_DETAIL_SELECT,
    });

    return { order: mapAdminOrderDetail(order) };
  }

  async findOrderRiskGate(orderId: string): Promise<{
    orderNumber: string;
    holdForManualReview: boolean;
    riskLevel: FraudRiskLevel;
  } | null> {
    return prisma.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        holdForManualReview: true,
        riskLevel: true,
      },
    });
  }

  async updateOrderRiskReview(
    orderId: string,
    input: {
      holdForManualReview?: boolean;
      fraudNotes?: string | null;
      riskLevelOverride?: FraudRiskLevel;
      reviewedByUserId: string;
    },
  ): Promise<AdminOrderDetailData> {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        ...(input.holdForManualReview !== undefined
          ? { holdForManualReview: input.holdForManualReview }
          : {}),
        ...(input.fraudNotes !== undefined ? { fraudNotes: input.fraudNotes } : {}),
        ...(input.riskLevelOverride ? { riskLevel: input.riskLevelOverride } : {}),
        riskReviewedAt: new Date(),
        riskReviewedBy: input.reviewedByUserId,
      },
      select: ADMIN_ORDER_DETAIL_SELECT,
    });

    return { order: mapAdminOrderDetail(order) };
  }

  async getOverview(): Promise<AdminOverviewData> {
    const [
      totalOrders,
      pendingOrders,
      paidOrders,
      processingOrders,
      inTransitOrders,
      deliveredOrders,
      totalShipments,
      inWarehouseShipments,
      localDeliveryShipments,
      deliveredShipments,
      totalProducts,
      activeProducts,
      publishedProducts,
      preorderProducts,
    ] = await prisma.$transaction([
      prisma.order.count(),
      prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      prisma.order.count({ where: { status: OrderStatus.PAID } }),
      prisma.order.count({ where: { status: OrderStatus.PROCESSING } }),
      prisma.order.count({ where: { status: OrderStatus.IN_TRANSIT } }),
      prisma.order.count({ where: { status: OrderStatus.DELIVERED } }),
      prisma.shipment.count(),
      prisma.shipment.count({ where: { status: ShipmentStatus.IN_WAREHOUSE } }),
      prisma.shipment.count({ where: { status: ShipmentStatus.LOCAL_DELIVERY } }),
      prisma.shipment.count({ where: { status: ShipmentStatus.DELIVERED } }),
      prisma.product.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isPublished: true } }),
      prisma.product.count({ where: { stockType: 'PREORDER' } }),
    ]);

    return {
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        paid: paidOrders,
        processing: processingOrders,
        inTransit: inTransitOrders,
        delivered: deliveredOrders,
      },
      shipments: {
        total: totalShipments,
        inWarehouse: inWarehouseShipments,
        localDelivery: localDeliveryShipments,
        delivered: deliveredShipments,
      },
      products: {
        total: totalProducts,
        active: activeProducts,
        published: publishedProducts,
        preorder: preorderProducts,
      },
    };
  }
}

function buildOrderWhere(query: AdminOrderQueryInput): Prisma.OrderWhereInput {
  return {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { orderNumber: { contains: query.search, mode: 'insensitive' } },
            { paymentReference: { contains: query.search, mode: 'insensitive' } },
            { user: { email: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
    ...(query.date_from || query.date_to
      ? {
          createdAt: {
            ...(query.date_from ? { gte: new Date(query.date_from) } : {}),
            ...(query.date_to ? { lte: new Date(query.date_to) } : {}),
          },
        }
      : {}),
  };
}

function mapAdminOrderListItem(order: AdminOrderListRecord): AdminOrderListItem {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    checkoutMethod: order.notes?.includes(WHATSAPP_CHECKOUT_NOTE_TAG) ? 'WHATSAPP' : 'ONLINE',
    customerType: order.notes?.includes(GUEST_CUSTOMER_NOTE_TAG) ? 'GUEST' : 'REGISTERED',
    status: order.status,
    inspectionStatus: order.inspectionStatus,
    riskLevel: order.riskLevel,
    holdForManualReview: order.holdForManualReview,
    total: Number(order.total),
    currency: order.currency,
    customerName: `${order.user.firstName} ${order.user.lastName}`,
    customerEmail: order.user.email,
    customerPhone: order.user.phone ?? null,
    deliveryAddressShort: order.shippingAddress
      ? [order.shippingAddress.street, order.shippingAddress.area, order.shippingAddress.city]
          .filter(Boolean)
          .join(', ')
      : null,
    deliveryState: order.shippingAddress?.state ?? null,
    itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
    paymentReference: order.paymentReference,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

function mapAdminOrderDetail(order: AdminOrderDetailRecord): AdminOrderDetailData['order'] {
  const items = order.items.map(mapOrderItem);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    inspectionStatus: order.inspectionStatus,
    riskLevel: order.riskLevel,
    riskFlags: order.riskFlags,
    riskReviewedAt: order.riskReviewedAt?.toISOString() ?? null,
    riskReviewedBy: order.riskReviewedBy ?? null,
    riskReviewedByName: order.riskReviewer
      ? `${order.riskReviewer.firstName} ${order.riskReviewer.lastName}`.trim() || order.riskReviewer.email
      : null,
    holdForManualReview: order.holdForManualReview,
    fraudNotes: order.fraudNotes,
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
          lga: order.shippingAddress.lga,
          area: order.shippingAddress.area,
          landmark: order.shippingAddress.landmark,
          country: order.shippingAddress.country,
          postalCode: order.shippingAddress.postalCode,
          deliveryNotes: order.shippingAddress.deliveryNotes,
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
    customer: {
      id: order.user.id,
      name: `${order.user.firstName} ${order.user.lastName}`,
      email: order.user.email,
      phone: order.user.phone,
    },
    checkoutMethod: order.notes?.includes(WHATSAPP_CHECKOUT_NOTE_TAG) ? 'WHATSAPP' : 'ONLINE',
    customerType: order.notes?.includes(GUEST_CUSTOMER_NOTE_TAG) ? 'GUEST' : 'REGISTERED',
    payments: order.payments.map(mapAdminPaymentAttempt),
    paymentEvents: order.payments
      .flatMap((payment) => payment.events.map((event) => mapAdminPaymentEvent(payment, event)))
      .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt)),
    reservations: order.inventoryReservations.map(mapAdminInventoryReservation),
  };
}

function mapOrderItem(item: AdminOrderDetailRecord['items'][number]): OrderItemSummary {
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

function mapAdminPaymentAttempt(
  payment: AdminOrderDetailRecord['payments'][number],
): AdminPaymentAttemptSummary {
  return {
    id: payment.id,
    provider: payment.provider,
    status: payment.status,
    amount: Number(payment.amount),
    amountCaptured: payment.amountCaptured ? Number(payment.amountCaptured) : null,
    amountRefunded: Number(payment.amountRefunded),
    fees: payment.fees ? Number(payment.fees) : null,
    currency: payment.currency,
    reference: payment.reference,
    providerRef: payment.providerRef,
    providerTransactionId: payment.providerTransactionId,
    customerEmail: payment.customerEmail,
    channel: payment.channel,
    gatewayResponse: summarizeText(payment.gatewayResponse),
    hasAuthorizationUrl: Boolean(payment.authorizationUrl),
    hasAccessCode: Boolean(payment.accessCode),
    paidAt: payment.paidAt?.toISOString() ?? null,
    verifiedAt: payment.verifiedAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}

function mapAdminPaymentEvent(
  payment: AdminOrderDetailRecord['payments'][number],
  event: AdminOrderDetailRecord['payments'][number]['events'][number],
): AdminPaymentEventSummary {
  const payload = asRecord(event.payload);

  return {
    id: event.id,
    paymentId: event.paymentId,
    provider: event.provider,
    eventType: event.eventType,
    eventId: event.eventId,
    providerReference: payment.reference,
    providerRef: payment.providerRef,
    status: event.status,
    amountMatched: readBoolean(payload, 'amountMatched'),
    currencyMatched: readBoolean(payload, 'currencyMatched'),
    providerTransactionId: readString(payload, 'providerTransactionId'),
    channel: readString(payload, 'channel'),
    gatewayMessage: summarizeText(readString(payload, 'gatewayMessage')),
    paidAt: readString(payload, 'paidAt'),
    receivedAt: event.receivedAt.toISOString(),
  };
}

function mapAdminInventoryReservation(
  reservation: AdminOrderDetailRecord['inventoryReservations'][number],
): AdminInventoryReservationSummary {
  return {
    id: reservation.id,
    orderItemId: reservation.orderItemId,
    productId: reservation.productId,
    variantId: reservation.variantId,
    stockType: reservation.stockType,
    quantity: reservation.quantity,
    status: reservation.status,
    expiresAt: reservation.expiresAt.toISOString(),
    confirmedAt: reservation.confirmedAt?.toISOString() ?? null,
    releasedAt: reservation.releasedAt?.toISOString() ?? null,
    createdAt: reservation.createdAt.toISOString(),
    updatedAt: reservation.updatedAt.toISOString(),
  };
}

function summarizeText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.length > 240 ? `${value.slice(0, 237)}...` : value;
}

function asRecord(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, Prisma.JsonValue>;
}

function readString(record: Record<string, Prisma.JsonValue>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function readBoolean(record: Record<string, Prisma.JsonValue>, key: string): boolean | null {
  const value = record[key];
  return typeof value === 'boolean' ? value : null;
}

export const adminOrderRepository = new AdminOrderRepository();
