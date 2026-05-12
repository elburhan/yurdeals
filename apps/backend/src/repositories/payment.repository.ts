// ============================================
// Payment Repository
// ============================================

import { OrderStatus, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { PaymentSummary } from '@yurdeals/shared';
import { prisma } from '../config';
import { AppError } from '../middleware/errorHandler';
import { ProviderEvent } from '../services/payment-gateways/paymentGateway.types';
import { mapPayment } from './order.repository';
import {
  confirmOrderInventoryReservations,
  releaseOrderInventoryReservations,
  reserveOrderInventory,
} from '../services/inventoryReservation.service';

export const PENDING_PAYMENT_STALE_WINDOW_MS = 30 * 60 * 1000;

const PAYMENT_SELECT = {
  id: true,
  orderId: true,
  provider: true,
  status: true,
  reference: true,
  providerRef: true,
  providerTransactionId: true,
  authorizationUrl: true,
  accessCode: true,
  authorizationCode: true,
  customerEmail: true,
  amount: true,
  amountCaptured: true,
  amountRefunded: true,
  fees: true,
  currency: true,
  channel: true,
  gatewayResponse: true,
  paidAt: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaymentSelect;

const ORDER_PAYMENT_SELECT = {
  id: true,
  orderNumber: true,
  userId: true,
  status: true,
  total: true,
  currency: true,
  notes: true,
  user: {
    select: {
      email: true,
      firstName: true,
      lastName: true,
    },
  },
  payments: {
    select: PAYMENT_SELECT,
    orderBy: { createdAt: 'desc' },
    take: 20,
  },
} satisfies Prisma.OrderSelect;

const VERIFIABLE_PAYMENT_SELECT = {
  ...PAYMENT_SELECT,
  order: {
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      total: true,
      currency: true,
      status: true,
      notes: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  },
} satisfies Prisma.PaymentSelect;

type OrderForPayment = Prisma.OrderGetPayload<{ select: typeof ORDER_PAYMENT_SELECT }>;
type OrderPaymentRecord = OrderForPayment['payments'][number];
export type VerifiablePaymentRecord = Prisma.PaymentGetPayload<{
  select: typeof VERIFIABLE_PAYMENT_SELECT;
}>;

interface OrderForAuthorizationCharge {
  id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  total: Prisma.Decimal;
  currency: string;
  user: {
    email: string;
  };
  payments: Array<{
    id: string;
    status: PaymentStatus;
  }>;
}

interface StoredPaystackAuthorization {
  paymentId: string;
  authorizationCode: string;
  customerEmail: string | null;
}

export interface CreatedPaymentResult {
  order: OrderForPayment;
  payment: PaymentSummary;
}

export interface PreparedPaymentAttemptResult extends CreatedPaymentResult {
  resolution: 'REUSED_PENDING' | 'CREATED_NEW';
}

export interface PaymentEventContext {
  payment: PaymentSummary;
  order: {
    id: string;
    orderNumber: string;
    userId: string;
    notes: string | null;
    shippingAddress: {
      firstName: string;
      lastName: string;
    } | null;
  };
}

export interface ProcessWebhookResult {
  payment: PaymentSummary | null;
  duplicate: boolean;
  ignored: boolean;
  mismatch: boolean;
  statusChanged: boolean;
  previousStatus: PaymentStatus | null;
  eventId: string | null;
}

export class PaymentRepository {
  async prepareOwnedPaymentAttempt(
    userId: string,
    orderId: string,
    provider: Extract<PaymentProvider, 'PAYSTACK' | 'FLUTTERWAVE'>,
    reference: string,
  ): Promise<PreparedPaymentAttemptResult> {
    return this.preparePaymentAttemptInternal({
      where: { id: orderId, userId },
      provider,
      reference,
      customerType: 'REGISTERED',
      resolveCustomerEmail(order) {
        return order.user.email;
      },
    });
  }

  async prepareGuestPaymentAttempt(
    orderId: string,
    provider: Extract<PaymentProvider, 'PAYSTACK' | 'FLUTTERWAVE'>,
    reference: string,
  ): Promise<PreparedPaymentAttemptResult> {
    return this.preparePaymentAttemptInternal({
      where: { id: orderId },
      provider,
      reference,
      customerType: 'GUEST',
      resolveCustomerEmail(order) {
        return extractGuestEmail(order.notes) ?? order.user.email;
      },
    });
  }

  async updatePaymentMetadata(
    paymentId: string,
    metadata: {
      authorizationUrl?: string | null;
      accessCode?: string | null;
      providerRef?: string | null;
      gatewayResponse?: string | null;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<PaymentSummary> {
    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        authorizationUrl: metadata.authorizationUrl,
        accessCode: metadata.accessCode,
        providerRef: metadata.providerRef,
        gatewayResponse: metadata.gatewayResponse,
        metadata: metadata.metadata,
      },
      select: PAYMENT_SELECT,
    });

    return mapPayment(payment);
  }

  async prepareAuthorizationCharge(
    orderId: string,
    reference: string,
    amount: number,
  ): Promise<{
    order: OrderForAuthorizationCharge;
    payment: PaymentSummary;
    storedAuthorization: StoredPaystackAuthorization;
  }> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          userId: true,
          status: true,
          total: true,
          currency: true,
          user: {
            select: {
              email: true,
            },
          },
          payments: {
            where: {
              status: { in: [PaymentStatus.SUCCESS, PaymentStatus.AUTHORIZED] },
            },
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      if (!order) {
        throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new AppError(
          'Only pending orders can be charged from a saved Paystack authorization.',
          409,
          'ORDER_NOT_PAYABLE',
        );
      }

      if (order.currency !== 'NGN') {
        throw new AppError(
          'Saved Paystack authorization charges currently support NGN orders only.',
          422,
          'UNSUPPORTED_PAYMENT_CURRENCY',
        );
      }

      if (order.payments.length > 0) {
        throw new AppError('Order is not payable', 409, 'ORDER_NOT_PAYABLE');
      }

      if (!amountMatches(Number(order.total), amount)) {
        throw new AppError(
          'Authorization charges must match the outstanding order total exactly.',
          422,
          'INVALID_AUTHORIZATION_CHARGE_AMOUNT',
        );
      }

      const storedAuthorization = await tx.payment.findFirst({
        where: {
          provider: PaymentProvider.PAYSTACK,
          status: PaymentStatus.SUCCESS,
          authorizationCode: { not: null },
          order: {
            userId: order.userId,
          },
        },
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          authorizationCode: true,
          customerEmail: true,
        },
      });

      if (!storedAuthorization?.authorizationCode) {
        throw new AppError(
          'No reusable Paystack authorization was found for this customer.',
          404,
          'PAYSTACK_AUTHORIZATION_NOT_FOUND',
        );
      }

      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          provider: PaymentProvider.PAYSTACK,
          reference,
          providerRef: reference,
          customerEmail: storedAuthorization.customerEmail ?? order.user.email,
          amount: order.total,
          currency: order.currency,
          status: PaymentStatus.PENDING,
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            chargeType: 'AUTHORIZATION',
            sourcePaymentId: storedAuthorization.id,
          },
        },
        select: PAYMENT_SELECT,
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentReference: reference,
        },
      });

      return {
        order,
        payment: mapPayment(payment),
        storedAuthorization: {
          paymentId: storedAuthorization.id,
          authorizationCode: storedAuthorization.authorizationCode,
          customerEmail: storedAuthorization.customerEmail,
        },
      };
    });
  }

  async findOwnedPayment(
    userId: string,
    orderId: string,
    paymentId: string,
  ): Promise<PaymentSummary | null> {
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        orderId,
        order: { userId },
      },
      select: PAYMENT_SELECT,
    });

    return payment ? mapPayment(payment) : null;
  }

  async findGuestPayment(
    orderId: string,
    paymentId: string,
  ): Promise<PaymentSummary | null> {
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        orderId,
      },
      select: PAYMENT_SELECT,
    });

    return payment ? mapPayment(payment) : null;
  }

  async findOwnedPaymentForVerification(
    userId: string,
    orderId: string,
    paymentId: string,
  ): Promise<VerifiablePaymentRecord | null> {
    return prisma.payment.findFirst({
      where: {
        id: paymentId,
        orderId,
        order: { userId },
      },
      select: VERIFIABLE_PAYMENT_SELECT,
    });
  }

  async findGuestPaymentForVerification(
    orderId: string,
    paymentId: string,
  ): Promise<VerifiablePaymentRecord | null> {
    return prisma.payment.findFirst({
      where: {
        id: paymentId,
        orderId,
      },
      select: VERIFIABLE_PAYMENT_SELECT,
    });
  }

  async findPaymentForCallbackVerification(
    orderId: string,
    paymentId: string,
    reference: string,
  ): Promise<VerifiablePaymentRecord | null> {
    return prisma.payment.findFirst({
      where: {
        id: paymentId,
        orderId,
        OR: [{ reference }, { providerRef: reference }],
      },
      select: VERIFIABLE_PAYMENT_SELECT,
    });
  }

  async processWebhookEvent(event: ProviderEvent): Promise<ProcessWebhookResult> {
    const payment = await prisma.payment.findFirst({
      where: {
        provider: event.provider,
        OR: [{ reference: event.reference }, { providerRef: event.reference }],
      },
      select: VERIFIABLE_PAYMENT_SELECT,
    });

    if (!payment) {
      return {
        payment: null,
        duplicate: false,
        ignored: true,
        mismatch: false,
        statusChanged: false,
        previousStatus: null,
        eventId: event.eventId ?? null,
      };
    }

    const eventId = buildPaymentEventId(event);
    const nextStatus = mapProviderStatus(event.status);
    const previousStatus = payment.status;

    try {
      return await prisma.$transaction(async (tx) => {
        if (eventId) {
          const existingEvent = await tx.paymentEvent.findUnique({
            where: { eventId },
            select: { id: true },
          });

          if (existingEvent) {
            return {
              payment: mapPayment(payment),
              duplicate: true,
              ignored: false,
              mismatch: false,
              statusChanged: false,
              previousStatus,
              eventId,
            };
          }
        }

        const amountOk = amountMatches(Number(payment.order.total), event.amount);
        const currencyOk = payment.order.currency === event.currency;

        await tx.paymentEvent.create({
          data: {
            paymentId: payment.id,
            provider: event.provider,
            eventType: event.eventType ?? 'payment.event',
            eventId,
            status: nextStatus,
            payload: buildPaymentEventPayload(event, amountOk, currencyOk),
          },
        });

        if (!amountOk || !currencyOk) {
          return {
            payment: mapPayment(payment),
            duplicate: false,
            ignored: false,
            mismatch: true,
            statusChanged: false,
            previousStatus,
            eventId,
          };
        }

        if (isFinalPaymentStatus(payment.status)) {
          return {
            payment: mapPayment(payment),
            duplicate: false,
            ignored: false,
            mismatch: false,
            statusChanged: false,
            previousStatus,
            eventId,
          };
        }

        const paidAt =
          nextStatus === PaymentStatus.SUCCESS
            ? parseEventPaidAt(event.paidAt) ?? payment.paidAt ?? new Date()
            : payment.paidAt;

        const transition = await tx.payment.updateMany({
          where: {
            id: payment.id,
            status: previousStatus,
          },
          data: {
            status: nextStatus,
            paidAt,
            verifiedAt: new Date(),
            providerTransactionId: event.providerTransactionId ?? payment.providerTransactionId,
            authorizationCode: event.authorizationCode ?? payment.authorizationCode,
            channel: event.channel ?? payment.channel,
            gatewayResponse: stringifyPayload(event.raw),
            amountCaptured:
              nextStatus === PaymentStatus.SUCCESS
                ? payment.amount
                : payment.amountCaptured,
          },
        });

        const savedPayment = await tx.payment.findUniqueOrThrow({
          where: { id: payment.id },
          select: PAYMENT_SELECT,
        });

        if (transition.count === 0) {
          return {
            payment: mapPayment(savedPayment),
            duplicate: false,
            ignored: false,
            mismatch: false,
            statusChanged: false,
            previousStatus,
            eventId,
          };
        }

        if (nextStatus === PaymentStatus.SUCCESS) {
          await confirmOrderInventoryReservations(tx, payment.order.id, {
            paymentId: payment.id,
            provider: event.provider,
          });
          await tx.order.update({
            where: { id: payment.order.id },
            data: {
              status: OrderStatus.PAID,
              paidAt,
              paymentReference: payment.reference,
            },
          });
        } else if (nextStatus === PaymentStatus.FAILED && payment.order.status === OrderStatus.PENDING) {
          await releaseOrderInventoryReservations(tx, payment.order.id, {
            reason: 'PAYMENT_FAILED',
            payment: {
              paymentId: payment.id,
              provider: event.provider,
            },
          });
          await tx.order.update({
            where: { id: payment.order.id },
            data: {
              status: OrderStatus.PENDING,
            },
          });
        }

        return {
          payment: mapPayment(savedPayment),
          duplicate: false,
          ignored: false,
          mismatch: false,
          statusChanged: savedPayment.status !== previousStatus,
          previousStatus,
          eventId,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        eventId
      ) {
        return {
          payment: mapPayment(payment),
          duplicate: true,
          ignored: false,
          mismatch: false,
          statusChanged: false,
          previousStatus,
          eventId,
        };
      }

      throw error;
    }
  }

  async findPaymentEventContext(paymentId: string): Promise<PaymentEventContext | null> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        ...PAYMENT_SELECT,
        order: {
          select: {
            id: true,
            orderNumber: true,
            userId: true,
            notes: true,
            shippingAddress: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return null;
    }

    return {
      payment: mapPayment(payment),
      order: payment.order,
    };
  }

  private async preparePaymentAttemptInternal(input: {
    where: Prisma.OrderWhereInput;
    provider: Extract<PaymentProvider, 'PAYSTACK' | 'FLUTTERWAVE'>;
    reference: string;
    customerType: 'REGISTERED' | 'GUEST';
    resolveCustomerEmail: (order: OrderForPayment) => string | null;
  }): Promise<PreparedPaymentAttemptResult> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: input.where,
        select: ORDER_PAYMENT_SELECT,
      });

      if (!order) {
        throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      }

      assertOrderCanStartPayment(order);

      const newestPendingPayment = order.payments.find(
        (payment) => payment.status === PaymentStatus.PENDING,
      );

      if (newestPendingPayment) {
        const pendingIsFresh = !isPaymentStale(newestPendingPayment);
        const hasUsableAuthorizationUrl = hasReusablePendingAuthorization(newestPendingPayment);

        if (pendingIsFresh && hasUsableAuthorizationUrl) {
          if (newestPendingPayment.provider !== input.provider) {
            throw new AppError(
              'This order already has an active payment attempt. Please complete that payment or wait for it to expire.',
              409,
              'ACTIVE_PAYMENT_EXISTS',
            );
          }

          await reserveOrderInventory(
            tx,
            order.id,
            {
              paymentId: newestPendingPayment.id,
              provider: newestPendingPayment.provider,
            },
            PENDING_PAYMENT_STALE_WINDOW_MS,
          );

          return {
            order,
            payment: mapPayment(newestPendingPayment),
            resolution: 'REUSED_PENDING',
          };
        }

        await abandonPendingPayments(tx, order.id, order.payments, {
          reason: pendingIsFresh
            ? 'PENDING_PAYMENT_MISSING_AUTHORIZATION_URL'
            : `PENDING_PAYMENT_STALE_${Math.floor(PENDING_PAYMENT_STALE_WINDOW_MS / 60000)}M`,
        });
      }

      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          provider: input.provider,
          reference: input.reference,
          providerRef: input.reference,
          customerEmail: input.resolveCustomerEmail(order),
          amount: order.total,
          currency: order.currency,
          status: PaymentStatus.PENDING,
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerType: input.customerType,
          },
        },
        select: PAYMENT_SELECT,
      });

      await tx.order.update({
        where: { id: order.id },
        data: { paymentReference: input.reference },
      });

      await reserveOrderInventory(
        tx,
        order.id,
        {
          paymentId: payment.id,
          provider: payment.provider,
        },
        PENDING_PAYMENT_STALE_WINDOW_MS,
      );

      return {
        order,
        payment: mapPayment(payment),
        resolution: 'CREATED_NEW',
      };
    });
  }
}

function mapProviderStatus(status: ProviderEvent['status']): PaymentStatus {
  switch (status) {
    case 'SUCCESS':
      return PaymentStatus.SUCCESS;
    case 'FAILED':
      return PaymentStatus.FAILED;
    case 'PENDING':
    default:
      return PaymentStatus.PENDING;
  }
}

function isFinalPaymentStatus(status: PaymentStatus): boolean {
  return (
    status === PaymentStatus.SUCCESS ||
    status === PaymentStatus.FAILED ||
    status === PaymentStatus.ABANDONED ||
    status === PaymentStatus.REFUNDED
  );
}

function assertOrderCanStartPayment(order: OrderForPayment): void {
  if (order.status === OrderStatus.CANCELLED) {
    throw new AppError(
      'Cancelled orders cannot start a new payment.',
      409,
      'ORDER_NOT_PAYABLE',
    );
  }

  if (order.status !== OrderStatus.PENDING) {
    throw new AppError(
      'This order has already moved beyond checkout and cannot start a new payment.',
      409,
      'ORDER_NOT_PAYABLE',
    );
  }

  if (
    order.payments.some(
      (payment) =>
        payment.status === PaymentStatus.SUCCESS || payment.status === PaymentStatus.AUTHORIZED,
    )
  ) {
    throw new AppError(
      'This order already has a confirmed payment and cannot start another payment.',
      409,
      'ORDER_ALREADY_PAID',
    );
  }
}

function amountMatches(expected: number, received: number): boolean {
  return Math.abs(expected - received) < 0.01;
}

function hasReusablePendingAuthorization(
  payment: Pick<OrderPaymentRecord, 'authorizationUrl'>,
): boolean {
  return typeof payment.authorizationUrl === 'string' && payment.authorizationUrl.length > 0;
}

function isPaymentStale(
  payment: Pick<OrderPaymentRecord, 'updatedAt'>,
): boolean {
  return Date.now() - payment.updatedAt.getTime() > PENDING_PAYMENT_STALE_WINDOW_MS;
}

async function abandonPendingPayments(
  tx: Prisma.TransactionClient,
  orderId: string,
  payments: Array<Pick<OrderPaymentRecord, 'id' | 'status' | 'reference' | 'providerRef' | 'provider'>>,
  input: { reason: string },
): Promise<void> {
  const pendingPayments = payments.filter((payment) => payment.status === PaymentStatus.PENDING);

  if (pendingPayments.length === 0) {
    return;
  }

  await tx.payment.updateMany({
    where: {
      id: { in: pendingPayments.map((payment) => payment.id) },
      orderId,
      status: PaymentStatus.PENDING,
    },
    data: {
      status: PaymentStatus.ABANDONED,
      verifiedAt: new Date(),
    },
  });

  const auditPayment = pendingPayments[0];
  if (auditPayment) {
    await releaseOrderInventoryReservations(tx, orderId, {
      reason: input.reason,
      payment: {
        paymentId: auditPayment.id,
        provider: auditPayment.provider,
      },
    });
  }

  for (const payment of pendingPayments) {
    await tx.paymentEvent.create({
      data: {
        paymentId: payment.id,
        provider: payment.provider,
        eventType: 'payment.retry.abandoned_pending',
        status: PaymentStatus.ABANDONED,
        payload: {
          reason: input.reason,
          reference: payment.reference,
          providerRef: payment.providerRef,
        },
      },
    });
  }
}

function extractGuestEmail(notes: string | null): string | null {
  const match = notes?.match(/\[guestEmail:([^\]]+)\]/);
  return match?.[1] ?? null;
}

function buildPaymentEventId(event: ProviderEvent): string {
  return (
    event.eventId ??
    `${event.provider.toLowerCase()}:${event.eventType ?? 'payment.event'}:${event.reference}:${event.status}`
  );
}

function buildPaymentEventPayload(
  event: ProviderEvent,
  amountMatched: boolean,
  currencyMatched: boolean,
): Prisma.InputJsonValue {
  return {
    amountMatched,
    currencyMatched,
    providerTransactionId: event.providerTransactionId ?? null,
    channel: event.channel ?? null,
    gatewayMessage: event.gatewayMessage ?? null,
    paidAt: event.paidAt ?? null,
    raw: ensureJsonCompatible(event.raw),
  };
}

function stringifyPayload(payload: unknown): string {
  return JSON.stringify(ensureJsonCompatible(payload));
}

function ensureJsonCompatible(payload: unknown): Prisma.JsonValue {
  return JSON.parse(JSON.stringify(payload ?? null)) as Prisma.JsonValue;
}

function parseEventPaidAt(paidAt: string | null | undefined): Date | null {
  if (!paidAt) {
    return null;
  }

  const parsed = new Date(paidAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export const paymentRepository = new PaymentRepository();
