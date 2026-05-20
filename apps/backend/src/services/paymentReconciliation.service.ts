// ============================================
// Payment Reconciliation Service
// ============================================

import { PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { env } from '../config';
import {
  paymentRepository,
  PaymentReconciliationCandidate,
} from '../repositories/payment.repository';
import { logger } from '../utils';
import { verifyPaymentRecordForReconciliation } from './payment.service';

export interface PaymentReconciliationOptions {
  thresholdMinutes?: number;
  limit?: number;
}

export interface PaymentReconciliationResult {
  runId: string;
  thresholdMinutes: number;
  scanned: number;
  verifiedSuccess: number;
  verifiedFailed: number;
  stillPending: number;
  skippedAlreadyFinal: number;
  missingReference: number;
  failures: number;
}

export async function reconcilePendingPaystackPayments(
  options: PaymentReconciliationOptions = {},
): Promise<PaymentReconciliationResult> {
  const thresholdMinutes =
    options.thresholdMinutes ?? env.PAYMENT_RECONCILIATION_THRESHOLD_MINUTES;
  const limit = options.limit ?? env.PAYMENT_RECONCILIATION_BATCH_SIZE;
  const runId = `payment-reconciliation-${Date.now().toString(36)}`;
  const olderThan = new Date(Date.now() - thresholdMinutes * 60 * 1000);

  const candidates = await paymentRepository.findPendingPaymentsForReconciliation({
    olderThan,
    limit,
  });

  const result: PaymentReconciliationResult = {
    runId,
    thresholdMinutes,
    scanned: candidates.length,
    verifiedSuccess: 0,
    verifiedFailed: 0,
    stillPending: 0,
    skippedAlreadyFinal: 0,
    missingReference: 0,
    failures: 0,
  };

  logger.info('Payment reconciliation run started', {
    runId,
    thresholdMinutes,
    limit,
    candidates: candidates.length,
  });

  for (const payment of candidates) {
    await reconcilePaymentCandidate(payment, result);
  }

  logger.info('Payment reconciliation run finished', { ...result });
  return result;
}

async function reconcilePaymentCandidate(
  payment: PaymentReconciliationCandidate,
  result: PaymentReconciliationResult,
): Promise<void> {
  const reference = payment.providerRef || payment.reference;

  if (!reference) {
    result.missingReference += 1;
    await recordReconciliationEvent(payment, 'payment.reconciliation_failed', PaymentStatus.PENDING, {
      runId: result.runId,
      reason: 'MISSING_PROVIDER_REFERENCE',
    });
    logger.warn('Payment reconciliation skipped missing provider reference', {
      runId: result.runId,
      paymentId: payment.id,
      orderId: payment.orderId,
      provider: payment.provider,
    });
    return;
  }

  await recordReconciliationEvent(payment, 'payment.reconciliation_started', payment.status, {
    runId: result.runId,
    reference,
    previousStatus: payment.status,
    orderId: payment.orderId,
  });

  try {
    const verification = await verifyPaymentRecordForReconciliation(payment);
    const nextStatus = verification.payment.status;

    await recordReconciliationEvent(
      payment,
      'payment.reconciliation_verified',
      nextStatus as PaymentStatus,
      {
        runId: result.runId,
        reference,
        previousStatus: payment.status,
        nextStatus,
        orderId: payment.orderId,
      },
    );

    if (nextStatus === PaymentStatus.SUCCESS) {
      result.verifiedSuccess += 1;
      return;
    }

    if (nextStatus === PaymentStatus.FAILED || nextStatus === PaymentStatus.ABANDONED) {
      result.verifiedFailed += 1;
      await recordReconciliationEvent(
        payment,
        'payment.reconciliation_released',
        nextStatus as PaymentStatus,
        {
          runId: result.runId,
          reference,
          reason: 'PAYMENT_NOT_SUCCESSFUL',
          orderId: payment.orderId,
        },
      );
      return;
    }

    if (nextStatus === payment.status) {
      result.stillPending += 1;
      return;
    }

    result.skippedAlreadyFinal += 1;
  } catch (error) {
    result.failures += 1;
    await recordReconciliationEvent(payment, 'payment.reconciliation_failed', payment.status, {
      runId: result.runId,
      reference,
      reason: error instanceof Error ? error.message : 'UNKNOWN_RECONCILIATION_ERROR',
      orderId: payment.orderId,
    });
    logger.warn('Payment reconciliation candidate failed', {
      runId: result.runId,
      paymentId: payment.id,
      orderId: payment.orderId,
      provider: payment.provider,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function recordReconciliationEvent(
  payment: PaymentReconciliationCandidate,
  eventType: string,
  status: PaymentStatus,
  payload: Record<string, unknown>,
): Promise<void> {
  await paymentRepository.recordPaymentEvent({
    paymentId: payment.id,
    provider: payment.provider as PaymentProvider,
    eventType,
    status,
    payload: payload as Prisma.InputJsonObject,
  });
}
