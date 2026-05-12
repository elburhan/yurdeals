// ============================================
// Admin Validation Schemas
// ============================================

import { OrderStatus, ProductStockType, ShipmentStatus } from '@prisma/client';
import { z } from 'zod';

const optionalCuid = z.string().cuid('Invalid id').optional();
const optionalDate = z.string().datetime('Invalid date').optional();
const optionalNullableDate = z
  .string()
  .trim()
  .datetime('Invalid date')
  .optional()
  .or(z.literal('').transform(() => undefined));
const optionalNonNegativeInt = z.coerce.number().int().nonnegative().optional();
const optionalImageUrl = z
  .string()
  .trim()
  .url('Image URL must be a valid URL')
  .max(2048, 'Image URL must be at most 2048 characters')
  .optional()
  .or(z.literal('').transform(() => undefined));
const productImageUrl = z
  .string()
  .trim()
  .min(1, 'Image URL is required')
  .url('Image URL must be a valid URL')
  .max(2048, 'Image URL must be at most 2048 characters');
const optionalImageUrls = z.array(productImageUrl).min(1, 'At least one image is required').optional();

export const adminProductQuerySchema = z.object({
  status: z.enum(['active', 'inactive', 'all']).optional().default('all'),
  category_id: optionalCuid,
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const adminProductBaseSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be URL-safe')
    .optional(),
  description: z.string().trim().min(5).max(5000),
  short_desc: z.string().trim().max(240).optional(),
  category_id: z.string().cuid('Invalid category id'),
  base_price: z.coerce.number().positive(),
  currency: z.string().trim().length(3).optional().default('NGN'),
  stock_type: z.nativeEnum(ProductStockType).optional().default(ProductStockType.IN_STOCK),
  sku: z.string().trim().max(80).optional(),
  weight: z.coerce.number().positive().optional(),
  is_featured: z.boolean().optional().default(false),
  inventoryQuantity: optionalNonNegativeInt,
  preorderSlotsTotal: optionalNonNegativeInt,
  preorderSlotsRemaining: optionalNonNegativeInt,
  preorderStartsAt: optionalNullableDate,
  preorderEndsAt: optionalNullableDate,
  estimatedArrivalAt: optionalNullableDate,
  inventory_quantity: optionalNonNegativeInt,
  preorder_slots_total: optionalNonNegativeInt,
  preorder_slots_remaining: optionalNonNegativeInt,
  preorder_starts_at: optionalNullableDate,
  preorder_ends_at: optionalNullableDate,
  estimated_arrival_at: optionalNullableDate,
  image_url: optionalImageUrl,
  images: optionalImageUrls,
});

function hasValidPreorderCapacity(input: {
  preorderSlotsTotal?: number;
  preorderSlotsRemaining?: number;
  preorder_slots_total?: number;
  preorder_slots_remaining?: number;
}): boolean {
  const total = input.preorder_slots_total ?? input.preorderSlotsTotal;
  const remaining = input.preorder_slots_remaining ?? input.preorderSlotsRemaining;
  return (
    total === undefined ||
    remaining === undefined ||
    remaining <= total
  );
}

function hasValidPreorderWindow(input: {
  preorderStartsAt?: string;
  preorderEndsAt?: string;
  preorder_starts_at?: string;
  preorder_ends_at?: string;
}): boolean {
  const startsAt = input.preorder_starts_at ?? input.preorderStartsAt;
  const endsAt = input.preorder_ends_at ?? input.preorderEndsAt;
  if (!startsAt || !endsAt) {
    return true;
  }

  return new Date(startsAt).getTime() < new Date(endsAt).getTime();
}

export const adminCreateProductSchema = adminProductBaseSchema
  .refine(hasValidPreorderCapacity, {
    path: ['preorder_slots_remaining'],
    message: 'Preorder slots remaining cannot exceed total slots',
  })
  .refine(hasValidPreorderWindow, {
    path: ['preorder_ends_at'],
    message: 'Preorder end date must be after preorder start date',
  });

export const adminUpdateProductSchema = adminProductBaseSchema
  .extend({
    is_active: z.boolean().optional(),
  })
  .partial()
  .refine(hasValidPreorderCapacity, {
    path: ['preorder_slots_remaining'],
    message: 'Preorder slots remaining cannot exceed total slots',
  })
  .refine(hasValidPreorderWindow, {
    path: ['preorder_ends_at'],
    message: 'Preorder end date must be after preorder start date',
  })
  .refine(
  (input) => Object.keys(input).length > 0,
  { message: 'At least one field is required' },
  );

export const adminProductParamsSchema = z.object({
  productId: z.string().cuid('Invalid product id'),
});

export const adminOrderQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  date_from: optionalDate,
  date_to: optionalDate,
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const adminOrderParamsSchema = z.object({
  orderId: z.string().cuid('Invalid order id'),
});

export const adminUpdateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

export const adminShipmentQuerySchema = z.object({
  status: z.nativeEnum(ShipmentStatus).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type AdminProductQueryInput = z.infer<typeof adminProductQuerySchema>;
export type AdminCreateProductInput = z.infer<typeof adminCreateProductSchema>;
export type AdminUpdateProductInput = z.infer<typeof adminUpdateProductSchema>;
export type AdminProductParamsInput = z.infer<typeof adminProductParamsSchema>;
export type AdminOrderQueryInput = z.infer<typeof adminOrderQuerySchema>;
export type AdminOrderParamsInput = z.infer<typeof adminOrderParamsSchema>;
export type AdminUpdateOrderStatusInput = z.infer<typeof adminUpdateOrderStatusSchema>;
export type AdminShipmentQueryInput = z.infer<typeof adminShipmentQuerySchema>;
