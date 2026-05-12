// ============================================
// Payment Service
// ============================================

import crypto from 'crypto';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { PaymentInitiationData, PaymentStatusData } from '@yurdeals/shared';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils';
import {
  paymentRepository,
  PENDING_PAYMENT_STALE_WINDOW_MS,
  VerifiablePaymentRecord,
} from '../repositories/payment.repository';
import { InitiateGuestPaymentInput, InitiatePaymentInput } from '../schemas/payment.schema';
import { FlutterwaveGateway } from './payment-gateways/flutterwave.gateway';
import { writeAuditLog } from './audit.service';
import { notifyPaymentFailed, notifyPaymentSuccess } from './notification.service';
import { PaymentGateway, ProviderEvent } from './payment-gateways/paymentGateway.types';
import { PaystackGateway } from './payment-gateways/paystack.gateway';
import { handleOrderStatusTransition } from './shipmentEvent.service';
import { mapPayment } from '../repositories/order.repository';
import { verifyGuestOrderAccess } from './guestOrderAccess.service';

const gateways = {
  PAYSTACK: new PaystackGateway(),
  FLUTTERWAVE: new FlutterwaveGateway(),
} satisfies Record<Extract<PaymentProvider, 'PAYSTACK' | 'FLUTTERWAVE'>, PaymentGateway>;

export async function initiatePayment(
  userId: string,
  orderId: string,
  input: InitiatePaymentInput,
): Promise<PaymentInitiationData> {
  const provider = input.provider as Extract<PaymentProvider, 'PAYSTACK' | 'FLUTTERWAVE'>;
  const gateway = getGateway(provider);
  const reference = createPaymentReference(provider);
  const preparedAttempt = await paymentRepository.prepareOwnedPaymentAttempt(
    userId,
    orderId,
    provider,
    reference,
  );

  if (preparedAttempt.resolution === 'REUSED_PENDING') {
    logger.info('Reusing active pending payment attempt', {
      paymentId: preparedAttempt.payment.id,
      orderId: preparedAttempt.order.id,
      provider,
      staleWindowMinutes: Math.floor(PENDING_PAYMENT_STALE_WINDOW_MS / 60000),
    });

    return {
      payment: preparedAttempt.payment,
      authorizationUrl: assertAuthorizationUrl(preparedAttempt.payment),
      reference: preparedAttempt.payment.providerRef ?? preparedAttempt.payment.reference,
      accessCode: preparedAttempt.payment.accessCode ?? null,
    };
  }

  const { order, payment } = preparedAttempt;
  // References are generated server-side and stored before initialize so every provider
  // callback, webhook, and verify call can reconcile against a unique local payment record.

  const result = await gateway.initializePayment({
    amount: payment.amount,
    currency: payment.currency,
    orderId: order.id,
    paymentId: payment.id,
    reference,
    email: getPaystackCustomerEmail(order.user.email, order.notes),
    name: `${order.user.firstName} ${order.user.lastName}`,
  });

  await paymentRepository.updatePaymentMetadata(payment.id, {
    authorizationUrl: result.authorizationUrl,
    accessCode: result.accessCode ?? null,
    providerRef: result.reference,
    gatewayResponse: JSON.stringify(result.providerResponse),
    metadata: {
      reference,
      authorizationUrl: result.authorizationUrl,
      provider: payment.provider,
    },
  });

  logger.info('Payment initiated', {
    paymentId: payment.id,
    orderId: order.id,
    provider,
  });

  return {
    payment,
    authorizationUrl: result.authorizationUrl,
    reference: result.reference,
    accessCode: result.accessCode ?? null,
  };
}

export async function initiateGuestPayment(
  orderId: string,
  input: InitiateGuestPaymentInput,
): Promise<PaymentInitiationData> {
  const provider = input.provider as Extract<PaymentProvider, 'PAYSTACK' | 'FLUTTERWAVE'>;
  const gateway = getGateway(provider);
  const reference = createPaymentReference(provider);
  await verifyGuestOrderAccess(orderId, input.guest_access_token);
  const preparedAttempt = await paymentRepository.prepareGuestPaymentAttempt(
    orderId,
    provider,
    reference,
  );

  if (preparedAttempt.resolution === 'REUSED_PENDING') {
    logger.info('Reusing active guest pending payment attempt', {
      paymentId: preparedAttempt.payment.id,
      orderId: preparedAttempt.order.id,
      provider,
      staleWindowMinutes: Math.floor(PENDING_PAYMENT_STALE_WINDOW_MS / 60000),
    });

    return {
      payment: preparedAttempt.payment,
      authorizationUrl: assertAuthorizationUrl(preparedAttempt.payment),
      reference: preparedAttempt.payment.providerRef ?? preparedAttempt.payment.reference,
      accessCode: preparedAttempt.payment.accessCode ?? null,
    };
  }

  const { order, payment } = preparedAttempt;
  // Guest and authenticated flows both create and store the server-side reference first.

  const result = await gateway.initializePayment({
    amount: payment.amount,
    currency: payment.currency,
    orderId: order.id,
    paymentId: payment.id,
    reference,
    email: getPaystackCustomerEmail(order.user.email, order.notes),
    name: `${order.user.firstName} ${order.user.lastName}`,
    guestAccessToken: input.guest_access_token,
  });

  await paymentRepository.updatePaymentMetadata(payment.id, {
    authorizationUrl: result.authorizationUrl,
    accessCode: result.accessCode ?? null,
    providerRef: result.reference,
    gatewayResponse: JSON.stringify(result.providerResponse),
    metadata: {
      reference,
      authorizationUrl: result.authorizationUrl,
      provider: payment.provider,
      customerType: 'GUEST',
    },
  });

  logger.info('Guest payment initiated', {
    paymentId: payment.id,
    orderId: order.id,
    provider,
  });

  return {
    payment,
    authorizationUrl: result.authorizationUrl,
    reference: result.reference,
    accessCode: result.accessCode ?? null,
  };
}

export async function getPaymentStatus(
  userId: string,
  orderId: string,
  paymentId: string,
): Promise<PaymentStatusData> {
  const payment = await paymentRepository.findOwnedPayment(userId, orderId, paymentId);

  if (!payment) {
    throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
  }

  if (shouldVerifyPayment(payment.status)) {
    return verifyPayment(userId, orderId, paymentId);
  }

  return { payment };
}

export async function getGuestPaymentStatus(
  orderId: string,
  paymentId: string,
  guestAccessToken: string,
): Promise<PaymentStatusData> {
  await verifyGuestOrderAccess(orderId, guestAccessToken);
  const payment = await paymentRepository.findGuestPayment(orderId, paymentId);

  if (!payment) {
    throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
  }

  if (shouldVerifyPayment(payment.status)) {
    return verifyGuestPayment(orderId, paymentId, guestAccessToken);
  }

  return { payment };
}

export async function verifyPayment(
  userId: string,
  orderId: string,
  paymentId: string,
): Promise<PaymentStatusData> {
  const payment = await paymentRepository.findOwnedPaymentForVerification(userId, orderId, paymentId);

  if (!payment) {
    throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
  }

  return verifyPaymentRecord(payment);
}

export async function verifyGuestPayment(
  orderId: string,
  paymentId: string,
  guestAccessToken: string,
): Promise<PaymentStatusData> {
  await verifyGuestOrderAccess(orderId, guestAccessToken);
  const payment = await paymentRepository.findGuestPaymentForVerification(
    orderId,
    paymentId,
  );

  if (!payment) {
    throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
  }

  return verifyPaymentRecord(payment);
}

export async function chargeAuthorization(
  orderId: string,
  amount: number,
): Promise<PaymentStatusData> {
  const gateway = gateways.PAYSTACK;

  if (!(gateway instanceof PaystackGateway)) {
    throw new AppError(
      'Paystack authorization charges are not available',
      500,
      'PAYSTACK_GATEWAY_UNAVAILABLE',
    );
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError(
      'Authorization charge amount must be greater than zero.',
      422,
      'INVALID_AUTHORIZATION_CHARGE_AMOUNT',
    );
  }

  const reference = createPaymentReference(PaymentProvider.PAYSTACK);
  const { order, payment, storedAuthorization } = await paymentRepository.prepareAuthorizationCharge(
    orderId,
    reference,
    amount,
  );

  logger.warn('Starting internal Paystack authorization charge', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentId: payment.id,
    reference,
    sourcePaymentId: storedAuthorization.paymentId,
    amount,
  });

  // Internal/admin-only flow:
  // 1. charge the saved authorization code from the backend
  // 2. immediately verify the new reference with Paystack
  // 3. only then persist the payment as successful
  await gateway.chargeAuthorization({
    authorizationCode: storedAuthorization.authorizationCode,
    email: storedAuthorization.customerEmail ?? order.user.email,
    amount,
    currency: order.currency,
    reference,
  });

  const verifiablePayment = await paymentRepository.findPaymentForCallbackVerification(
    order.id,
    payment.id,
    reference,
  );

  if (!verifiablePayment) {
    throw new AppError(
      'Authorization charge payment could not be reloaded for verification.',
      500,
      'PAYMENT_NOT_FOUND',
    );
  }

  return verifyPaymentRecord(verifiablePayment);
}

export async function handlePaymentWebhook(
  providerSlug: 'paystack' | 'flutterwave',
  rawBody: Buffer,
  headers: Record<string, string>,
): Promise<PaymentStatusData | null> {
  const provider =
    providerSlug === 'paystack' ? PaymentProvider.PAYSTACK : PaymentProvider.FLUTTERWAVE;
  const gateway = getGateway(provider);

  logger.info('Payment webhook received', { provider });

  if (!gateway.verifyWebhookSignature(rawBody, headers)) {
    throw new AppError('Invalid webhook signature', 401, 'INVALID_WEBHOOK_SIGNATURE');
  }

  let event = gateway.parseWebhookEvent(rawBody, headers);

  if (provider === PaymentProvider.PAYSTACK) {
    // Paystack best practice: treat the signed webhook as a trigger to verify the reference,
    // not as proof of payment success. We always call /transaction/verify before updating state.
    event = await verifyPaystackEvent(event);
  } else if (provider === PaymentProvider.FLUTTERWAVE) {
    event = await verifyFlutterwaveEvent(event);
  }

  const result = await paymentRepository.processWebhookEvent(event);

  if (!result.payment) {
    await writeAuditLog({
      action: 'PAYMENT_WEBHOOK_IGNORED',
      entity: 'Payment',
      entityId: event.reference,
      newData: {
        provider,
        reference: event.reference,
        status: event.status,
        reason: 'PAYMENT_NOT_FOUND',
      },
    });

    logger.warn('Payment webhook ignored because payment was not found', {
      provider,
      reference: event.reference,
      eventId: result.eventId,
    });

    return null;
  }

  if (result.mismatch) {
    await writeAuditLog({
      action: 'PAYMENT_WEBHOOK_MISMATCH',
      entity: 'Payment',
      entityId: result.payment.id,
      newData: {
        provider,
        reference: event.reference,
        eventId: result.eventId,
        amount: event.amount,
        currency: event.currency,
      },
    });

    logger.error('Payment webhook failed reconciliation checks', {
      provider,
      paymentId: result.payment.id,
      reference: event.reference,
      eventId: result.eventId,
    });

    return { payment: result.payment };
  }

  if (result.duplicate) {
    logger.info('Duplicate payment webhook ignored', {
      provider,
      paymentId: result.payment.id,
      reference: event.reference,
      eventId: result.eventId,
    });

    return { payment: result.payment };
  }

  const payment = result.payment;
  const context = await paymentRepository.findPaymentEventContext(payment.id);

  if (context && result.statusChanged && payment.status === 'SUCCESS') {
    await notifyPaymentSuccess(
      context.order.userId,
      context.order,
      context.payment,
      buildGuestNotificationRecipient(context),
    );
    await handleOrderStatusTransition(context.order.id, 'PAYMENT_CONFIRMED');
    await writeAuditLog({
      userId: context.order.userId,
      action: 'PAYMENT_WEBHOOK_SUCCESS',
      entity: 'Payment',
      entityId: context.payment.id,
      newData: {
        orderId: context.order.id,
        provider,
        reference: event.reference,
        eventId: result.eventId,
        amount: event.amount,
        currency: event.currency,
      },
    });
  }

  if (context && result.statusChanged && payment.status === 'FAILED') {
    await notifyPaymentFailed(context.order.userId, context.order, context.payment);
    await writeAuditLog({
      userId: context.order.userId,
      action: 'PAYMENT_WEBHOOK_FAILED',
      entity: 'Payment',
      entityId: context.payment.id,
      newData: {
        orderId: context.order.id,
        provider,
        reference: event.reference,
        eventId: result.eventId,
        amount: event.amount,
        currency: event.currency,
      },
    });
  }

  if (result.ignored) {
    await writeAuditLog({
      action: 'PAYMENT_WEBHOOK_IGNORED',
      entity: 'Payment',
      entityId: payment.id,
      newData: {
        provider,
        reference: event.reference,
        eventId: result.eventId,
        status: event.status,
      },
    });
  }

  logger.info('Payment webhook processed', {
    provider,
    reference: event.reference,
    status: event.status,
    paymentId: payment.id,
    eventId: result.eventId,
    duplicate: result.duplicate,
    statusChanged: result.statusChanged,
  });

  return { payment };
}

export async function verifyPaymentReturn(params: {
  orderId?: string;
  paymentId?: string;
  reference?: string;
}): Promise<void> {
  const { orderId, paymentId, reference } = params;

  if (!orderId || !paymentId || !reference) {
    return;
  }

  const payment = await paymentRepository.findPaymentForCallbackVerification(
    orderId,
    paymentId,
    reference,
  );

  if (!payment) {
    logger.warn('Payment callback verification skipped because payment was not found', {
      orderId,
      paymentId,
      reference,
    });
    return;
  }

  // Paystack recommends verifying after redirect/callback as well.
  // This keeps the redirect path safe even if the webhook is delayed.
  await verifyPaymentRecord(payment);
}

async function verifyPaymentRecord(
  payment: VerifiablePaymentRecord,
): Promise<PaymentStatusData> {
  if (!shouldVerifyPayment(payment.status)) {
    return { payment: mapPayment(payment) };
  }

  const gateway = getGateway(payment.provider as Extract<PaymentProvider, 'PAYSTACK' | 'FLUTTERWAVE'>);

  if (!gateway.verifyTransaction) {
    return { payment: mapPayment(payment) };
  }

  // Always verify against the provider reference first when present. This keeps Paystack
  // reconciliation tied to the exact stored transaction reference instead of trusting UI state.
  const reference = payment.providerRef || payment.reference;
  logger.info('Verifying payment with provider', {
    paymentId: payment.id,
    orderId: payment.order.id,
    provider: payment.provider,
    reference,
  });

  const event = await gateway.verifyTransaction(reference);
  const result = await paymentRepository.processWebhookEvent(event);

  if (!result.payment) {
    throw new AppError('Payment verification did not match a payment record', 404, 'PAYMENT_NOT_FOUND');
  }

  if (result.mismatch) {
    throw new AppError(
      'Payment verification failed reconciliation checks',
      409,
      'PAYMENT_MISMATCH',
    );
  }

  if (result.statusChanged && result.payment.status === 'SUCCESS') {
    const context = await paymentRepository.findPaymentEventContext(result.payment.id);

    if (context) {
      await notifyPaymentSuccess(
        context.order.userId,
        context.order,
        context.payment,
        buildGuestNotificationRecipient(context),
      );
      await handleOrderStatusTransition(context.order.id, 'PAYMENT_CONFIRMED');
      await writeAuditLog({
        userId: context.order.userId,
        action: 'PAYMENT_VERIFIED_SUCCESS',
        entity: 'Payment',
        entityId: context.payment.id,
        newData: {
          orderId: context.order.id,
          provider: payment.provider,
          reference: event.reference,
          amount: event.amount,
          currency: event.currency,
        },
      });
    }
  }

  if (result.statusChanged && result.payment.status === 'FAILED') {
    const context = await paymentRepository.findPaymentEventContext(result.payment.id);

    if (context) {
      await notifyPaymentFailed(context.order.userId, context.order, context.payment);
      await writeAuditLog({
        userId: context.order.userId,
        action: 'PAYMENT_VERIFIED_FAILED',
        entity: 'Payment',
        entityId: context.payment.id,
        newData: {
          orderId: context.order.id,
          provider: payment.provider,
          reference: event.reference,
          amount: event.amount,
          currency: event.currency,
        },
      });
    }
  }

  return { payment: result.payment };
}

function getGateway(
  provider: Extract<PaymentProvider, 'PAYSTACK' | 'FLUTTERWAVE'>,
): PaymentGateway {
  return gateways[provider];
}

async function verifyFlutterwaveEvent(event: ProviderEvent): Promise<ProviderEvent> {
  const gateway = gateways.FLUTTERWAVE;

  if (!(gateway instanceof FlutterwaveGateway)) {
    return event;
  }

  return gateway.verifyTransaction(event.reference);
}

async function verifyPaystackEvent(event: ProviderEvent): Promise<ProviderEvent> {
  const gateway = gateways.PAYSTACK;

  if (!(gateway instanceof PaystackGateway)) {
    return event;
  }

  return gateway.verifyTransaction(event.reference);
}

function shouldVerifyPayment(status: PaymentStatusData['payment']['status']): boolean {
  return status === PaymentStatus.PENDING || status === PaymentStatus.AUTHORIZED;
}

function buildGuestNotificationRecipient(
  context: Awaited<ReturnType<typeof paymentRepository.findPaymentEventContext>>,
): { email: string; name: string } | undefined {
  if (!context || !context.order.notes?.includes('[customerType:GUEST]')) {
    return undefined;
  }

  const email = context.payment.customerEmail?.trim().toLowerCase();
  if (!email) {
    return undefined;
  }

  const firstName = context.order.shippingAddress?.firstName?.trim() ?? '';
  const lastName = context.order.shippingAddress?.lastName?.trim() ?? '';

  return {
    email,
    name: `${firstName} ${lastName}`.trim() || 'there',
  };
}

function assertAuthorizationUrl(payment: PaymentInitiationData['payment']): string {
  if (!payment.authorizationUrl) {
    throw new AppError(
      'Payment link is no longer available. Please start payment again.',
      409,
      'PAYMENT_LINK_UNAVAILABLE',
    );
  }

  return payment.authorizationUrl;
}

function createPaymentReference(provider: PaymentProvider): string {
  const prefix = provider === PaymentProvider.PAYSTACK ? 'PSK' : 'FLW';
  return `YD-${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(4)
    .toString('hex')
    .toUpperCase()}`;
}

function getPaystackCustomerEmail(userEmail: string, orderNotes: string | null): string {
  const guestEmail = orderNotes?.match(/\[guestEmail:([^\]]+)\]/)?.[1];
  const candidate = guestEmail || userEmail;

  if (isPaystackSafeEmail(candidate)) {
    return candidate;
  }

  return 'payments@yurdeals.com';
}

function isPaystackSafeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.toLowerCase().endsWith('.local');
}
