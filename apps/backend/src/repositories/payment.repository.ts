// ============================================
// Payment Repository
// ============================================

import { OrderStatus, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { PaymentSummary } from '@yurdeals/shared';
import { prisma } from '../config';
import { AppError } from '../middleware/errorHandler';
import { ProviderEvent } from '../services/payment-gateways/paymentGateway.types';
import { createGuestTokenTag } from './order.repository';

const PAYMENT_SELECT = {
  id: true,
  orderId: true,
  provider: true,
  providerRef: true,
  amount: true,
  currency: true,
  status: true,
  paidAt: true,
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
    where: { status: PaymentStatus.SUCCESS },
    select: { id: true },
  },
} satisfies Prisma.OrderSelect;

type PaymentRecord = Prisma.PaymentGetPayload<{ select: typeof PAYMENT_SELECT }>;
type OrderForPayment = Prisma.OrderGetPayload<{ select: typeof ORDER_PAYMENT_SELECT }>;

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
        providerRef: reference,
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
        providerRef: reference,
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

    return { order, payment: mapPayment(payment) };
  }

  async updatePaymentMetadata(paymentId: string, metadata: Prisma.InputJsonValue): Promise<void> {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { metadata },
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

  async processWebhookEvent(event: ProviderEvent): Promise<PaymentSummary | null> {
    const payment = await prisma.payment.findFirst({
      where: {
        provider: event.provider,
        providerRef: event.reference,
      },
      select: {
        ...PAYMENT_SELECT,
        order: {
          select: {
            id: true,
            total: true,
            currency: true,
          },
        },
      },
    });

    if (!payment) {
      return null;
    }

    if (payment.status === PaymentStatus.SUCCESS || payment.status === PaymentStatus.FAILED) {
      return mapPayment(payment);
    }

    if (
      !amountMatches(Number(payment.order.total), event.amount) ||
      payment.order.currency !== event.currency
    ) {
      throw new AppError('Webhook payment amount or currency mismatch', 409, 'PAYMENT_MISMATCH');
    }

    const nextStatus = mapProviderStatus(event.status);

    const updatedPayment = await prisma.$transaction(async (tx) => {
      const savedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: nextStatus,
          paidAt: nextStatus === PaymentStatus.SUCCESS ? new Date() : null,
        },
        select: PAYMENT_SELECT,
      });

      if (nextStatus === PaymentStatus.SUCCESS) {
        await tx.order.update({
          where: { id: payment.order.id },
          data: { status: OrderStatus.CONFIRMED },
        });
      }

      return savedPayment;
    });

    return mapPayment(updatedPayment);
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
      return PaymentStatus.PROCESSING;
  }
}

function amountMatches(expected: number, received: number): boolean {
  return Math.abs(expected - received) < 0.01;
}

function mapPayment(payment: PaymentRecord): PaymentSummary {
  return {
    id: payment.id,
    orderId: payment.orderId,
    provider: payment.provider,
    providerRef: payment.providerRef,
    amount: Number(payment.amount),
    currency: payment.currency,
    status: payment.status,
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}

export const paymentRepository = new PaymentRepository();
