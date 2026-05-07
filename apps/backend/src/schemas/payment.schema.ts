// ============================================
// Payment Validation Schemas
// ============================================

import { z } from 'zod';

export const initiatePaymentSchema = z.object({
  provider: z.enum(['PAYSTACK', 'FLUTTERWAVE'], {
    required_error: 'Payment provider is required',
  }),
});

export const initiateGuestPaymentSchema = initiatePaymentSchema.extend({
  guest_access_token: z.string().min(20).max(120),
});

export const orderPaymentParamsSchema = z.object({
  orderId: z.string().cuid('Invalid order id'),
});

export const paymentStatusParamsSchema = z.object({
  orderId: z.string().cuid('Invalid order id'),
  paymentId: z.string().cuid('Invalid payment id'),
});

export const guestPaymentStatusQuerySchema = z.object({
  guest_access_token: z.string().min(20).max(120),
});

export const webhookProviderParamsSchema = z.object({
  provider: z.enum(['paystack', 'flutterwave']),
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
export type InitiateGuestPaymentInput = z.infer<typeof initiateGuestPaymentSchema>;
export type OrderPaymentParamsInput = z.infer<typeof orderPaymentParamsSchema>;
export type PaymentStatusParamsInput = z.infer<typeof paymentStatusParamsSchema>;
export type GuestPaymentStatusQueryInput = z.infer<typeof guestPaymentStatusQuerySchema>;
export type WebhookProviderParamsInput = z.infer<typeof webhookProviderParamsSchema>;
