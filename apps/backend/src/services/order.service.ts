// ============================================
// Order Service
// ============================================

import { OrderCreationData, OrderDetailData, OrderListData } from '@yurdeals/shared';
import { orderRepository } from '../repositories/order.repository';
import { CreateGuestOrderInput, CreateOrderInput, OrderQueryInput } from '../schemas/order.schema';
import { AppError } from '../middleware/errorHandler';
import { AuditContext, writeAuditLog } from './audit.service';
import { notifyOrderCreated, notifyOrderStatusChanged } from './notification.service';

export async function listUserOrders(
  userId: string,
  query: OrderQueryInput,
): Promise<{ data: OrderListData; total: number }> {
  const result = await orderRepository.findUserOrders(userId, query);
  return {
    data: { orders: result.orders },
    total: result.total,
  };
}

export async function getUserOrder(userId: string, orderId: string): Promise<OrderDetailData> {
  const order = await orderRepository.findUserOrder(userId, orderId);

  if (!order) {
    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  return { order };
}

export async function cancelUserOrder(
  userId: string,
  orderId: string,
  auditContext?: AuditContext,
): Promise<OrderDetailData> {
  const order = await orderRepository.cancelPendingOrder(userId, orderId);
  await notifyOrderStatusChanged(userId, order, 'CANCELLED');
  await writeAuditLog({
    ...auditContext,
    userId,
    action: 'ORDER_CANCELLED',
    entity: 'Order',
    entityId: order.id,
    newData: {
      orderNumber: order.orderNumber,
      status: order.status,
    },
  });

  return { order };
}

export async function markOrderWhatsappCheckout(
  userId: string,
  orderId: string,
  auditContext?: AuditContext,
): Promise<OrderDetailData> {
  const order = await orderRepository.markWhatsappCheckout(userId, orderId);
  await writeAuditLog({
    ...auditContext,
    userId,
    action: 'ORDER_MARKED_WHATSAPP_CHECKOUT',
    entity: 'Order',
    entityId: order.id,
    newData: {
      orderNumber: order.orderNumber,
      checkoutMethod: 'WHATSAPP',
    },
  });

  return { order };
}

export async function markGuestOrderWhatsappCheckout(
  orderId: string,
  guestAccessToken: string,
  auditContext?: AuditContext,
): Promise<OrderDetailData> {
  const order = await orderRepository.markGuestWhatsappCheckout(orderId, guestAccessToken);
  await writeAuditLog({
    ...auditContext,
    action: 'GUEST_ORDER_MARKED_WHATSAPP_CHECKOUT',
    entity: 'Order',
    entityId: order.id,
    newData: {
      orderNumber: order.orderNumber,
      checkoutMethod: 'WHATSAPP',
      customerType: 'GUEST',
    },
  });

  return { order };
}

export async function createOrderFromCart(
  userId: string,
  input: CreateOrderInput,
  auditContext?: AuditContext,
): Promise<OrderCreationData> {
  const data = await orderRepository.createFromCart(userId, input);
  await notifyOrderCreated(userId, data.order);
  await writeAuditLog({
    ...auditContext,
    userId,
    action: 'ORDER_CREATED',
    entity: 'Order',
    entityId: data.order.id,
    newData: {
      orderNumber: data.order.orderNumber,
      total: data.order.total,
      currency: data.order.currency,
      itemCount: data.order.itemCount,
    },
  });
  return data;
}

export async function createGuestOrderFromCart(
  input: CreateGuestOrderInput,
  auditContext?: AuditContext,
): Promise<OrderCreationData> {
  const data = await orderRepository.createGuestOrder(input);
  await writeAuditLog({
    ...auditContext,
    action: 'GUEST_ORDER_CREATED',
    entity: 'Order',
    entityId: data.order.id,
    newData: {
      orderNumber: data.order.orderNumber,
      total: data.order.total,
      currency: data.order.currency,
      itemCount: data.order.itemCount,
      customerType: 'GUEST',
    },
  });
  return data;
}
