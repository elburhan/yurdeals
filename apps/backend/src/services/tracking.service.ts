// ============================================
// Tracking Service
// ============================================

import { OrderTrackingData, PublicOrderTrackingData, TrackingTimelineEvent } from '@yurdeals/shared';
import { AppError } from '../middleware/errorHandler';
import { orderRepository, PublicTrackingLookupRecord } from '../repositories/order.repository';
import { shipmentEventRepository } from '../repositories/shipmentEvent.repository';
import { PublicOrderTrackingQueryInput } from '../schemas/tracking.schema';

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
) : Promise<PublicOrderTrackingData> {
  const order = await orderRepository.findPublicTrackingOrder(query.phone, query.orderNumber);

  if (!order) {
    throw new AppError(
      'We could not find a matching order for that phone number and order number.',
      404,
      'ORDER_NOT_FOUND',
    );
  }

  return buildPublicTrackingData(order);
}

async function buildTrackingData(
  order: {
    status: string;
    createdAt: Date;
    payments: Array<{ status: string; paidAt: Date | null; updatedAt: Date }>;
    shipments: Array<{ estimatedAt: Date | null }>;
  },
  orderId: string,
  shipmentEventsOverride?: TrackingTimelineEventSource[],
): Promise<OrderTrackingData> {
  const shipmentEvents =
    shipmentEventsOverride ?? (await shipmentEventRepository.findEventsByOrderId(orderId));
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

type TrackingTimelineEventSource = Awaited<
  ReturnType<typeof shipmentEventRepository.findEventsByOrderId>
>[number];

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

async function buildPublicTrackingData(
  order: PublicTrackingLookupRecord,
): Promise<PublicOrderTrackingData> {
  const shipmentEvents = await shipmentEventRepository.findEventsByOrderId(order.id);
  const tracking = await buildTrackingData(
    {
      status: order.status,
      createdAt: order.createdAt,
      payments: order.payments,
      shipments: order.shipments.map((shipment) => ({ estimatedAt: shipment.estimatedAt })),
    },
    order.id,
    shipmentEvents,
  );

  const latestPayment = order.payments.at(-1)?.status ?? null;
  const latestShipmentStatus = shipmentEvents.at(-1)?.status ?? order.shipments[0]?.status ?? null;
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: latestPayment,
    shipmentStatus: latestShipmentStatus,
    eta: tracking.eta,
    itemCount,
    itemSummary: order.items.slice(0, 3).map((item) => `${item.quantity} x ${item.name}`),
    tracking,
  };
}
