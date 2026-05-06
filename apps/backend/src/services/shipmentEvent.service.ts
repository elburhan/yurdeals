// ============================================
// Shipment Event Service
// ============================================

import { OrderStatus } from '@prisma/client';
import { shipmentEventRepository } from '../repositories/shipmentEvent.repository';
import { notifyOrderStatusChanged, notifyShipmentStatusChanged } from './notification.service';
import { orderRepository } from '../repositories/order.repository';

export async function logShipmentEvent(
  orderId: string,
  status: string,
  location?: string,
  description?: string,
): Promise<void> {
  await shipmentEventRepository.logEvent({
    orderId,
    status,
    location,
    description,
  });
}

export async function handleOrderStatusTransition(
  orderId: string,
  status: string,
): Promise<void> {
  const order = await orderRepository.findOrderForEvents(orderId);

  if (!order) {
    return;
  }

  const event = getShipmentEventForStatus(status);
  if (event) {
    await logShipmentEvent(orderId, event.status, event.location, event.description);
    await notifyShipmentStatusChanged(order.userId, order, event.status);
    return;
  }

  await notifyOrderStatusChanged(order.userId, order, status);
}

export function getShipmentEventForStatus(
  status: string,
): { status: string; location?: string; description: string } | null {
  switch (status) {
    case 'PAYMENT_CONFIRMED':
    case OrderStatus.PAID:
      return {
        status: 'PAYMENT_CONFIRMED',
        description: 'Payment confirmed and order is being prepared.',
      };
    case OrderStatus.PROCESSING:
    case OrderStatus.INSPECTION_PENDING:
    case OrderStatus.INSPECTION_PASSED:
    case 'PROCESSING_IN_CHINA':
      return {
        status: 'PROCESSING_IN_CHINA',
        location: 'China',
        description: 'Your order is being processed with our China fulfillment team.',
      };
    case OrderStatus.SHIPPED:
    case OrderStatus.IN_TRANSIT:
    case 'SHIPPED_FROM_CHINA':
      return {
        status: 'SHIPPED_FROM_CHINA',
        location: 'China',
        description: 'Your order has shipped from China.',
      };
    case 'ARRIVED_IN_NIGERIA':
      return {
        status: 'ARRIVED_IN_NIGERIA',
        location: 'Nigeria',
        description: 'Your order has arrived in Nigeria.',
      };
    case 'OUT_FOR_DELIVERY':
      return {
        status: 'OUT_FOR_DELIVERY',
        location: 'Nigeria',
        description: 'Your order is out for delivery.',
      };
    case OrderStatus.DELIVERED:
      return {
        status: 'DELIVERED',
        description: 'Your order has been delivered.',
      };
    default:
      return null;
  }
}
