// ============================================
// Cart Validation Schemas
// ============================================

import { z } from 'zod';

const quantitySchema = z.coerce
  .number({ required_error: 'Quantity is required' })
  .int('Quantity must be a whole number')
  .min(1, 'Quantity must be at least 1')
  .max(99, 'Quantity must be at most 99');

export const addCartItemSchema = z.object({
  product_id: z.string({ required_error: 'Product id is required' }).cuid('Invalid product id'),
  variant_id: z.string().cuid('Invalid variant id').optional(),
  quantity: quantitySchema,
});

export const updateCartItemSchema = z.object({
  quantity: quantitySchema,
});

export const cartItemParamsSchema = z.object({
  cartItemId: z.string().cuid('Invalid cart item id'),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type CartItemParamsInput = z.infer<typeof cartItemParamsSchema>;
