// ============================================
// Shipment Repository
// ============================================

import { Prisma, ShipmentStatus } from '@prisma/client';
import { ShipmentSummary } from '@yurdeals/shared';
import { prisma } from '../config';
import { AdminShipmentQueryInput } from '../schemas/admin.schema';
import { StaffLastMileQueryInput } from '../schemas/staff.schema';
import { getPagination } from '../utils/pagination';

const SHIPMENT_SELECT = {
  id: true,
  orderId: true,
  status: true,
  trackingNumber: true,
  carrier: true,
  estimatedAt: true,
  deliveredAt: true,
  updatedAt: true,
  order: {
    select: {
      orderNumber: true,
      total: true,
      currency: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
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
    },
  },
} satisfies Prisma.ShipmentSelect;

type ShipmentRecord = Prisma.ShipmentGetPayload<{ select: typeof SHIPMENT_SELECT }>;

export interface ShipmentPageResult {
  shipments: ShipmentSummary[];
  total: number;
}

export class ShipmentRepository {
  async findAdminShipments(query: AdminShipmentQueryInput): Promise<ShipmentPageResult> {
    const where = query.status ? { status: query.status } : {};
    const { skip, take } = getPagination(query);

    const [shipments, total] = await prisma.$transaction([
      prisma.shipment.findMany({
        where,
        select: SHIPMENT_SELECT,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      prisma.shipment.count({ where }),
    ]);

    return {
      shipments: shipments.map(mapShipment),
      total,
    };
  }

  async findLastMileShipments(query: StaffLastMileQueryInput): Promise<ShipmentPageResult> {
    const where: Prisma.ShipmentWhereInput = {
      status: query.status
        ? query.status
        : {
            in: [
              ShipmentStatus.IN_WAREHOUSE,
              ShipmentStatus.CUSTOMS_CLEARANCE,
              ShipmentStatus.LOCAL_DELIVERY,
              ShipmentStatus.DELIVERED,
            ],
          },
    };
    const { skip, take } = getPagination(query);

    const [shipments, total] = await prisma.$transaction([
      prisma.shipment.findMany({
        where,
        select: SHIPMENT_SELECT,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      prisma.shipment.count({ where }),
    ]);

    return {
      shipments: shipments.map(mapShipment),
      total,
    };
  }

  async updateShipmentStatusWithEvent(
    shipmentId: string,
    status: ShipmentStatus,
    eventStatus: string,
    description: string,
    location?: string,
  ): Promise<ShipmentSummary | null> {
    const shipment = await prisma.$transaction(async (tx) => {
      const existingShipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
        select: { id: true },
      });

      if (!existingShipment) {
        return null;
      }

      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status,
          deliveredAt: status === ShipmentStatus.DELIVERED ? new Date() : undefined,
        },
        select: SHIPMENT_SELECT,
      });

      const existingEvent = await tx.shipmentEvent.findFirst({
        where: { shipmentId, status: eventStatus },
        select: { id: true },
      });

      if (!existingEvent) {
        await tx.shipmentEvent.create({
          data: {
            shipmentId,
            status: eventStatus,
            location,
            description,
            occurredAt: new Date(),
          },
        });
      }

      return updatedShipment;
    });

    return shipment ? mapShipment(shipment) : null;
  }
}

function mapShipment(shipment: ShipmentRecord): ShipmentSummary {
  return {
    id: shipment.id,
    orderId: shipment.orderId,
    orderNumber: shipment.order.orderNumber,
    status: shipment.status,
    trackingNumber: shipment.trackingNumber,
    carrier: shipment.carrier,
    customerName: `${shipment.order.user.firstName} ${shipment.order.user.lastName}`,
    customerPhone: shipment.order.user.phone,
    address: shipment.order.shippingAddress
      ? {
          id: shipment.order.shippingAddress.id,
          label: shipment.order.shippingAddress.label,
          firstName: shipment.order.shippingAddress.firstName,
          lastName: shipment.order.shippingAddress.lastName,
          phone: shipment.order.shippingAddress.phone,
          street: shipment.order.shippingAddress.street,
          city: shipment.order.shippingAddress.city,
          state: shipment.order.shippingAddress.state,
          lga: shipment.order.shippingAddress.lga,
          area: shipment.order.shippingAddress.area,
          landmark: shipment.order.shippingAddress.landmark,
          country: shipment.order.shippingAddress.country,
          postalCode: shipment.order.shippingAddress.postalCode,
          deliveryNotes: shipment.order.shippingAddress.deliveryNotes,
          isDefault: shipment.order.shippingAddress.isDefault,
          createdAt: shipment.order.shippingAddress.createdAt.toISOString(),
          updatedAt: shipment.order.shippingAddress.updatedAt.toISOString(),
        }
      : null,
    total: Number(shipment.order.total),
    currency: shipment.order.currency,
    estimatedAt: shipment.estimatedAt?.toISOString() ?? null,
    deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
    updatedAt: shipment.updatedAt.toISOString(),
  };
}

export const shipmentRepository = new ShipmentRepository();
