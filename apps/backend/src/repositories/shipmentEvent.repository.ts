// ============================================
// Shipment Event Repository
// ============================================

import { Prisma, ShipmentStatus } from '@prisma/client';
import { prisma } from '../config';

const SHIPMENT_EVENT_SELECT = {
  id: true,
  status: true,
  location: true,
  description: true,
  occurredAt: true,
  shipment: {
    select: {
      orderId: true,
      status: true,
      estimatedAt: true,
    },
  },
} satisfies Prisma.ShipmentEventSelect;

export type ShipmentEventRecord = Prisma.ShipmentEventGetPayload<{
  select: typeof SHIPMENT_EVENT_SELECT;
}>;

export interface LogShipmentEventInput {
  orderId: string;
  status: string;
  location?: string;
  description?: string;
  occurredAt?: Date;
}

export class ShipmentEventRepository {
  async logEvent(input: LogShipmentEventInput): Promise<ShipmentEventRecord> {
    return prisma.$transaction(async (tx) => {
      const nextShipmentStatus = mapShipmentStatus(input.status);
      const existingShipment = await tx.shipment.findFirst({
        where: { orderId: input.orderId },
        select: { id: true },
      });

      const shipment = existingShipment
        ? await tx.shipment.update({
            where: { id: existingShipment.id },
            data: { status: nextShipmentStatus },
            select: { id: true },
          })
        : await tx.shipment.create({
            data: {
              orderId: input.orderId,
              status: nextShipmentStatus,
            },
            select: { id: true },
          });

      const existingEvent = await tx.shipmentEvent.findFirst({
        where: {
          shipmentId: shipment.id,
          status: input.status,
        },
        select: SHIPMENT_EVENT_SELECT,
      });

      if (existingEvent) {
        return existingEvent;
      }

      return tx.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          status: input.status,
          location: input.location,
          description: input.description,
          occurredAt: input.occurredAt ?? new Date(),
        },
        select: SHIPMENT_EVENT_SELECT,
      });
    });
  }

  async findEventsByOrderId(orderId: string): Promise<ShipmentEventRecord[]> {
    return prisma.shipmentEvent.findMany({
      where: {
        shipment: { orderId },
      },
      select: SHIPMENT_EVENT_SELECT,
      orderBy: { occurredAt: 'asc' },
    });
  }
}

function mapShipmentStatus(status: string): ShipmentStatus {
  switch (status) {
    case 'SHIPPED_FROM_CHINA':
      return ShipmentStatus.SHIPPED;
    case 'ARRIVED_IN_NIGERIA':
      return ShipmentStatus.CUSTOMS_CLEARANCE;
    case 'OUT_FOR_DELIVERY':
      return ShipmentStatus.LOCAL_DELIVERY;
    case 'DELIVERED':
      return ShipmentStatus.DELIVERED;
    case 'PROCESSING_IN_CHINA':
    case 'PAYMENT_CONFIRMED':
    default:
      return ShipmentStatus.IN_WAREHOUSE;
  }
}

export const shipmentEventRepository = new ShipmentEventRepository();
