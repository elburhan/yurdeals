// ============================================
// Tracking Validation Schemas
// ============================================

import { z } from 'zod';

export const orderTrackingParamsSchema = z.object({
  orderId: z.string({ required_error: 'Order id is required' }).cuid('Invalid order id'),
});

export type OrderTrackingParamsInput = z.infer<typeof orderTrackingParamsSchema>;
