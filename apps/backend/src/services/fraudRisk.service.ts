// ============================================
// Fraud Risk Service
// ============================================

import { FraudRiskLevel, PaymentStatus, Prisma, ProductStockType } from '@prisma/client';
import { env, prisma } from '../config';
import { AppError } from '../middleware/errorHandler';
import { logger, normalizeEmail } from '../utils';
import { GUEST_CUSTOMER_NOTE_TAG } from '../repositories/order.repository';

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'temp-mail.org',
  'tempmail.com',
  'yopmail.com',
  'sharklasers.com',
  'getnada.com',
  'trashmail.com',
  'maildrop.cc',
  'dispostable.com',
]);

const FULFILLMENT_BLOCKED_STATUSES = new Set([
  'PROCESSING',
  'INSPECTION_PENDING',
  'INSPECTION_PASSED',
  'SHIPPED',
  'IN_TRANSIT',
  'DELIVERED',
]);

const FRAUD_RISK_SELECT = {
  id: true,
  orderNumber: true,
  total: true,
  currency: true,
  notes: true,
  riskLevel: true,
  riskFlags: true,
  riskReviewedAt: true,
  holdForManualReview: true,
  shippingAddress: {
    select: {
      country: true,
    },
  },
  user: {
    select: {
      email: true,
    },
  },
  items: {
    select: {
      quantity: true,
      stockTypeSnapshot: true,
    },
  },
  payments: {
    select: {
      id: true,
      provider: true,
      status: true,
      currency: true,
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.OrderSelect;

type FraudRiskOrderRecord = Prisma.OrderGetPayload<{ select: typeof FRAUD_RISK_SELECT }>;

export interface EvaluateOrderRiskInput {
  orderId: string;
  ipAddress?: string;
  stage: 'ORDER_CREATED' | 'PAYMENT_INITIATED' | 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED';
}

export interface OrderRiskEvaluationResult {
  riskLevel: FraudRiskLevel;
  riskFlags: string[];
  holdForManualReview: boolean;
}

export async function evaluateAndPersistOrderRisk(
  input: EvaluateOrderRiskInput,
): Promise<OrderRiskEvaluationResult | null> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: FRAUD_RISK_SELECT,
  });

  if (!order) {
    return null;
  }

  const evaluation = await evaluateOrderRiskSignals(order, input);
  const currentFlags = order.riskFlags;
  const hasNewFlags = evaluation.riskFlags.some((flag) => !currentFlags.includes(flag));
  const shouldHoldForManualReview =
    evaluation.riskLevel === FraudRiskLevel.HIGH
      ? order.holdForManualReview || !order.riskReviewedAt || hasNewFlags
      : false;

  await prisma.order.update({
    where: { id: order.id },
    data: {
      riskLevel: evaluation.riskLevel,
      riskFlags: evaluation.riskFlags,
      holdForManualReview: shouldHoldForManualReview,
    },
  });

  if (shouldHoldForManualReview) {
    logger.warn('Order routed for internal review before fulfillment', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      stage: input.stage,
      riskLevel: evaluation.riskLevel,
      riskFlags: evaluation.riskFlags,
    });
  }

  return {
    riskLevel: evaluation.riskLevel,
    riskFlags: evaluation.riskFlags,
    holdForManualReview: shouldHoldForManualReview,
  };
}

export function assertOrderStatusAllowedWhileRiskHeld(
  order: { holdForManualReview: boolean; riskLevel: FraudRiskLevel; orderNumber: string },
  nextStatus: string,
): void {
  if (!order.holdForManualReview) {
    return;
  }

  if (!FULFILLMENT_BLOCKED_STATUSES.has(nextStatus)) {
    return;
  }

  throw new AppError(
    `Order ${order.orderNumber} needs internal review before it can move to ${nextStatus}. Clear the review hold first.`,
    409,
    'ORDER_ON_MANUAL_REVIEW',
  );
}

async function evaluateOrderRiskSignals(
  order: FraudRiskOrderRecord,
  input: EvaluateOrderRiskInput,
): Promise<OrderRiskEvaluationResult> {
  const flags = new Set<string>();
  let signalPoints = 0;

  const total = Number(order.total);
  const baseRiskLevel = getAmountBand(total);
  const isGuestOrder = order.notes?.includes(GUEST_CUSTOMER_NOTE_TAG) ?? false;
  const customerEmail = extractCustomerEmail(order);
  const emailDomain = customerEmail.split('@')[1] ?? '';
  const preorderQuantity = order.items
    .filter((item) => item.stockTypeSnapshot === ProductStockType.PREORDER)
    .reduce((sum, item) => sum + item.quantity, 0);
  const maxPreorderLineQuantity = order.items
    .filter((item) => item.stockTypeSnapshot === ProductStockType.PREORDER)
    .reduce((max, item) => Math.max(max, item.quantity), 0);
  const totalPaymentAttempts = order.payments.length;
  const failedPaymentAttempts = order.payments.filter(
    (payment) => payment.status === PaymentStatus.FAILED || payment.status === PaymentStatus.ABANDONED,
  ).length;
  const paymentCurrencyMismatch = order.payments.some(
    (payment) => payment.currency !== order.currency,
  );

  if (baseRiskLevel !== FraudRiskLevel.LOW) {
    flags.add('ELEVATED_ORDER_TOTAL');
  }

  if (baseRiskLevel === FraudRiskLevel.HIGH) {
    flags.add('HIGH_VALUE_ORDER');
  }

  if (total >= env.RISK_EXTREME_ORDER_TOTAL_NGN) {
    flags.add('EXTREME_HIGH_VALUE_ORDER');
  }

  if (isGuestOrder && total >= env.RISK_GUEST_ELEVATED_TOTAL_NGN) {
    flags.add('HIGH_VALUE_GUEST_ORDER');
    signalPoints += 1;
  }

  if (DISPOSABLE_EMAIL_DOMAINS.has(emailDomain)) {
    flags.add('DISPOSABLE_EMAIL_DOMAIN');
    signalPoints += 1;
  }

  if (
    maxPreorderLineQuantity >= env.RISK_PREORDER_SPIKE_QTY_THRESHOLD ||
    preorderQuantity >= env.RISK_PREORDER_SPIKE_TOTAL_QTY_THRESHOLD
  ) {
    flags.add('PREORDER_QUANTITY_SPIKE');
    signalPoints += 1;
  }

  if (failedPaymentAttempts >= env.RISK_FAILED_PAYMENT_ATTEMPTS_THRESHOLD) {
    flags.add('MULTIPLE_FAILED_PAYMENT_ATTEMPTS');
    signalPoints += 1;
  }

  if (totalPaymentAttempts >= env.RISK_PAYMENT_RETRY_ATTEMPTS_THRESHOLD) {
    flags.add('EXCESSIVE_PAYMENT_RETRY_ATTEMPTS');
    signalPoints += 1;
  }

  if (paymentCurrencyMismatch) {
    flags.add('PAYMENT_CURRENCY_MISMATCH');
    signalPoints += 2;
  }

  if (order.shippingAddress?.country && order.shippingAddress.country.toLowerCase() !== 'nigeria') {
    flags.add('NON_STANDARD_DELIVERY_COUNTRY');
    signalPoints += 1;
  }

  if (input.ipAddress) {
    const recentOrdersFromIp = await prisma.auditLog.count({
      where: {
        entity: 'Order',
        action: { in: ['ORDER_CREATED', 'GUEST_ORDER_CREATED'] },
        ipAddress: input.ipAddress,
        createdAt: {
          gte: new Date(Date.now() - env.RISK_REPEATED_ORDER_LOOKBACK_MINUTES * 60 * 1000),
        },
      },
    });

    if (recentOrdersFromIp >= env.RISK_REPEATED_ORDER_IP_THRESHOLD) {
      flags.add('REPEATED_ORDERS_SAME_IP');
      signalPoints += 1;
    }
  }

  if (
    input.stage === 'PAYMENT_FAILED' &&
    failedPaymentAttempts >= env.RISK_FAILED_PAYMENT_ATTEMPTS_THRESHOLD
  ) {
    signalPoints += 1;
  }

  const riskLevel = deriveRiskLevel(baseRiskLevel, signalPoints);

  return {
    riskLevel,
    riskFlags: Array.from(flags).sort(),
    holdForManualReview: riskLevel === FraudRiskLevel.HIGH,
  };
}

function extractCustomerEmail(order: Pick<FraudRiskOrderRecord, 'notes' | 'user'>): string {
  const guestMatch = order.notes?.match(/\[guestEmail:([^\]]+)\]/);
  if (guestMatch?.[1]) {
    return normalizeEmail(guestMatch[1]);
  }

  return normalizeEmail(order.user.email);
}

function getAmountBand(total: number): FraudRiskLevel {
  if (total >= env.RISK_HIGH_ORDER_TOTAL_NGN) {
    return FraudRiskLevel.HIGH;
  }

  if (total >= env.RISK_MEDIUM_ORDER_TOTAL_NGN) {
    return FraudRiskLevel.MEDIUM;
  }

  return FraudRiskLevel.LOW;
}

function deriveRiskLevel(baseRiskLevel: FraudRiskLevel, signalPoints: number): FraudRiskLevel {
  if (baseRiskLevel === FraudRiskLevel.HIGH) {
    return FraudRiskLevel.HIGH;
  }

  if (baseRiskLevel === FraudRiskLevel.MEDIUM) {
    return signalPoints >= env.RISK_MEDIUM_SIGNAL_POINTS_FOR_HIGH
      ? FraudRiskLevel.HIGH
      : FraudRiskLevel.MEDIUM;
  }

  if (signalPoints >= env.RISK_LOW_SIGNAL_POINTS_FOR_HIGH) {
    return FraudRiskLevel.HIGH;
  }

  if (signalPoints >= env.RISK_LOW_SIGNAL_POINTS_FOR_MEDIUM) {
    return FraudRiskLevel.MEDIUM;
  }

  return FraudRiskLevel.LOW;
}
