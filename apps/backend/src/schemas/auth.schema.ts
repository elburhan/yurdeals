// ============================================
// Auth Validation Schemas
// ============================================

import { z } from 'zod';

const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  );

const optionalEmail = z
  .string()
  .trim()
  .email('Invalid email address')
  .max(255, 'Email must be at most 255 characters')
  .transform((email) => email.toLowerCase())
  .optional()
  .or(z.literal('').transform(() => undefined));

const phoneSchema = z
  .string({ required_error: 'Phone number is required' })
  .trim()
  .min(7, 'Phone must be at least 7 characters')
  .max(20, 'Phone must be at most 20 characters');

export const registerSchema = z
  .object({
    email: optionalEmail,
    password: passwordSchema,
    name: z
      .string({ required_error: 'Name is required' })
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(200, 'Name must be at most 200 characters'),
    phone: phoneSchema,
  })
  .refine((input) => input.phone.trim().length > 0, {
    path: ['phone'],
    message: 'Phone number is required',
  });

export const loginSchema = z.object({
  identifier: z
    .string({ required_error: 'Email or phone is required' })
    .trim()
    .min(3, 'Email or phone is required')
    .max(255, 'Email or phone must be at most 255 characters'),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
