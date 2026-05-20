// ============================================
// Order Validation Schemas
// ============================================

import { z } from 'zod';
import {
  hasOperationalAddressText,
  isValidNigeriaLga,
  isValidNigeriaState,
} from '../utils/nigeriaAddressValidation';

export const createOrderSchema = z.object({
  address_id: z.string({ required_error: 'Address id is required' }).cuid('Invalid address id'),
  notes: z.string().trim().max(500, 'Notes must be at most 500 characters').optional(),
});

const guestCartItemSchema = z.object({
  product_id: z.string({ required_error: 'Product id is required' }).cuid('Invalid product id'),
  variant_id: z.string().cuid('Invalid variant id').optional(),
  quantity: z.coerce.number().int().min(1).max(99),
});

export const createGuestOrderSchema = z.object({
  guest: z.object({
    full_name: z.string().trim().min(2).max(200),
    phone: z.string().trim().min(7).max(20),
    email: z
      .string({ required_error: 'Email is required' })
      .trim()
      .min(1, 'Email is required')
      .email('Enter a valid email address')
      .max(255),
    state: z.string().trim().min(2).max(80).refine(isValidNigeriaState, 'Select a valid Nigerian state'),
    lga: z.string().trim().min(2, 'LGA is required').max(120),
    city: z.string().trim().min(2).max(80),
    area: z
      .string()
      .trim()
      .min(3, 'Area or district must be more descriptive')
      .max(120)
      .refine((value) => hasOperationalAddressText(value, 3), 'Area or district is too vague for delivery'),
    street: z
      .string()
      .trim()
      .min(5, 'Street address must be more descriptive')
      .max(240)
      .refine((value) => hasOperationalAddressText(value, 5), 'Street address is too vague for delivery'),
    landmark: z
      .string()
      .trim()
      .min(8, 'Landmark must be more descriptive')
      .max(180)
      .refine((value) => hasOperationalAddressText(value, 8), 'Landmark is too vague for delivery'),
    address_line: z.string().trim().min(5).max(240).optional(),
    delivery_notes: z.string().trim().max(240).optional(),
    preferred_contact_method: z.enum(['WHATSAPP', 'SMS', 'CALL']).default('WHATSAPP'),
  }),
  items: z.array(guestCartItemSchema).min(1, 'Cart is empty'),
  notes: z.string().trim().max(300, 'Notes must be at most 300 characters').optional(),
}).superRefine((input, context) => {
  if (!isValidNigeriaLga(input.guest.state, input.guest.lga)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['guest', 'lga'],
      message: 'Select a valid LGA for the selected state',
    });
  }
});

export const guestOrderTokenSchema = z.object({
  guest_access_token: z.string().min(20).max(120),
});

export const orderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
});

export const orderParamsSchema = z.object({
  orderId: z.string().cuid('Invalid order id'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CreateGuestOrderInput = z.infer<typeof createGuestOrderSchema>;
export type GuestOrderTokenInput = z.infer<typeof guestOrderTokenSchema>;
export type OrderQueryInput = z.infer<typeof orderQuerySchema>;
export type OrderParamsInput = z.infer<typeof orderParamsSchema>;
