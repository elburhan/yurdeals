// ============================================
// Paystack Gateway
// ============================================

import crypto from 'crypto';
import { PaymentProvider } from '@prisma/client';
import { env } from '../../config';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils';
import {
  InitializePaymentInput,
  InitializePaymentResult,
  PaymentGateway,
  ProviderEvent,
} from './paymentGateway.types';

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    reference: string;
  };
}

interface PaystackWebhookPayload {
  event?: string;
  data?: {
    reference?: string;
    amount?: number;
    currency?: string;
    status?: string;
  };
}

export class PaystackGateway implements PaymentGateway {
  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    logger.debug('Initializing Paystack transaction', {
      url: 'https://api.paystack.co/transaction/initialize',
      keyPrefix: getKeyPrefix(env.PAYSTACK_SECRET_KEY),
      callbackUrl: env.PAYSTACK_CALLBACK_URL,
      reference: input.reference,
      orderId: input.orderId,
      paymentId: input.paymentId,
      amount: input.amount,
      currency: input.currency,
    });

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: input.email,
        amount: Math.round(input.amount * 100),
        currency: input.currency,
        reference: input.reference,
        callback_url: withPaymentReturnParams(env.PAYSTACK_CALLBACK_URL, input),
        metadata: {
          orderId: input.orderId,
          paymentId: input.paymentId,
          customerName: input.name,
        },
      }),
    });

    const body = (await response.json()) as PaystackInitializeResponse;

    if (!response.ok || !body.status || !body.data?.authorization_url) {
      logger.warn('Paystack transaction initialization failed', {
        status: response.status,
        message: body.message,
        keyPrefix: getKeyPrefix(env.PAYSTACK_SECRET_KEY),
        reference: input.reference,
      });

      throw new AppError(
        body.message || 'Unable to initialize Paystack payment',
        502,
        'PAYSTACK_ERROR',
      );
    }

    return {
      authorizationUrl: body.data.authorization_url,
      reference: body.data.reference,
      providerResponse: body,
    };
  }

  verifyWebhookSignature(rawBody: string | Buffer, headers: Record<string, string>): boolean {
    const signature = headers['x-paystack-signature'];
    if (!signature) {
      return false;
    }

    const digest = crypto
      .createHmac('sha512', env.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest('hex');

    return timingSafeEqual(signature, digest);
  }

  parseWebhookEvent(rawBody: string | Buffer): ProviderEvent {
    const payload = JSON.parse(
      Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody,
    ) as PaystackWebhookPayload;
    const reference = payload.data?.reference;

    if (!reference) {
      throw new AppError('Webhook reference missing', 422, 'WEBHOOK_REFERENCE_MISSING');
    }

    return {
      provider: PaymentProvider.PAYSTACK,
      reference,
      status: mapPaystackStatus(payload.event, payload.data?.status),
      amount: Number(payload.data?.amount ?? 0) / 100,
      currency: payload.data?.currency ?? 'NGN',
      raw: payload,
    };
  }
}

function getKeyPrefix(key: string): string {
  return key ? `${key.slice(0, 7)}...` : 'missing';
}

function mapPaystackStatus(event?: string, status?: string): ProviderEvent['status'] {
  if (event === 'charge.success' || status === 'success') {
    return 'SUCCESS';
  }

  if (status === 'failed' || status === 'abandoned') {
    return 'FAILED';
  }

  return 'PENDING';
}

function withPaymentReturnParams(baseUrl: string, input: InitializePaymentInput): string {
  const url = new URL(baseUrl);
  url.searchParams.set('orderId', input.orderId);
  url.searchParams.set('paymentId', input.paymentId);
  url.searchParams.set('reference', input.reference);
  if (input.guestAccessToken) {
    url.searchParams.set('guestAccessToken', input.guestAccessToken);
  }
  return url.toString();
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
