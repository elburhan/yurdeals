// ============================================
// Catalog Validation Schemas
// ============================================

import { z } from 'zod';

const optionalCuid = z.string().cuid('Invalid id').optional();
const slugOrIdSchema = z.string().trim().min(1).max(120);

const booleanQuery = z
  .preprocess(
    (value) => {
      if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
      }

      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === '' ? undefined : normalized;
      }

      return undefined;
    },
    z.enum(['true', 'false']).optional(),
  )
  .transform((value) => (value === undefined ? undefined : value === 'true'));

export const categoryQuerySchema = z.object({
  parent_id: optionalCuid,
  active: booleanQuery,
});

export const categoryParamsSchema = z.object({
  slug: slugOrIdSchema,
});

export const productQuerySchema = z
  .object({
    category: slugOrIdSchema.optional(),
    category_id: optionalCuid,
    search: z.string().trim().min(1).max(100).optional(),
    stockType: z.enum(['IN_STOCK', 'PREORDER']).optional(),
    preorder: booleanQuery,
    available_in_nigeria: booleanQuery,
    isFeatured: booleanQuery,
    isPublished: booleanQuery,
    min_price: z.coerce.number().nonnegative().optional(),
    max_price: z.coerce.number().nonnegative().optional(),
    sort: z
      .enum(['newest', 'price', 'price_asc', 'price_desc', 'featured', 'name_asc', 'trending'])
      .optional()
      .default('newest'),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(24).optional().default(12),
  })
  .refine(
    (query) =>
      query.min_price === undefined ||
      query.max_price === undefined ||
      query.min_price <= query.max_price,
    {
      path: ['min_price'],
      message: 'Minimum price must be less than or equal to maximum price',
    },
  );

export const productParamsSchema = z.object({
  slug: slugOrIdSchema,
});

export const productCollectionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(24).optional().default(8),
});

export type CategoryQueryInput = z.infer<typeof categoryQuerySchema>;
export type CategoryParamsInput = z.infer<typeof categoryParamsSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type ProductParamsInput = z.infer<typeof productParamsSchema>;
export type ProductCollectionQueryInput = z.infer<typeof productCollectionQuerySchema>;
