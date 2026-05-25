import { reconcilePendingPaystackPayments } from '../src/services/paymentReconciliation.service';
import { logger } from '../src/utils';
import { prisma } from '../src/config';
import { captureAndFlushException, initSentry } from '../src/observability/sentry';

initSentry();

async function main(): Promise<void> {
  const result = await reconcilePendingPaystackPayments();
  logger.info('Payment reconciliation script completed', {
    runId: result.runId,
    thresholdMinutes: result.thresholdMinutes,
    scanned: result.scanned,
    verifiedSuccess: result.verifiedSuccess,
    verifiedFailed: result.verifiedFailed,
    stillPending: result.stillPending,
    skippedAlreadyFinal: result.skippedAlreadyFinal,
    missingReference: result.missingReference,
    failures: result.failures,
  });
}

main()
  .catch(async (error: unknown) => {
    await captureAndFlushException(error, { source: 'payments_reconcile_script' });
    logger.error('Payment reconciliation script failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
