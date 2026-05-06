// ============================================
// Admin Validation Schemas
// ============================================

import { OrderStatus, ProductStockType, ShipmentStatus } from '@prisma/client';
import { z } from 'zod';

const optionalCuid = z.string().cuid('Invalid id').optional();
const optionalDate = z.string().datetime('Invalid date').optional();
const optionalImageUrl = z
  .string()
  .trim()
  .url('Image URL must be a valid URL')
  .max(2048, 'Image URL must be at most 2048 characters')
  .optional()
  .or(z.literal('').transform(() => undefined));

export const adminProductQuerySchema = z.object({
  status: z.enum(['active', 'inactive', 'all']).optional().default('all'),
  category_id: optionalCuid,
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const adminCreateProductSchema = z.object({
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
  image_url: optionalImageUrl,
});

export const adminUpdateProductSchema = adminCreateProductSchema
  .extend({
    is_active: z.boolean().optional(),
  })
  .partial()
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
