// ============================================
// Blog Validation Schemas
// ============================================

import { z } from 'zod';

const slugSchema = z.string().trim().min(1).max(160);

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

export const blogQuerySchema = z.object({
  category: slugSchema.optional(),
  tag: z.string().trim().min(1).max(80).optional(),
  featured: booleanQuery,
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(24).optional().default(9),
});

export const featuredBlogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(12).optional().default(3),
});

export const blogParamsSchema = z.object({
  slug: slugSchema,
});

export type BlogQueryInput = z.infer<typeof blogQuerySchema>;
export type FeaturedBlogQueryInput = z.infer<typeof featuredBlogQuerySchema>;
export type BlogParamsInput = z.infer<typeof blogParamsSchema>;
