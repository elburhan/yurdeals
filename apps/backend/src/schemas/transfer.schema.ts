import { z } from 'zod';

export const createTransferRecipientSchema = z.object({
  type: z.enum(['nuban', 'mobile_money', 'basa']).default('nuban'),
  name: z.string().trim().min(2).max(120),
  accountNumber: z.string().trim().min(6).max(20),
  bankCode: z.string().trim().min(2).max(20),
  currency: z.string().trim().min(3).max(3).default('NGN'),
  description: z.string().trim().max(240).optional(),
});

export const initiateTransferSchema = z.object({
  amount: z.number().positive(),
  recipientCode: z.string().trim().min(3).max(120),
  reason: z.string().trim().max(240).optional(),
  reference: z.string().trim().min(6).max(120),
  source: z.enum(['balance']).default('balance'),
});

export const transferParamsSchema = z.object({
  referenceOrId: z.string().trim().min(1),
});

export type CreateTransferRecipientInput = z.infer<typeof createTransferRecipientSchema>;
export type InitiateTransferSchemaInput = z.infer<typeof initiateTransferSchema>;
export type TransferParamsInput = z.infer<typeof transferParamsSchema>;
