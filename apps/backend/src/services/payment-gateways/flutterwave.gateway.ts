// ============================================
// Flutterwave Gateway
// ============================================

import crypto from 'crypto';
import { PaymentProvider } from '@prisma/client';
import { env } from '../../config';
import { AppError } from '../../middleware/errorHandler';
import {
  InitializePaymentInput,
  InitializePaymentResult,
  PaymentGateway,
  ProviderEvent,
} from './paymentGateway.types';

interface FlutterwaveInitializeResponse {
  status: string;
  message: string;
  data?: {
    link: string;
  };
}

interface FlutterwaveWebhookPayload {
  event?: string;
  data?: {
    tx_ref?: string;
    amount?: number;
    currency?: string;
    status?: string;
  };
}

interface FlutterwaveVerifyResponse {
  status: string;
  message: string;
  data?: {
    tx_ref?: string;
    amount?: number;
    currency?: string;
    status?: string;
  };
}

export class FlutterwaveGateway implements PaymentGateway {
  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: input.reference,
        amount: input.amount,
        currency: input.currency,
        redirect_url: withPaymentReturnParams(env.FLUTTERWAVE_CALLBACK_URL, input),
        customer: {
          email: input.email,
          name: input.name,
        },
        meta: {
          orderId: input.orderId,
          paymentId: input.paymentId,
        },
      }),
    });

    const body = (await response.json()) as FlutterwaveInitializeResponse;

    if (!response.ok || body.status !== 'success' || !body.data?.link) {
      throw new AppError(
        body.message || 'Unable to initialize Flutterwave payment',
        502,
        'FLUTTERWAVE_ERROR',
      );
    }

    return {
      authorizationUrl: body.data.link,
      reference: input.reference,
      accessCode: null,
      providerResponse: body,
    };
  }

  verifyWebhookSignature(rawBody: string | Buffer, headers: Record<string, string>): boolean {
    const signature = headers['flutterwave-signature'];
    if (!signature) {
      return false;
    }

    const digest = crypto
      .createHmac('sha256', env.FLUTTERWAVE_WEBHOOK_SECRET_HASH)
      .update(rawBody)
      .digest('hex');

    return timingSafeEqual(signature, digest);
  }

  parseWebhookEvent(rawBody: string | Buffer): ProviderEvent {
    const payload = JSON.parse(
      Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody,
    ) as FlutterwaveWebhookPayload;
    const reference = payload.data?.tx_ref;

    if (!reference) {
      throw new AppError('Webhook reference missing', 422, 'WEBHOOK_REFERENCE_MISSING');
    }

    return {
      provider: PaymentProvider.FLUTTERWAVE,
      reference,
      status: mapFlutterwaveStatus(payload.data?.status),
      amount: Number(payload.data?.amount ?? 0),
      currency: payload.data?.currency ?? 'NGN',
      eventId: `flutterwave:${payload.event ?? 'event'}:${reference}`,
      eventType: payload.event ?? 'flutterwave.webhook',
      providerTransactionId: null,
      raw: payload,
    };
  }

  async verifyTransaction(reference: string): Promise<ProviderEvent> {
    const url = new URL('https://api.flutterwave.com/v3/transactions/verify_by_reference');
    url.searchParams.set('tx_ref', reference);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
      },
    });

    const body = (await response.json()) as FlutterwaveVerifyResponse;

    if (!response.ok || body.status !== 'success' || !body.data?.tx_ref) {
      throw new AppError(
        body.message || 'Unable to verify Flutterwave transaction',
        502,
        'FLUTTERWAVE_VERIFY_ERROR',
      );
    }

    return {
      provider: PaymentProvider.FLUTTERWAVE,
      reference: body.data.tx_ref,
      status: mapFlutterwaveStatus(body.data.status),
      amount: Number(body.data.amount ?? 0),
      currency: body.data.currency ?? 'NGN',
      eventId: `flutterwave:transaction.verify:${body.data.tx_ref}`,
      eventType: 'transaction.verify',
      providerTransactionId: null,
      raw: body,
    };
  }
}

function mapFlutterwaveStatus(status?: string): ProviderEvent['status'] {
  if (status === 'successful') {
    return 'SUCCESS';
  }

  if (status === 'failed' || status === 'cancelled') {
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
