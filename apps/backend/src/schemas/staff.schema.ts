// ============================================
// Staff Validation Schemas
// ============================================

import { ShipmentStatus } from '@prisma/client';
import { z } from 'zod';

export const staffLastMileQuerySchema = z.object({
  status: z.nativeEnum(ShipmentStatus).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const staffShipmentParamsSchema = z.object({
  shipmentId: z.string().cuid('Invalid shipment id'),
});

export const staffShipmentStatusSchema = z.object({
  status: z.enum(['LOCAL_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED']),
});

export type StaffLastMileQueryInput = z.infer<typeof staffLastMileQuerySchema>;
export type StaffShipmentParamsInput = z.infer<typeof staffShipmentParamsSchema>;
export type StaffShipmentStatusInput = z.infer<typeof staffShipmentStatusSchema>;
