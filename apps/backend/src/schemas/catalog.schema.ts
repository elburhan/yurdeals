// ============================================
// Catalog Validation Schemas
// ============================================

import { z } from 'zod';

const optionalCuid = z.string().cuid('Invalid id').optional();

const booleanQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

export const categoryQuerySchema = z.object({
  parent_id: optionalCuid,
});

export const productQuerySchema = z
  .object({
    category_id: optionalCuid,
    search: z.string().trim().min(1).max(100).optional(),
    preorder: booleanQuery,
    available_in_nigeria: booleanQuery,
    min_price: z.coerce.number().nonnegative().optional(),
    max_price: z.coerce.number().nonnegative().optional(),
    sort: z
      .enum(['newest', 'price_asc', 'price_desc', 'featured', 'name_asc'])
      .optional()
      .default('newest'),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(12),
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
  id: z.string().cuid('Invalid product id'),
});

export type CategoryQueryInput = z.infer<typeof categoryQuerySchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type ProductParamsInput = z.infer<typeof productParamsSchema>;
