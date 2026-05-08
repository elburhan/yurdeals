// ============================================
// Tracking Validation Schemas
// ============================================

import { z } from 'zod';

export const orderTrackingParamsSchema = z.object({
  orderId: z.string({ required_error: 'Order id is required' }).cuid('Invalid order id'),
});

const NIGERIAN_PHONE_ERROR =
  'Enter a valid Nigerian phone number, for example 08012345678 or +2348012345678.';

export function normalizeNigerianPhoneNumber(value: string): string | null {
  const compact = value.replace(/[^\d+]/g, '');

  if (/^0\d{10}$/.test(compact)) {
    return isSupportedNigerianMobileLocal(compact) ? `+234${compact.slice(1)}` : null;
  }

  if (/^\+234\d{10}$/.test(compact)) {
    const localFormat = `0${compact.slice(4)}`;
    return isSupportedNigerianMobileLocal(localFormat) ? compact : null;
  }

  if (/^234\d{10}$/.test(compact)) {
    const normalized = `+${compact}`;
    const localFormat = `0${compact.slice(3)}`;
    return isSupportedNigerianMobileLocal(localFormat) ? normalized : null;
  }

  return null;
}

export const publicOrderTrackingQuerySchema = z.object({
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .transform((value, ctx) => {
      const normalized = normalizeNigerianPhoneNumber(value);
      if (!normalized) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: NIGERIAN_PHONE_ERROR,
        });
        return z.NEVER;
      }

      return normalized;
    }),
  orderNumber: z.string().trim().min(3).max(80).optional(),
});

export type OrderTrackingParamsInput = z.infer<typeof orderTrackingParamsSchema>;
export type PublicOrderTrackingQueryInput = z.infer<typeof publicOrderTrackingQuerySchema>;

function isSupportedNigerianMobileLocal(value: string): boolean {
  return /^0(?:70|71|80|81|90|91)\d{8}$/.test(value);
}
