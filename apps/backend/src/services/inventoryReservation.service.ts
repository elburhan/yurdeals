// ============================================
// Inventory Reservation Service
// ============================================

import {
  InventoryReservationStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  ProductStockType,
} from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils';

interface PaymentEventInput {
  paymentId: string;
  provider: PaymentProvider;
}

interface OrderItemForReservation {
  id: string;
  orderId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  name: string;
  stockTypeSnapshot: ProductStockType;
  product: {
    stockType: ProductStockType;
    inventoryQuantity: number | null;
    preorderSlotsRemaining: number | null;
  };
  inventoryReservation: {
    id: string;
    status: InventoryReservationStatus;
    expiresAt: Date;
  } | null;
}

const ORDER_ITEMS_FOR_RESERVATION_SELECT = {
  id: true,
  orderId: true,
  productId: true,
  variantId: true,
  quantity: true,
  name: true,
  stockTypeSnapshot: true,
  product: {
    select: {
      stockType: true,
      inventoryQuantity: true,
      preorderSlotsRemaining: true,
    },
  },
  inventoryReservation: {
    select: {
      id: true,
      status: true,
      expiresAt: true,
    },
  },
} satisfies Prisma.OrderItemSelect;

export async function reserveOrderInventory(
  tx: Prisma.TransactionClient,
  orderId: string,
  payment: PaymentEventInput,
  reservationWindowMs: number,
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + reservationWindowMs);
  const items = await findOrderItemsForReservation(tx, orderId);

  if (items.length === 0) {
    throw new AppError('Order has no reservable items', 409, 'ORDER_ITEMS_NOT_FOUND');
  }

  for (const item of items) {
    await reserveOrderItem(tx, item, payment, now, expiresAt);
  }
}

export async function confirmOrderInventoryReservations(
  tx: Prisma.TransactionClient,
  orderId: string,
  payment: PaymentEventInput,
): Promise<void> {
  const now = new Date();
  const reservations = await tx.inventoryReservation.findMany({
    where: { orderId },
    select: {
      id: true,
      orderItemId: true,
      productId: true,
      variantId: true,
      quantity: true,
      status: true,
    },
  });

  const activeReservations = reservations.filter(
    (reservation) => reservation.status === InventoryReservationStatus.ACTIVE,
  );

  if (activeReservations.length === 0) {
    const alreadyConfirmed = reservations.every(
      (reservation) => reservation.status === InventoryReservationStatus.CONFIRMED,
    );
    await createReservationPaymentEvent(
      tx,
      payment,
      alreadyConfirmed && reservations.length > 0
        ? 'inventory.reservation_confirmed'
        : 'inventory.reservation_failed',
      {
        orderId,
        alreadyConfirmed: alreadyConfirmed && reservations.length > 0,
        reservationCount: reservations.length,
        reason:
          reservations.length === 0
            ? 'NO_RESERVATIONS_FOUND_ON_PAYMENT_SUCCESS'
            : 'NO_ACTIVE_RESERVATIONS_ON_PAYMENT_SUCCESS',
      },
      PaymentStatus.SUCCESS,
    );
    return;
  }

  await tx.inventoryReservation.updateMany({
    where: {
      id: { in: activeReservations.map((reservation) => reservation.id) },
      status: InventoryReservationStatus.ACTIVE,
    },
    data: {
      status: InventoryReservationStatus.CONFIRMED,
      confirmedAt: now,
      releasedAt: null,
    },
  });

  await createReservationPaymentEvent(tx, payment, 'inventory.reservation_confirmed', {
    orderId,
    reservationCount: activeReservations.length,
    reservations: activeReservations.map(toReservationEventSummary),
  }, PaymentStatus.SUCCESS);
}

export async function releaseOrderInventoryReservations(
  tx: Prisma.TransactionClient,
  orderId: string,
  input: { reason: string; payment?: PaymentEventInput },
): Promise<void> {
  await releaseReservationsByStatus(tx, orderId, InventoryReservationStatus.RELEASED, input);
}

export async function expireOrderInventoryReservations(
  tx: Prisma.TransactionClient,
  orderId: string,
  input: { reason: string; payment?: PaymentEventInput },
): Promise<void> {
  await releaseReservationsByStatus(tx, orderId, InventoryReservationStatus.EXPIRED, input);
}

async function reserveOrderItem(
  tx: Prisma.TransactionClient,
  item: OrderItemForReservation,
  payment: PaymentEventInput,
  now: Date,
  expiresAt: Date,
): Promise<void> {
  const existingReservation = item.inventoryReservation;

  if (existingReservation?.status === InventoryReservationStatus.CONFIRMED) {
    await createReservationPaymentEvent(tx, payment, 'inventory.reservation_confirmed', {
      orderItemId: item.id,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      alreadyConfirmed: true,
    });
    return;
  }

  if (existingReservation?.status === InventoryReservationStatus.ACTIVE) {
    if (existingReservation.expiresAt.getTime() > now.getTime()) {
      await createReservationPaymentEvent(tx, payment, 'inventory.reservation_reused', {
        orderItemId: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        expiresAt: existingReservation.expiresAt.toISOString(),
      });
      return;
    }

    await restoreReservationQuantity(tx, item);
    await tx.inventoryReservation.update({
      where: { id: existingReservation.id },
      data: {
        status: InventoryReservationStatus.EXPIRED,
        releasedAt: now,
      },
    });
    await createReservationPaymentEvent(tx, payment, 'inventory.reservation_expired', {
      orderItemId: item.id,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      reason: 'ACTIVE_RESERVATION_EXPIRED_BEFORE_RETRY',
    });
  }

  await decrementAvailabilityForReservation(tx, item);

  if (existingReservation) {
    await tx.inventoryReservation.update({
      where: { id: existingReservation.id },
      data: {
        status: InventoryReservationStatus.ACTIVE,
        quantity: item.quantity,
        expiresAt,
        confirmedAt: null,
        releasedAt: null,
      },
    });
    await createReservationPaymentEvent(tx, payment, 'inventory.reservation_reactivated', {
      orderItemId: item.id,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      expiresAt: expiresAt.toISOString(),
    });
    return;
  }

  await tx.inventoryReservation.create({
    data: {
      orderId: item.orderId,
      orderItemId: item.id,
      productId: item.productId,
      variantId: item.variantId,
      stockType: item.stockTypeSnapshot ?? item.product.stockType,
      quantity: item.quantity,
      status: InventoryReservationStatus.ACTIVE,
      expiresAt,
    },
  });
  await createReservationPaymentEvent(tx, payment, 'inventory.reservation_created', {
    orderItemId: item.id,
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
    expiresAt: expiresAt.toISOString(),
  });
}

async function releaseReservationsByStatus(
  tx: Prisma.TransactionClient,
  orderId: string,
  nextStatus: 'RELEASED' | 'EXPIRED',
  input: { reason: string; payment?: PaymentEventInput },
): Promise<void> {
  const now = new Date();
  const reservations = await tx.inventoryReservation.findMany({
    where: {
      orderId,
      status: InventoryReservationStatus.ACTIVE,
    },
    select: {
      id: true,
      orderId: true,
      orderItemId: true,
      productId: true,
      variantId: true,
      stockType: true,
      quantity: true,
      orderItem: {
        select: {
          name: true,
          product: {
            select: {
              inventoryQuantity: true,
              preorderSlotsRemaining: true,
            },
          },
        },
      },
    },
  });

  if (reservations.length === 0) {
    if (input.payment) {
      await createReservationPaymentEvent(
        tx,
        input.payment,
        nextStatus === InventoryReservationStatus.EXPIRED
          ? 'inventory.reservation_expired'
          : 'inventory.reservation_released',
        {
          orderId,
          reason: input.reason,
          reservationCount: 0,
        },
      );
    }
    return;
  }

  for (const reservation of reservations) {
    await restoreReservationQuantity(tx, {
      id: reservation.orderItemId,
      productId: reservation.productId,
      orderId: reservation.orderId,
      variantId: reservation.variantId,
      quantity: reservation.quantity,
      name: reservation.orderItem.name,
      stockTypeSnapshot: reservation.stockType,
      product: {
        stockType: reservation.stockType,
        inventoryQuantity: reservation.orderItem.product.inventoryQuantity,
        preorderSlotsRemaining: reservation.orderItem.product.preorderSlotsRemaining,
      },
      inventoryReservation: {
        id: reservation.id,
        status: InventoryReservationStatus.ACTIVE,
        expiresAt: now,
      },
    });
  }

  await tx.inventoryReservation.updateMany({
    where: {
      id: { in: reservations.map((reservation) => reservation.id) },
      status: InventoryReservationStatus.ACTIVE,
    },
    data: {
      status: nextStatus,
      releasedAt: now,
      ...(nextStatus === InventoryReservationStatus.RELEASED ? { confirmedAt: null } : {}),
    },
  });

  if (input.payment) {
    await createReservationPaymentEvent(
      tx,
      input.payment,
      nextStatus === InventoryReservationStatus.EXPIRED
        ? 'inventory.reservation_expired'
        : 'inventory.reservation_released',
      {
        orderId,
        reason: input.reason,
        reservationCount: reservations.length,
        reservations: reservations.map(toReservationEventSummary),
      },
    );
  }
}

async function findOrderItemsForReservation(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<OrderItemForReservation[]> {
  return tx.orderItem.findMany({
    where: { orderId },
    select: ORDER_ITEMS_FOR_RESERVATION_SELECT,
    orderBy: { id: 'asc' },
  });
}

async function decrementAvailabilityForReservation(
  tx: Prisma.TransactionClient,
  item: OrderItemForReservation,
): Promise<void> {
  const stockType = item.stockTypeSnapshot ?? item.product.stockType;

  if (stockType === ProductStockType.IN_STOCK) {
    if (item.variantId) {
      const result = await tx.productVariant.updateMany({
        where: {
          id: item.variantId,
          productId: item.productId,
          stock: { gte: item.quantity },
        },
        data: {
          stock: { decrement: item.quantity },
        },
      });

      if (result.count === 0) {
        throwReservationUnavailable(item, 'VARIANT_STOCK_RESERVATION_FAILED');
      }
      return;
    }

    if (item.product.inventoryQuantity !== null) {
      const result = await tx.product.updateMany({
        where: {
          id: item.productId,
          inventoryQuantity: { gte: item.quantity },
        },
        data: {
          inventoryQuantity: { decrement: item.quantity },
        },
      });

      if (result.count === 0) {
        throwReservationUnavailable(item, 'PRODUCT_INVENTORY_RESERVATION_FAILED');
      }
    }
    return;
  }

  if (item.product.preorderSlotsRemaining !== null) {
    const result = await tx.product.updateMany({
      where: {
        id: item.productId,
        preorderSlotsRemaining: { gte: item.quantity },
      },
      data: {
        preorderSlotsRemaining: { decrement: item.quantity },
      },
    });

    if (result.count === 0) {
      throwReservationUnavailable(item, 'PREORDER_SLOT_RESERVATION_FAILED');
    }
  }
}

async function restoreReservationQuantity(
  tx: Prisma.TransactionClient,
  item: OrderItemForReservation,
): Promise<void> {
  const stockType = item.stockTypeSnapshot ?? item.product.stockType;

  if (stockType === ProductStockType.IN_STOCK) {
    if (item.variantId) {
      await tx.productVariant.updateMany({
        where: {
          id: item.variantId,
          productId: item.productId,
        },
        data: {
          stock: { increment: item.quantity },
        },
      });
      return;
    }

    await tx.product.updateMany({
      where: {
        id: item.productId,
        inventoryQuantity: { not: null },
      },
      data: {
        inventoryQuantity: { increment: item.quantity },
      },
    });
    return;
  }

  await tx.product.updateMany({
    where: {
      id: item.productId,
      preorderSlotsRemaining: { not: null },
    },
    data: {
      preorderSlotsRemaining: { increment: item.quantity },
    },
  });
}

async function createReservationPaymentEvent(
  tx: Prisma.TransactionClient,
  payment: PaymentEventInput,
  eventType: string,
  payload: Prisma.InputJsonValue,
  status: PaymentStatus = PaymentStatus.PENDING,
): Promise<void> {
  await tx.paymentEvent.create({
    data: {
      paymentId: payment.paymentId,
      provider: payment.provider,
      eventType,
      status,
      payload,
    },
  });
}

function throwReservationUnavailable(item: OrderItemForReservation, reason: string): never {
  logger.warn('Inventory reservation failed', {
    productId: item.productId,
    variantId: item.variantId,
    orderItemId: item.id,
    quantity: item.quantity,
    reason,
  });

  throw new AppError(
    `"${item.name}" is no longer available in the requested quantity. Please refresh your cart and try again.`,
    409,
    reason,
  );
}

function toReservationEventSummary(reservation: {
  id?: string;
  orderItemId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
}): Prisma.InputJsonValue {
  return {
    reservationId: reservation.id ?? null,
    orderItemId: reservation.orderItemId,
    productId: reservation.productId,
    variantId: reservation.variantId,
    quantity: reservation.quantity,
  };
}
