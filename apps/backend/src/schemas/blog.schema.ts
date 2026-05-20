// ============================================
// Blog Validation Schemas
// ============================================

import { z } from 'zod';

const slugSchema = z.string().trim().min(1).max(160);
const urlSchema = z
  .string()
  .trim()
  .url('URL must be valid')
  .max(2048)
  .optional()
  .or(z.literal('').transform(() => undefined));
const optionalCategoryId = z.string().cuid('Invalid category id').optional();
const tagsSchema = z.array(z.string().trim().min(1).max(60)).max(12);
const blogPostStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

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

export const adminBlogPostParamsSchema = z.object({
  postId: z.string().cuid('Invalid blog post id'),
});

export const adminBlogPostQuerySchema = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'all']).optional().default('all'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

const adminBlogPostBaseShape = {
  title: z.string().trim().min(3).max(180),
  slug: slugSchema
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be URL-safe')
    .optional(),
  excerpt: z.string().trim().min(10).max(500),
  content: z.string().trim().min(20).max(50000),
  category_id: optionalCategoryId,
  category_name: z.string().trim().min(2).max(80).optional(),
  tags: tagsSchema.optional(),
  featured: z.boolean().optional(),
  status: blogPostStatusSchema.optional(),
  cover_image: urlSchema,
  seo_title: z.string().trim().max(180).optional().or(z.literal('').transform(() => undefined)),
  seo_description: z
    .string()
    .trim()
    .max(300)
    .optional()
    .or(z.literal('').transform(() => undefined)),
};

export const adminCreateBlogPostSchema = z.object(adminBlogPostBaseShape).refine(
  (input) => !input.category_id || !input.category_name,
  {
    path: ['category_name'],
    message: 'Use either category id or category name, not both',
  },
);

export const adminUpdateBlogPostSchema = z
  .object(adminBlogPostBaseShape)
  .partial()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one field is required',
  })
  .refine((input) => !input.category_id || !input.category_name, {
    path: ['category_name'],
    message: 'Use either category id or category name, not both',
  });

export type BlogQueryInput = z.infer<typeof blogQuerySchema>;
export type FeaturedBlogQueryInput = z.infer<typeof featuredBlogQuerySchema>;
export type BlogParamsInput = z.infer<typeof blogParamsSchema>;
export type AdminBlogPostParamsInput = z.infer<typeof adminBlogPostParamsSchema>;
export type AdminBlogPostQueryInput = z.infer<typeof adminBlogPostQuerySchema>;
export type AdminCreateBlogPostInput = z.infer<typeof adminCreateBlogPostSchema>;
export type AdminUpdateBlogPostInput = z.infer<typeof adminUpdateBlogPostSchema>;
