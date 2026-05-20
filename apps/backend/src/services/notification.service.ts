// ============================================
// Notification Service
// ============================================

import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { NotificationListData, NotificationSummary, OrderSummary, PaymentSummary } from '@yurdeals/shared';
import { logger } from '../utils';
import { isDevelopment, prisma } from '../config';
import { notificationRepository } from '../repositories/notification.repository';
import { isDeliverableEmail, sendTransactionalEmail } from './email.service';
import {
  renderOrderCreatedEmail,
  renderOtpEmail,
  renderPaymentConfirmedEmail,
} from './emailTemplates';

interface NotificationTemplate {
  type: string;
  title: string;
  message: string;
  eventKey: string;
  data?: Record<string, unknown>;
  email?: (recipient: NotificationRecipient) => Promise<void>;
}

interface NotificationRecipient {
  email: string;
  name: string;
}

interface NotificationRecipientOverride {
  email: string;
  name?: string | null;
}

interface VerificationCodeNotificationInput {
  channel: 'EMAIL' | 'PHONE';
  target: string;
  code: string;
  expiresInSeconds: number;
  verificationSessionId: string;
}

interface DevVerificationCodeRecord {
  verificationSessionId: string;
  channel: 'EMAIL' | 'PHONE';
  target: string;
  code: string;
  expiresInSeconds: number;
  createdAt: string;
}

interface DevVerificationCodeLookupInput {
  verificationSessionId?: string;
  identifier?: string;
  channel?: 'EMAIL' | 'PHONE';
}

const devVerificationCodeStore = new Map<string, DevVerificationCodeRecord>();

export async function notifyOrderCreated(
  userId: string,
  order: Pick<OrderSummary, 'id' | 'orderNumber' | 'total' | 'currency' | 'items'>,
  recipientOverride?: NotificationRecipientOverride,
): Promise<NotificationSummary | null> {
  return createAndSend(userId, {
    type: 'ORDER_CREATED',
    title: 'Order received',
    message: `Order ${order.orderNumber} has been received and is ready for payment.`,
    eventKey: `order:${order.id}:created`,
    data: { orderId: order.id, orderNumber: order.orderNumber },
    email: async (recipient) => {
      await sendTransactionalEmail({
        to: recipient.email,
        ...renderOrderCreatedEmail({
          customerName: recipient.name,
          orderNumber: order.orderNumber,
          items: order.items,
          total: order.total,
          currency: order.currency,
        }),
        idempotencyKey: `order-created:${order.id}`,
      });
    },
  }, recipientOverride);
}

export async function notifyPaymentSuccess(
  userId: string,
  order: Pick<OrderSummary, 'id' | 'orderNumber'>,
  payment?: Pick<PaymentSummary, 'id' | 'provider' | 'amount' | 'currency'>,
  recipientOverride?: NotificationRecipientOverride,
): Promise<NotificationSummary | null> {
  return createAndSend(userId, {
    type: 'PAYMENT_SUCCESS',
    title: 'Payment confirmed',
    message: `Payment for order ${order.orderNumber} was confirmed. We're preparing your order.`,
    eventKey: `order:${order.id}:payment-success`,
    data: { orderId: order.id, paymentId: payment?.id, provider: payment?.provider },
    email: async (recipient) => {
      if (!payment) {
        return;
      }

      await sendTransactionalEmail({
        to: recipient.email,
        ...renderPaymentConfirmedEmail({
          customerName: recipient.name,
          orderNumber: order.orderNumber,
          amount: payment.amount,
          currency: payment.currency,
        }),
        idempotencyKey: `payment-success:${payment.id}`,
      });
    },
  }, recipientOverride);
}

export async function notifyPaymentFailed(
  userId: string,
  order: Pick<OrderSummary, 'id' | 'orderNumber'>,
  payment?: Pick<PaymentSummary, 'id' | 'provider'>,
): Promise<NotificationSummary | null> {
  return createAndSend(userId, {
    type: 'PAYMENT_FAILED',
    title: 'Payment failed',
    message: `Payment for order ${order.orderNumber} could not be completed.`,
    eventKey: `order:${order.id}:payment-failed`,
    data: { orderId: order.id, paymentId: payment?.id, provider: payment?.provider },
  });
}

export async function notifyOrderStatusChanged(
  userId: string,
  order: Pick<OrderSummary, 'id' | 'orderNumber'>,
  status: OrderStatus | PaymentStatus | string,
): Promise<NotificationSummary | null> {
  const label = getStatusLabel(status);

  return createAndSend(userId, {
    type: 'ORDER_STATUS_CHANGED',
    title: label,
    message: `Order ${order.orderNumber}: ${label}.`,
    eventKey: `order:${order.id}:status:${status}`,
    data: { orderId: order.id, status },
  });
}

export async function notifyShipmentStatusChanged(
  userId: string,
  order: Pick<OrderSummary, 'id' | 'orderNumber'>,
  status: string,
): Promise<NotificationSummary | null> {
  const copy = getShipmentStatusCopy(status);

  return createAndSend(userId, {
    type: 'SHIPMENT_STATUS_CHANGED',
    title: copy.title,
    message: `Order ${order.orderNumber}: ${copy.message}`,
    eventKey: `order:${order.id}:shipment:${status}`,
    data: { orderId: order.id, status },
  });
}

export async function listNotifications(userId: string): Promise<NotificationListData> {
  const notifications = await notificationRepository.findRecentByUserId(userId, 20);
  return { notifications };
}

export async function markAllNotificationsRead(
  userId: string,
): Promise<{ updatedCount: number }> {
  const updatedCount = await notificationRepository.markAllReadByUserId(userId);
  return { updatedCount };
}

export async function sendVerificationCodeNotification(
  input: VerificationCodeNotificationInput,
): Promise<void> {
  cacheDevVerificationCode(input);

  if (input.channel === 'EMAIL') {
    const emailSent = await sendTransactionalEmail(
      {
        to: input.target,
        ...renderOtpEmail({
          code: input.code,
          expiresInSeconds: input.expiresInSeconds,
        }),
        idempotencyKey: `otp:${input.verificationSessionId}`,
      },
      { required: true },
    );

    logger.info(emailSent ? 'Verification email dispatched' : 'Verification email skipped in development', {
      target: maskVerificationTarget(input.target, input.channel),
      expiresInSeconds: input.expiresInSeconds,
      verificationSessionId: input.verificationSessionId,
    });
    return;
  }

  // TODO: Add a real SMS provider for PHONE channel verification.
  logger.info('Verification code dispatch queued', {
    channel: input.channel,
    target: maskVerificationTarget(input.target, input.channel),
    expiresInSeconds: input.expiresInSeconds,
    verificationSessionId: input.verificationSessionId,
  });

  void input.code;
}

export function getLatestDevVerificationCode(
  input: DevVerificationCodeLookupInput,
): Omit<DevVerificationCodeRecord, 'target'> & { verificationTarget: string } | null {
  if (!isDevelopment) {
    return null;
  }

  const match = Array.from(devVerificationCodeStore.values())
    .filter((record) => {
      if (input.verificationSessionId) {
        return record.verificationSessionId === input.verificationSessionId;
      }

      if (!input.identifier || !input.channel) {
        return false;
      }

      return (
        record.channel === input.channel &&
        normalizeDevLookupTarget(input.identifier, input.channel) === record.target
      );
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

  if (!match) {
    return null;
  }

  return {
    verificationSessionId: match.verificationSessionId,
    channel: match.channel,
    code: match.code,
    expiresInSeconds: match.expiresInSeconds,
    createdAt: match.createdAt,
    verificationTarget: maskVerificationTarget(match.target, match.channel),
  };
}

async function createAndSend(
  userId: string,
  template: NotificationTemplate,
  recipientOverride?: NotificationRecipientOverride,
): Promise<NotificationSummary | null> {
  const notification = await notificationRepository.createOnce({
    userId,
    type: template.type,
    title: template.title,
    message: template.message,
    eventKey: template.eventKey,
    data: template.data as Prisma.InputJsonObject | undefined,
  });

  if (!notification) {
    return null;
  }

  logger.info('Notification queued', {
    notificationId: notification.id,
    userId,
    type: notification.type,
  });

  if (template.email) {
    await sendNotificationEmail(userId, notification.id, template, recipientOverride);
  }

  // TODO: Add real SMS and WhatsApp providers in later notification phases.
  logger.info('SMS notification deferred', { notificationId: notification.id });
  logger.info('WhatsApp notification deferred', { notificationId: notification.id });

  return notification;
}

async function sendNotificationEmail(
  userId: string,
  notificationId: string,
  template: NotificationTemplate,
  recipientOverride?: NotificationRecipientOverride,
): Promise<void> {
  const recipient = await findNotificationRecipient(userId, recipientOverride);
  if (!recipient) {
    logger.info('Notification email skipped because recipient is not deliverable', {
      notificationId,
      userId,
      type: template.type,
    });
    return;
  }

  try {
    await template.email?.(recipient);
  } catch (error) {
    logger.warn('Notification email failed without blocking workflow', {
      notificationId,
      userId,
      type: template.type,
      error: error instanceof Error ? error.message : 'Unknown email error',
    });
  }
}

async function findNotificationRecipient(
  userId: string,
  recipientOverride?: NotificationRecipientOverride,
): Promise<NotificationRecipient | null> {
  if (recipientOverride && isDeliverableEmail(recipientOverride.email)) {
    return {
      email: recipientOverride.email,
      name: recipientOverride.name?.trim() || 'there',
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user || !isDeliverableEmail(user.email)) {
    return null;
  }

  return {
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim() || 'there',
  };
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PROCESSING_IN_CHINA: 'Processing in China',
    SHIPPED_FROM_CHINA: 'Shipped from China',
    ARRIVED_IN_NIGERIA: 'Arrived in Nigeria',
    OUT_FOR_DELIVERY: 'Out for delivery',
    IN_TRANSIT: 'In transit',
    LOCAL_DELIVERY: 'Out for delivery',
    DELIVERED: 'Delivered',
    DELIVERY_FAILED: 'Delivery failed',
    CONFIRMED: 'Order confirmed',
    PROCESSING: 'Order processing',
    SHIPPED: 'Shipped',
  };

  return labels[status] ?? status.replace(/_/g, ' ').toLowerCase();
}

function getShipmentStatusCopy(status: string): { title: string; message: string } {
  const copy: Record<string, { title: string; message: string }> = {
    SHIPPED: {
      title: 'Your order has shipped',
      message: 'Your order has shipped and tracking has started.',
    },
    SHIPPED_FROM_CHINA: {
      title: 'Shipped from China',
      message: 'Your order has shipped from China and is on the way to Nigeria.',
    },
    IN_TRANSIT: {
      title: 'Your order is on the way',
      message: 'Your shipment is in transit.',
    },
    ARRIVED_IN_NIGERIA: {
      title: 'Arrived in Nigeria',
      message: 'Your order has arrived in Nigeria and is moving toward local delivery.',
    },
    CUSTOMS_CLEARANCE: {
      title: 'Customs clearance',
      message: 'Your order is going through customs clearance.',
    },
    OUT_FOR_DELIVERY: {
      title: 'Your order is out for delivery',
      message: 'Your order is out for delivery today.',
    },
    LOCAL_DELIVERY: {
      title: 'Your order is out for delivery',
      message: 'Your order is with our local delivery team.',
    },
    DELIVERED: {
      title: 'Your order has been delivered',
      message: 'Your order has been delivered. Thank you for shopping with YurDeals.',
    },
    DELIVERY_FAILED: {
      title: 'Delivery failed',
      message: 'Delivery failed. Please contact support so we can help complete delivery.',
    },
  };

  return (
    copy[status] ?? {
      title: getStatusLabel(status),
      message: getStatusLabel(status),
    }
  );
}

function maskVerificationTarget(target: string, channel: 'EMAIL' | 'PHONE'): string {
  if (channel === 'EMAIL') {
    const [localPartRaw, domain = ''] = target.split('@');
    const localPart = localPartRaw ?? '';
    const visibleLocal = localPart.slice(0, 2);
    return `${visibleLocal}${'*'.repeat(Math.max(localPart.length - 2, 1))}@${domain}`;
  }

  const digits = target.replace(/[^\d+]/g, '');
  if (digits.length <= 4) {
    return `${'*'.repeat(Math.max(digits.length, 1))}`;
  }

  return `${digits.slice(0, 4)}${'*'.repeat(Math.max(digits.length - 6, 1))}${digits.slice(-2)}`;
}

function cacheDevVerificationCode(input: VerificationCodeNotificationInput): void {
  if (!isDevelopment) {
    return;
  }

  const createdAt = new Date().toISOString();
  const record: DevVerificationCodeRecord = {
    verificationSessionId: input.verificationSessionId,
    channel: input.channel,
    target: normalizeDevLookupTarget(input.target, input.channel),
    code: input.code,
    expiresInSeconds: input.expiresInSeconds,
    createdAt,
  };

  devVerificationCodeStore.set(input.verificationSessionId, record);

  if (devVerificationCodeStore.size > 100) {
    const oldestKey = Array.from(devVerificationCodeStore.entries()).sort((left, right) =>
      left[1].createdAt.localeCompare(right[1].createdAt),
    )[0]?.[0];

    if (oldestKey) {
      devVerificationCodeStore.delete(oldestKey);
    }
  }

  logger.info('[DEV ONLY] Verification code captured for manual QA', {
    verificationSessionId: input.verificationSessionId,
    channel: input.channel,
    target: maskVerificationTarget(input.target, input.channel),
  });
}

function normalizeDevLookupTarget(target: string, channel: 'EMAIL' | 'PHONE'): string {
  return channel === 'EMAIL' ? target.trim().toLowerCase() : target.replace(/[^\d+]/g, '');
}
