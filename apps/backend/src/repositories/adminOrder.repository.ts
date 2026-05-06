// ============================================
// Admin Order Repository
// ============================================

import { OrderStatus, Prisma, ShipmentStatus } from '@prisma/client';
import {
  AdminOrderDetailData,
  AdminOrderListData,
  AdminOrderListItem,
  AdminOverviewData,
  OrderItemSummary,
  PaymentSummary,
} from '@yurdeals/shared';
import { prisma } from '../config';
import { AdminOrderQueryInput } from '../schemas/admin.schema';
import { getPagination } from '../utils/pagination';
import { GUEST_CUSTOMER_NOTE_TAG, WHATSAPP_CHECKOUT_NOTE_TAG } from './order.repository';

const ADMIN_ORDER_LIST_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
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
  subtotal: true,
  shippingFee: true,
  tax: true,
  discount: true,
  total: true,
  currency: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
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
  payments: {
    select: {
      id: true,
      orderId: true,
      provider: true,
      providerRef: true,
      amount: true,
      currency: true,
      status: true,
      paidAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
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

  async getOverview(): Promise<AdminOverviewData> {
    const [
      totalOrders,
      pendingOrders,
      confirmedOrders,
      inTransitOrders,
      deliveredOrders,
      totalShipments,
      inWarehouseShipments,
      localDeliveryShipments,
      deliveredShipments,
      totalProducts,
      activeProducts,
    ] = await prisma.$transaction([
      prisma.order.count(),
      prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      prisma.order.count({ where: { status: OrderStatus.CONFIRMED } }),
      prisma.order.count({ where: { status: OrderStatus.IN_TRANSIT } }),
      prisma.order.count({ where: { status: OrderStatus.DELIVERED } }),
      prisma.shipment.count(),
      prisma.shipment.count({ where: { status: ShipmentStatus.IN_WAREHOUSE } }),
      prisma.shipment.count({ where: { status: ShipmentStatus.LOCAL_DELIVERY } }),
      prisma.shipment.count({ where: { status: ShipmentStatus.DELIVERED } }),
      prisma.product.count(),
      prisma.product.count({ where: { isActive: true } }),
    ]);

    return {
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        confirmed: confirmedOrders,
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
    total: Number(order.total),
    currency: order.currency,
    customerName: `${order.user.firstName} ${order.user.lastName}`,
    customerEmail: order.user.email,
    itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
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
    customer: {
      id: order.user.id,
      name: `${order.user.firstName} ${order.user.lastName}`,
      email: order.user.email,
      phone: order.user.phone,
    },
    payments: order.payments.map(mapPayment),
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
  };
}

function mapPayment(payment: AdminOrderDetailRecord['payments'][number]): PaymentSummary {
  return {
    id: payment.id,
    orderId: payment.orderId,
    provider: payment.provider,
    providerRef: payment.providerRef,
    amount: Number(payment.amount),
    currency: payment.currency,
    status: payment.status,
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}

export const adminOrderRepository = new AdminOrderRepository();
