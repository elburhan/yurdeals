// ============================================
// Auth Validation Schemas
// ============================================

import { z } from 'zod';
import { normalizeEmail, normalizePhone } from '../utils';

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
  .transform((email) => normalizeEmail(email))
  .optional()
  .or(z.literal('').transform(() => undefined));

const phoneSchema = z
  .string({ required_error: 'Phone number is required' })
  .trim()
  .min(7, 'Phone must be at least 7 characters')
  .max(20, 'Phone must be at most 20 characters')
  .transform((phone) => normalizePhone(phone));

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
  .strict()
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
}).strict();

export const otpChannelSchema = z.enum(['EMAIL', 'PHONE']);

const verificationLocatorFields = {
  verificationSessionId: z
    .string()
    .trim()
    .min(1, 'Verification session is required')
    .max(255, 'Verification session is invalid')
    .optional(),
  identifier: z
    .string()
    .trim()
    .min(3, 'Email or phone is required')
    .max(255, 'Email or phone must be at most 255 characters')
    .optional(),
};

export const verifyOtpSchema = z.object({
  ...verificationLocatorFields,
  channel: otpChannelSchema,
  otp: z
    .string({ required_error: 'OTP is required' })
    .trim()
    .regex(/^\d{6}$/, 'OTP must be a 6-digit code'),
}).strict().refine((input) => Boolean(input.verificationSessionId || input.identifier), {
  path: ['verificationSessionId'],
  message: 'Provide a verification session or identifier',
});

export const resendOtpSchema = z.object({
  ...verificationLocatorFields,
  channel: otpChannelSchema,
}).strict().refine((input) => Boolean(input.verificationSessionId || input.identifier), {
  path: ['verificationSessionId'],
  message: 'Provide a verification session or identifier',
});

export const devOtpLookupQuerySchema = z.object({
  verificationSessionId: z.string().trim().min(1).max(255).optional(),
  identifier: z.string().trim().min(3).max(255).optional(),
  channel: otpChannelSchema.optional(),
}).strict().refine((input) => Boolean(input.verificationSessionId || input.identifier), {
  path: ['verificationSessionId'],
  message: 'Provide a verification session or identifier',
}).refine((input) => input.verificationSessionId || (input.identifier && input.channel), {
  path: ['channel'],
  message: 'Channel is required when using identifier lookup',
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OtpChannelInput = z.infer<typeof otpChannelSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;
export type DevOtpLookupQueryInput = z.infer<typeof devOtpLookupQuerySchema>;
