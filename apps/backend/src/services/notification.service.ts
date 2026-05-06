// ============================================
// Notification Service
// ============================================

import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { NotificationListData, NotificationSummary, OrderSummary, PaymentSummary } from '@yurdeals/shared';
import { logger } from '../utils';
import { notificationRepository } from '../repositories/notification.repository';

interface NotificationTemplate {
  type: string;
  title: string;
  message: string;
  eventKey: string;
  data?: Record<string, unknown>;
}

export async function notifyOrderCreated(
  userId: string,
  order: Pick<OrderSummary, 'id' | 'orderNumber' | 'total' | 'currency'>,
): Promise<NotificationSummary | null> {
  return createAndSend(userId, {
    type: 'ORDER_CREATED',
    title: 'Order created',
    message: `Order ${order.orderNumber} has been created and is ready for payment.`,
    eventKey: `order:${order.id}:created`,
    data: { orderId: order.id, orderNumber: order.orderNumber },
  });
}

export async function notifyPaymentSuccess(
  userId: string,
  order: Pick<OrderSummary, 'id' | 'orderNumber'>,
  payment?: Pick<PaymentSummary, 'id' | 'provider'>,
): Promise<NotificationSummary | null> {
  return createAndSend(userId, {
    type: 'PAYMENT_SUCCESS',
    title: 'Payment received',
    message: `Payment for order ${order.orderNumber} was confirmed.`,
    eventKey: `order:${order.id}:payment-success`,
    data: { orderId: order.id, paymentId: payment?.id, provider: payment?.provider },
  });
}

export async function notifyPaymentFailed(
  userId: string,
  order: Pick<OrderSummary, 'id' | 'orderNumber'>,
  payment?: Pick<PaymentSummary, 'id' | 'provider'>,
): Promise<NotificationSummary | null> {
  return createAndSend(userId, {
    type: 'PAYMENT_FAILED',
    title: 'Payment failed',
    message: `Payment for order ${order.orderNumber} could not be completed.`,
    eventKey: `order:${order.id}:payment-failed`,
    data: { orderId: order.id, paymentId: payment?.id, provider: payment?.provider },
  });
}

export async function notifyOrderStatusChanged(
  userId: string,
  order: Pick<OrderSummary, 'id' | 'orderNumber'>,
  status: OrderStatus | PaymentStatus | string,
): Promise<NotificationSummary | null> {
  const label = getStatusLabel(status);

  return createAndSend(userId, {
    type: 'ORDER_STATUS_CHANGED',
    title: label,
    message: `Order ${order.orderNumber}: ${label}.`,
    eventKey: `order:${order.id}:status:${status}`,
    data: { orderId: order.id, status },
  });
}

export async function notifyShipmentStatusChanged(
  userId: string,
  order: Pick<OrderSummary, 'id' | 'orderNumber'>,
  status: string,
): Promise<NotificationSummary | null> {
  const copy = getShipmentStatusCopy(status);

  return createAndSend(userId, {
    type: 'SHIPMENT_STATUS_CHANGED',
    title: copy.title,
    message: `Order ${order.orderNumber}: ${copy.message}`,
    eventKey: `order:${order.id}:shipment:${status}`,
    data: { orderId: order.id, status },
  });
}

export async function listNotifications(userId: string): Promise<NotificationListData> {
  const notifications = await notificationRepository.findRecentByUserId(userId, 20);
  return { notifications };
}

async function createAndSend(
  userId: string,
  template: NotificationTemplate,
): Promise<NotificationSummary | null> {
  const notification = await notificationRepository.createOnce({
    userId,
    type: template.type,
    title: template.title,
    message: template.message,
    eventKey: template.eventKey,
    data: template.data as Prisma.InputJsonObject | undefined,
  });

  if (!notification) {
    return null;
  }

  logger.info('Notification queued', {
    notificationId: notification.id,
    userId,
    type: notification.type,
  });
  logger.info('Placeholder email notification sent', { notificationId: notification.id });
  logger.info('Placeholder SMS notification sent', { notificationId: notification.id });
  logger.info('Placeholder WhatsApp notification sent', { notificationId: notification.id });

  return notification;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PROCESSING_IN_CHINA: 'Processing in China',
    SHIPPED_FROM_CHINA: 'Shipped from China',
    ARRIVED_IN_NIGERIA: 'Arrived in Nigeria',
    OUT_FOR_DELIVERY: 'Out for delivery',
    IN_TRANSIT: 'In transit',
    LOCAL_DELIVERY: 'Out for delivery',
    DELIVERED: 'Delivered',
    DELIVERY_FAILED: 'Delivery failed',
    CONFIRMED: 'Order confirmed',
    PROCESSING: 'Order processing',
    SHIPPED: 'Shipped',
  };

  return labels[status] ?? status.replace(/_/g, ' ').toLowerCase();
}

function getShipmentStatusCopy(status: string): { title: string; message: string } {
  const copy: Record<string, { title: string; message: string }> = {
    SHIPPED: {
      title: 'Your order has shipped',
      message: 'Your order has shipped and tracking has started.',
    },
    SHIPPED_FROM_CHINA: {
      title: 'Shipped from China',
      message: 'Your order has shipped from China and is on the way to Nigeria.',
    },
    IN_TRANSIT: {
      title: 'Your order is on the way',
      message: 'Your shipment is in transit.',
    },
    ARRIVED_IN_NIGERIA: {
      title: 'Arrived in Nigeria',
      message: 'Your order has arrived in Nigeria and is moving toward local delivery.',
    },
    CUSTOMS_CLEARANCE: {
      title: 'Customs clearance',
      message: 'Your order is going through customs clearance.',
    },
    OUT_FOR_DELIVERY: {
      title: 'Your order is out for delivery',
      message: 'Your order is out for delivery today.',
    },
    LOCAL_DELIVERY: {
      title: 'Your order is out for delivery',
      message: 'Your order is with our local delivery team.',
    },
    DELIVERED: {
      title: 'Your order has been delivered',
      message: 'Your order has been delivered. Thank you for shopping with YurDeals.',
    },
    DELIVERY_FAILED: {
      title: 'Delivery failed',
      message: 'Delivery failed. Please contact support so we can help complete delivery.',
    },
  };

  return (
    copy[status] ?? {
      title: getStatusLabel(status),
      message: getStatusLabel(status),
    }
  );
}
