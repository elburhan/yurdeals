// ============================================
// Transfer Service (Admin/Internal Only)
// ============================================

import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils';
import {
  CreateTransferRecipientInput,
  InitiateTransferInput,
  PaystackGateway,
  TransferRecord,
  TransferRecipientResult,
} from './payment-gateways/paystack.gateway';
import { transferRepository } from '../repositories/transfer.repository';

const paystackGateway = new PaystackGateway();

export async function createTransferRecipient(
  input: CreateTransferRecipientInput,
  actor?: { userId?: string | null },
): Promise<TransferRecipientResult> {
  const result = await paystackGateway.createTransferRecipient(input);

  await transferRepository.recordAudit({
    userId: actor?.userId ?? null,
    action: 'TRANSFER_RECIPIENT_CREATED',
    reference: result.recipientCode,
    payload: {
      type: result.type,
      name: result.name,
      currency: result.currency,
      active: result.active,
      details: result.details,
    },
  });

  return result;
}

export async function initiateSupplierTransfer(
  input: InitiateTransferInput,
  actor?: { userId?: string | null },
): Promise<TransferRecord> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new AppError('Transfer amount must be greater than zero.', 422, 'INVALID_TRANSFER_AMOUNT');
  }

  const result = await paystackGateway.initiateTransfer(input);

  await transferRepository.recordAudit({
    userId: actor?.userId ?? null,
    action: 'TRANSFER_INITIATED',
    reference: result.reference,
    payload: {
      transferCode: result.transferCode,
      amount: result.amount,
      currency: result.currency,
      recipientCode: result.recipientCode,
      recipientName: result.recipientName,
      status: result.status,
      source: result.source,
      reason: result.reason,
    },
  });

  return result;
}

export async function fetchSupplierTransfer(referenceOrId: string): Promise<{
  transfer: TransferRecord;
  auditTrail: Array<{
    id: string;
    action: string;
    createdAt: string;
    userId: string | null;
    payload: unknown;
  }>;
}> {
  const transfer = await paystackGateway.fetchTransfer(referenceOrId);
  const auditTrail = await transferRepository.listAuditTrail(transfer.reference);

  return {
    transfer,
    auditTrail: auditTrail.map((entry) => ({
      id: entry.id,
      action: entry.action,
      createdAt: entry.createdAt.toISOString(),
      userId: entry.userId,
      payload: entry.newData,
    })),
  };
}

export async function handlePaystackTransferWebhook(
  rawBody: Buffer,
  headers: Record<string, string>,
): Promise<{ accepted: true; eventType: string; reference: string; status: string }> {
  if (!paystackGateway.verifyWebhookSignature(rawBody, headers)) {
    throw new AppError('Invalid webhook signature', 401, 'INVALID_WEBHOOK_SIGNATURE');
  }

  const event = paystackGateway.parseTransferWebhookEvent(rawBody);

  // Scaffolding only: record and surface transfer events without attaching them to
  // customer order flows. This keeps supplier payouts internal until ops workflows land.
  await transferRepository.recordAudit({
    action:
      event.eventType === 'transfer.success'
        ? 'TRANSFER_WEBHOOK_SUCCESS'
        : event.eventType === 'transfer.failed'
          ? 'TRANSFER_WEBHOOK_FAILED'
          : 'TRANSFER_WEBHOOK_RECEIVED',
    reference: event.reference,
    payload: {
      eventType: event.eventType,
      status: event.status,
      amount: event.amount,
      currency: event.currency,
      transferCode: event.transferCode,
      recipientCode: event.recipientCode,
      reason: event.reason,
      source: event.source,
      occurredAt: event.occurredAt,
      raw: event.raw,
    },
  });

  logger.info('Paystack transfer webhook processed', {
    reference: event.reference,
    eventType: event.eventType,
    status: event.status,
    transferCode: event.transferCode,
  });

  return {
    accepted: true,
    eventType: event.eventType,
    reference: event.reference,
    status: event.status,
  };
}

export function isPaystackTransferWebhook(rawBody: Buffer): boolean {
  try {
    const parsed = JSON.parse(rawBody.toString('utf8')) as { event?: string };
    return parsed.event === 'transfer.success' || parsed.event === 'transfer.failed';
  } catch (error) {
    logger.warn('Unable to inspect Paystack webhook event type', {
      error: error instanceof Error ? error.message : 'Unknown webhook parse error',
    });
    return false;
  }
}
