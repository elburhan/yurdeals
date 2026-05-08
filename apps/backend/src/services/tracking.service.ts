// ============================================
// Tracking Service
// ============================================

import { OrderSummary, OrderTrackingData, TrackingTimelineEvent } from '@yurdeals/shared';
import { AppError } from '../middleware/errorHandler';
import { orderRepository } from '../repositories/order.repository';
import { shipmentEventRepository } from '../repositories/shipmentEvent.repository';
import { PublicOrderTrackingQueryInput } from '../schemas/tracking.schema';

interface PublicTrackedOrder {
  order: OrderSummary;
  tracking: OrderTrackingData;
}

interface PublicOrderTrackingLookupData {
  orders: PublicTrackedOrder[];
}

export async function getOrderTracking(
  userId: string,
  orderId: string,
): Promise<OrderTrackingData> {
  const order = await orderRepository.findOrderTrackingBase(userId, orderId);

  if (!order) {
    throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
  }

  return buildTrackingData(order, orderId);
}

export async function getPublicOrderTracking(
  query: PublicOrderTrackingQueryInput,
): Promise<PublicOrderTrackingLookupData> {
  const records = await orderRepository.findPublicTrackingOrdersByPhone(query.phone, query.orderNumber);

  if (records.length === 0) {
    throw new AppError('No recent orders were found for that phone number.', 404, 'ORDER_NOT_FOUND');
  }

  const orders = await Promise.all(
    records.map(async (record) => ({
      order: record.order,
      tracking: await buildTrackingData(record.trackingBase, record.order.id),
    })),
  );

  return { orders };
}

async function buildTrackingData(
  order: {
    status: string;
    createdAt: Date;
    payments: Array<{ status: string; paidAt: Date | null; updatedAt: Date }>;
    shipments: Array<{ estimatedAt: Date | null }>;
  },
  orderId: string,
): Promise<OrderTrackingData> {
  const shipmentEvents = await shipmentEventRepository.findEventsByOrderId(orderId);
  const timeline: TrackingTimelineEvent[] = [
    {
      status: 'ORDER_CREATED',
      label: 'Order created',
      description: 'Your order was created.',
      timestamp: order.createdAt.toISOString(),
      location: null,
      completed: true,
    },
    ...order.payments.map((payment) => {
      const isSuccess = payment.status === 'SUCCESS';

      return {
        status: isSuccess ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED',
        label: isSuccess ? 'Payment received' : 'Payment failed',
        description: isSuccess
          ? 'Your payment was confirmed.'
          : 'Your payment could not be completed.',
        timestamp: (payment.paidAt ?? payment.updatedAt).toISOString(),
        location: null,
        completed: true,
      };
    }),
    ...shipmentEvents.map((event) => ({
      status: event.status,
      label: getTimelineLabel(event.status),
      description: event.description ?? getTimelineLabel(event.status),
      timestamp: event.occurredAt.toISOString(),
      location: event.location,
      completed: true,
    })),
  ].sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  return {
    currentStatus: order.status,
    eta: order.shipments[0]?.estimatedAt?.toISOString() ?? null,
    timeline,
  };
}

function getTimelineLabel(status: string): string {
  const labels: Record<string, string> = {
    PAYMENT_CONFIRMED: 'Payment confirmed',
    PROCESSING_IN_CHINA: 'Processing in China',
    SHIPPED_FROM_CHINA: 'Shipped from China',
    ARRIVED_IN_NIGERIA: 'Arrived in Nigeria',
    OUT_FOR_DELIVERY: 'Out for delivery',
    DELIVERED: 'Delivered',
  };

  return labels[status] ?? status.replace(/_/g, ' ');
}
