// ============================================
// Payment Service
// ============================================

import crypto from 'crypto';
import { PaymentProvider } from '@prisma/client';
import { PaymentInitiationData, PaymentStatusData } from '@yurdeals/shared';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils';
import { paymentRepository } from '../repositories/payment.repository';
import { InitiateGuestPaymentInput, InitiatePaymentInput } from '../schemas/payment.schema';
import { FlutterwaveGateway } from './payment-gateways/flutterwave.gateway';
import { writeAuditLog } from './audit.service';
import { notifyPaymentFailed, notifyPaymentSuccess } from './notification.service';
import { PaymentGateway, ProviderEvent } from './payment-gateways/paymentGateway.types';
import { PaystackGateway } from './payment-gateways/paystack.gateway';
import { handleOrderStatusTransition } from './shipmentEvent.service';
import { CreateOrderInput } from '../schemas/order.schema';
import { orderRepository } from '../repositories/order.repository';

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
  const { order, payment } = await paymentRepository.createPendingPayment(
    userId,
    orderId,
    provider,
    reference,
  );

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
  const { order, payment } = await paymentRepository.createPendingGuestPayment(
    orderId,
    input.guest_access_token,
    provider,
    reference,
  );

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

export async function checkoutWithPaystack(
  userId: string,
  input: CreateOrderInput,
): Promise<{ order: import('@yurdeals/shared').OrderSummary; payment: import('@yurdeals/shared').PaymentSummary; authorizationUrl: string; reference: string; accessCode?: string | null; }> {
  const provider = PaymentProvider.PAYSTACK;
  const gateway = getGateway(provider);
  const reference = createPaymentReference(provider);
  const checkout = await orderRepository.createCheckoutFromCart(userId, input, provider, reference);

  const result = await gateway.initializePayment({
    amount: checkout.payment.amount,
    currency: checkout.payment.currency,
    orderId: checkout.order.id,
    paymentId: checkout.payment.id,
    reference,
    email: 'customerEmail' in checkout.payment && checkout.payment.customerEmail ? checkout.payment.customerEmail : 'payments@yurdeals.com',
    name: checkout.order.shippingAddress
      ? `${checkout.order.shippingAddress.firstName} ${checkout.order.shippingAddress.lastName}`
      : 'YurDeals Customer',
  });

  const payment = await paymentRepository.updatePaymentMetadata(checkout.payment.id, {
    authorizationUrl: result.authorizationUrl,
    accessCode: result.accessCode ?? null,
    providerRef: result.reference,
    gatewayResponse: JSON.stringify(result.providerResponse),
    metadata: {
      reference,
      authorizationUrl: result.authorizationUrl,
      provider,
      flow: 'CHECKOUT',
    },
  });

  return {
    order: checkout.order,
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

  return { payment };
}

export async function getGuestPaymentStatus(
  orderId: string,
  paymentId: string,
  guestAccessToken: string,
): Promise<PaymentStatusData> {
  const payment = await paymentRepository.findGuestPayment(orderId, paymentId, guestAccessToken);

  if (!payment) {
    throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
  }

  return { payment };
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

  if (provider === PaymentProvider.FLUTTERWAVE) {
    event = await verifyFlutterwaveEvent(event);
  }

  const payment = await paymentRepository.processWebhookEvent(event);

  if (payment) {
    const context = await paymentRepository.findPaymentEventContext(payment.id);

    if (context && payment.status === 'SUCCESS') {
      await notifyPaymentSuccess(context.order.userId, context.order, context.payment);
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
          amount: event.amount,
          currency: event.currency,
        },
      });
    }

    if (context && payment.status === 'FAILED') {
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
          amount: event.amount,
          currency: event.currency,
        },
      });
    }
  } else {
    await writeAuditLog({
      action: 'PAYMENT_WEBHOOK_IGNORED',
      entity: 'Payment',
      entityId: event.reference,
      newData: {
        provider,
        reference: event.reference,
        status: event.status,
      },
    });
  }

  logger.info('Payment webhook processed', {
    provider,
    reference: event.reference,
    status: event.status,
    paymentId: payment?.id,
  });

  return payment ? { payment } : null;
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
