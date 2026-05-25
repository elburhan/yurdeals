import { InventoryReservationStatus, PaymentStatus, PaymentProvider } from '@prisma/client';
import { prisma } from '../src/config';
import { expireOrderInventoryReservations } from '../src/services/inventoryReservation.service';
import { logger } from '../src/utils';
import { captureAndFlushException, initSentry } from '../src/observability/sentry';

initSentry();

interface ExpireReservationsResult {
  runId: string;
  scannedOrders: number;
  expiredOrders: number;
  expiredReservations: number;
}

async function main(): Promise<void> {
  const runId = `reservation-expiry-${Date.now().toString(36)}`;
  const now = new Date();

  const staleReservations = await prisma.inventoryReservation.findMany({
    where: {
      status: InventoryReservationStatus.ACTIVE,
      expiresAt: { lte: now },
      order: {
        status: 'PENDING',
      },
    },
    select: {
      id: true,
      orderId: true,
    },
    orderBy: { expiresAt: 'asc' },
  });

  const reservationCountByOrder = staleReservations.reduce<Map<string, number>>((counts, reservation) => {
    counts.set(reservation.orderId, (counts.get(reservation.orderId) ?? 0) + 1);
    return counts;
  }, new Map());

  const result: ExpireReservationsResult = {
    runId,
    scannedOrders: reservationCountByOrder.size,
    expiredOrders: 0,
    expiredReservations: 0,
  };

  logger.info('Reservation expiry run started', {
    runId,
    staleOrders: result.scannedOrders,
    staleReservations: staleReservations.length,
  });

  for (const [orderId, reservationCount] of reservationCountByOrder.entries()) {
    await prisma.$transaction(async (tx) => {
      const latestPayment = await tx.payment.findFirst({
        where: {
          orderId,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED] },
        },
        select: {
          id: true,
          provider: true,
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      });

      await expireOrderInventoryReservations(tx, orderId, {
        reason: 'SCHEDULED_RESERVATION_EXPIRY',
        payment: latestPayment
          ? {
              paymentId: latestPayment.id,
              provider: latestPayment.provider as PaymentProvider,
            }
          : undefined,
      });
    });

    result.expiredOrders += 1;
    result.expiredReservations += reservationCount;
  }

  logger.info('Reservation expiry run finished', {
    runId: result.runId,
    scannedOrders: result.scannedOrders,
    expiredOrders: result.expiredOrders,
    expiredReservations: result.expiredReservations,
  });
}

main()
  .catch(async (error: unknown) => {
    await captureAndFlushException(error, { source: 'reservations_expire_script' });
    logger.error('Reservation expiry script failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
