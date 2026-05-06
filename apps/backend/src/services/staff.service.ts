// ============================================
// Staff Service
// ============================================

import { ShipmentStatus } from '@prisma/client';
import { StaffLastMileData } from '@yurdeals/shared';
import { AppError } from '../middleware/errorHandler';
import { orderRepository } from '../repositories/order.repository';
import { shipmentRepository } from '../repositories/shipment.repository';
import { StaffLastMileQueryInput, StaffShipmentStatusInput } from '../schemas/staff.schema';
import { notifyShipmentStatusChanged } from './notification.service';
import { AuditContext, writeAuditLog } from './audit.service';

export async function listStaffLastMileShipments(
  query: StaffLastMileQueryInput,
): Promise<{ data: StaffLastMileData; total: number }> {
  const result = await shipmentRepository.findLastMileShipments(query);
  return { data: { shipments: result.shipments }, total: result.total };
}

export async function updateStaffLastMileStatus(
  shipmentId: string,
  input: StaffShipmentStatusInput,
  auditContext?: AuditContext,
): Promise<StaffLastMileData['shipments'][number]> {
  const transition = getLastMileTransition(input.status);
  const shipment = await shipmentRepository.updateShipmentStatusWithEvent(
    shipmentId,
    transition.shipmentStatus,
    transition.eventStatus,
    transition.description,
    'Nigeria',
  );

  if (!shipment) {
    throw new AppError('Shipment not found', 404, 'SHIPMENT_NOT_FOUND');
  }

  const order = await orderRepository.findOrderForEvents(shipment.orderId);
  if (order) {
    await notifyShipmentStatusChanged(order.userId, order, transition.eventStatus);
  }

  await writeAuditLog({
    ...auditContext,
    action: 'STAFF_SHIPMENT_STATUS_UPDATED',
    entity: 'Shipment',
    entityId: shipment.id,
    newData: {
      orderId: shipment.orderId,
      orderNumber: shipment.orderNumber,
      shipmentStatus: transition.shipmentStatus,
      eventStatus: transition.eventStatus,
    },
  });

  return shipment;
}

function getLastMileTransition(status: StaffShipmentStatusInput['status']): {
  shipmentStatus: ShipmentStatus;
  eventStatus: string;
  description: string;
} {
  switch (status) {
    case 'DELIVERED':
      return {
        shipmentStatus: ShipmentStatus.DELIVERED,
        eventStatus: 'DELIVERED',
        description: 'Your order has been delivered.',
      };
    case 'DELIVERY_FAILED':
      return {
        shipmentStatus: ShipmentStatus.LOCAL_DELIVERY,
        eventStatus: 'DELIVERY_FAILED',
        description: 'Delivery was attempted but could not be completed.',
      };
    case 'LOCAL_DELIVERY':
    default:
      return {
        shipmentStatus: ShipmentStatus.LOCAL_DELIVERY,
        eventStatus: 'OUT_FOR_DELIVERY',
        description: 'Your order is out for delivery.',
      };
  }
}
