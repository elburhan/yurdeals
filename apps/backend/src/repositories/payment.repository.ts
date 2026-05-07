// ============================================
// Payment Repository
// ============================================

import { OrderStatus, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { PaymentSummary } from '@yurdeals/shared';
import { prisma } from '../config';
import { AppError } from '../middleware/errorHandler';
import { ProviderEvent } from '../services/payment-gateways/paymentGateway.types';
import { createGuestTokenTag, mapPayment } from './order.repository';

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
    where: {
      status: { in: [PaymentStatus.SUCCESS, PaymentStatus.AUTHORIZED] },
    },
    select: { id: true },
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
export type VerifiablePaymentRecord = Prisma.PaymentGetPayload<{
  select: typeof VERIFIABLE_PAYMENT_SELECT;
}>;

export interface CreatedPaymentResult {
  order: OrderForPayment;
  payment: PaymentSummary;
}

export interface PaymentEventContext {
  payment: PaymentSummary;
  order: {
    id: string;
    orderNumber: string;
    userId: string;
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
  async createPendingPayment(
    userId: string,
    orderId: string,
    provider: Extract<PaymentProvider, 'PAYSTACK' | 'FLUTTERWAVE'>,
    reference: string,
  ): Promise<CreatedPaymentResult> {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      select: ORDER_PAYMENT_SELECT,
    });

    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    if (order.status !== OrderStatus.PENDING || order.payments.length > 0) {
      throw new AppError('Order is not payable', 409, 'ORDER_NOT_PAYABLE');
    }

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider,
        reference,
        providerRef: reference,
        customerEmail: order.user.email,
        amount: order.total,
        currency: order.currency,
        status: PaymentStatus.PENDING,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
        },
      },
      select: PAYMENT_SELECT,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentReference: reference },
    });

    return { order, payment: mapPayment(payment) };
  }

  async createPendingGuestPayment(
    orderId: string,
    guestAccessToken: string,
    provider: Extract<PaymentProvider, 'PAYSTACK' | 'FLUTTERWAVE'>,
    reference: string,
  ): Promise<CreatedPaymentResult> {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        notes: { contains: createGuestTokenTag(guestAccessToken) },
      },
      select: ORDER_PAYMENT_SELECT,
    });

    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    if (order.status !== OrderStatus.PENDING || order.payments.length > 0) {
      throw new AppError('Order is not payable', 409, 'ORDER_NOT_PAYABLE');
    }

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider,
        reference,
        providerRef: reference,
        customerEmail: extractGuestEmail(order.notes) ?? order.user.email,
        amount: order.total,
        currency: order.currency,
        status: PaymentStatus.PENDING,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerType: 'GUEST',
        },
      },
      select: PAYMENT_SELECT,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentReference: reference },
    });

    return { order, payment: mapPayment(payment) };
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
    guestAccessToken: string,
  ): Promise<PaymentSummary | null> {
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        orderId,
        order: {
          notes: { contains: createGuestTokenTag(guestAccessToken) },
        },
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
    guestAccessToken: string,
  ): Promise<VerifiablePaymentRecord | null> {
    return prisma.payment.findFirst({
      where: {
        id: paymentId,
        orderId,
        order: {
          notes: { contains: createGuestTokenTag(guestAccessToken) },
        },
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

        const savedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: nextStatus,
            paidAt,
            verifiedAt: new Date(),
            providerTransactionId: event.providerTransactionId ?? payment.providerTransactionId,
            channel: event.channel ?? payment.channel,
            gatewayResponse: stringifyPayload(event.raw),
            amountCaptured:
              nextStatus === PaymentStatus.SUCCESS
                ? payment.amount
                : payment.amountCaptured,
          },
          select: PAYMENT_SELECT,
        });

        if (nextStatus === PaymentStatus.SUCCESS) {
          await tx.order.update({
            where: { id: payment.order.id },
            data: {
              status: OrderStatus.PAID,
              paidAt,
              paymentReference: payment.reference,
            },
          });
        } else if (nextStatus === PaymentStatus.FAILED && payment.order.status === OrderStatus.PENDING) {
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
    status === PaymentStatus.REFUNDED
  );
}

function amountMatches(expected: number, received: number): boolean {
  return Math.abs(expected - received) < 0.01;
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
