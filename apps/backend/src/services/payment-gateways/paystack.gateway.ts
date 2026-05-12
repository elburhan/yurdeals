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
    access_code?: string;
  };
}

interface PaystackWebhookPayload {
  event?: string;
  data?: {
    id?: number;
    reference?: string;
    amount?: number;
    currency?: string;
    status?: string;
    channel?: string;
    gateway_response?: string;
    paid_at?: string;
    authorization?: {
      authorization_code?: string;
      reusable?: boolean;
    };
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    id?: number;
    reference?: string;
    amount?: number;
    currency?: string;
    status?: string;
    channel?: string;
    gateway_response?: string;
    paid_at?: string;
    authorization?: {
      authorization_code?: string;
      reusable?: boolean;
    };
  };
}

interface PaystackChargeAuthorizationResponse {
  status: boolean;
  message: string;
  data?: {
    id?: number;
    reference?: string;
    amount?: number;
    currency?: string;
    status?: string;
    channel?: string;
    gateway_response?: string;
    paid_at?: string;
    authorization?: {
      authorization_code?: string;
      reusable?: boolean;
    };
  };
}

interface PaystackTransferRecipientResponse {
  status: boolean;
  message: string;
  data?: {
    active?: boolean;
    recipient_code?: string;
    type?: string;
    name?: string;
    currency?: string;
    details?: {
      account_number?: string;
      account_name?: string;
      bank_code?: string;
      bank_name?: string;
    };
  };
}

interface PaystackTransferResponse {
  status: boolean;
  message: string;
  data?: {
    id?: number;
    domain?: string;
    amount?: number;
    currency?: string;
    source?: string;
    reason?: string;
    recipient?: number | { recipient_code?: string; name?: string };
    status?: string;
    transfer_code?: string;
    reference?: string;
    integration?: number;
    createdAt?: string;
    updatedAt?: string;
  };
}

interface PaystackTransferFetchResponse extends PaystackTransferResponse {}

interface PaystackTransferWebhookPayload {
  event?: string;
  data?: {
    id?: number;
    reference?: string;
    amount?: number;
    currency?: string;
    status?: string;
    reason?: string;
    transfer_code?: string;
    recipient?: {
      recipient_code?: string;
      name?: string;
    };
    source?: string;
    createdAt?: string;
    updatedAt?: string;
  };
}

export interface CreateTransferRecipientInput {
  type: 'nuban' | 'mobile_money' | 'basa';
  name: string;
  accountNumber: string;
  bankCode: string;
  currency?: string;
  description?: string;
}

export interface TransferRecipientResult {
  recipientCode: string;
  type: string | null;
  name: string | null;
  currency: string | null;
  active: boolean;
  details: {
    accountNumber: string | null;
    accountName: string | null;
    bankCode: string | null;
    bankName: string | null;
  };
  providerResponse: unknown;
}

export interface InitiateTransferInput {
  amount: number;
  recipientCode: string;
  reason?: string;
  reference: string;
  source?: 'balance';
}

export interface TransferRecord {
  id: string | null;
  reference: string;
  transferCode: string | null;
  status: string | null;
  amount: number;
  currency: string;
  source: string | null;
  reason: string | null;
  recipientCode: string | null;
  recipientName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  providerResponse: unknown;
}

export interface PaystackTransferEvent {
  eventType: string;
  reference: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  amount: number;
  currency: string;
  transferCode: string | null;
  recipientCode: string | null;
  reason: string | null;
  source: string | null;
  occurredAt: string | null;
  raw: unknown;
}

export class PaystackGateway implements PaymentGateway {
  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    // Paystack initialize must happen server-side with the secret key.
    // The amount sent to /transaction/initialize is always in kobo, not naira.
    logger.debug('Initializing Paystack transaction', {
      url: 'https://api.paystack.co/transaction/initialize',
      keyPrefix: getKeyPrefix(env.PAYSTACK_SECRET_KEY),
      callbackUrl: env.PAYSTACK_CALLBACK_URL,
      reference: input.reference,
      orderId: input.orderId,
      paymentId: input.paymentId,
      amount: input.amount,
      amountInKobo: toPaystackKobo(input.amount),
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
        amount: toPaystackKobo(input.amount),
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
      accessCode: body.data.access_code ?? null,
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
      authorizationCode: getReusableAuthorizationCode(payload.data?.authorization),
      eventId: buildPaystackEventId(
        payload.event,
        payload.data?.id,
        reference,
        payload.data?.status,
      ),
      eventType: payload.event ?? 'paystack.webhook',
      providerTransactionId: payload.data?.id ? String(payload.data.id) : null,
      channel: payload.data?.channel ?? null,
      gatewayMessage: payload.data?.gateway_response ?? null,
      paidAt: payload.data?.paid_at ?? null,
      raw: payload,
    };
  }

  async verifyTransaction(reference: string): Promise<ProviderEvent> {
    // Paystack best practice: always verify the transaction reference from the backend
    // after any payment attempt. Never trust a frontend redirect or webhook success alone.
    logger.debug('Verifying Paystack transaction', {
      reference,
      url: `https://api.paystack.co/transaction/verify/${reference}`,
    });

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        },
      },
    );

    const body = (await response.json()) as PaystackVerifyResponse;

    if (!response.ok || !body.status || !body.data?.reference) {
      logger.warn('Paystack transaction verification failed', {
        status: response.status,
        reference,
        message: body.message,
      });

      throw new AppError(
        body.message || 'Unable to verify Paystack payment',
        502,
        'PAYSTACK_VERIFY_ERROR',
      );
    }

    return {
      provider: PaymentProvider.PAYSTACK,
      reference: body.data.reference,
      status: mapPaystackStatus('transaction.verify', body.data.status),
      amount: Number(body.data.amount ?? 0) / 100,
      currency: body.data.currency ?? 'NGN',
      authorizationCode: getReusableAuthorizationCode(body.data.authorization),
      eventId: buildPaystackEventId(
        'transaction.verify',
        body.data.id,
        body.data.reference,
        body.data.status,
      ),
      eventType: 'transaction.verify',
      providerTransactionId: body.data.id ? String(body.data.id) : null,
      channel: body.data.channel ?? null,
      gatewayMessage: body.data.gateway_response ?? null,
      paidAt: body.data.paid_at ?? null,
      raw: body,
    };
  }

  async chargeAuthorization(input: {
    authorizationCode: string;
    email: string;
    amount: number;
    currency: string;
    reference: string;
  }): Promise<ProviderEvent> {
    // Internal/admin-only flow for later charges. Like initialize, Paystack expects
    // the amount here in kobo and the request must be signed with the secret key.
    logger.info('Charging saved Paystack authorization', {
      reference: input.reference,
      email: input.email,
      amount: input.amount,
      amountInKobo: toPaystackKobo(input.amount),
      currency: input.currency,
    });

    const response = await fetch('https://api.paystack.co/transaction/charge_authorization', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authorization_code: input.authorizationCode,
        email: input.email,
        amount: toPaystackKobo(input.amount),
        currency: input.currency,
        reference: input.reference,
      }),
    });

    const body = (await response.json()) as PaystackChargeAuthorizationResponse;

    if (!response.ok || !body.status || !body.data?.reference) {
      logger.warn('Paystack charge_authorization failed', {
        status: response.status,
        reference: input.reference,
        message: body.message,
      });

      throw new AppError(
        body.message || 'Unable to charge saved Paystack authorization',
        502,
        'PAYSTACK_CHARGE_AUTHORIZATION_ERROR',
      );
    }

    return {
      provider: PaymentProvider.PAYSTACK,
      reference: body.data.reference,
      status: mapPaystackStatus('charge.authorization', body.data.status),
      amount: Number(body.data.amount ?? 0) / 100,
      currency: body.data.currency ?? input.currency,
      authorizationCode: getReusableAuthorizationCode(body.data.authorization),
      eventId: buildPaystackEventId(
        'charge.authorization',
        body.data.id,
        body.data.reference,
        body.data.status,
      ),
      eventType: 'charge.authorization',
      providerTransactionId: body.data.id ? String(body.data.id) : null,
      channel: body.data.channel ?? null,
      gatewayMessage: body.data.gateway_response ?? null,
      paidAt: body.data.paid_at ?? null,
      raw: body,
    };
  }

  async createTransferRecipient(
    input: CreateTransferRecipientInput,
  ): Promise<TransferRecipientResult> {
    logger.info('Creating Paystack transfer recipient', {
      type: input.type,
      name: input.name,
      bankCode: input.bankCode,
      currency: input.currency ?? 'NGN',
    });

    const response = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: input.type,
        name: input.name,
        account_number: input.accountNumber,
        bank_code: input.bankCode,
        currency: input.currency ?? 'NGN',
        description: input.description,
      }),
    });

    const body = (await response.json()) as PaystackTransferRecipientResponse;

    if (!response.ok || !body.status || !body.data?.recipient_code) {
      logger.warn('Paystack transfer recipient creation failed', {
        status: response.status,
        message: body.message,
        name: input.name,
      });

      throw new AppError(
        body.message || 'Unable to create transfer recipient',
        502,
        'PAYSTACK_TRANSFER_RECIPIENT_ERROR',
      );
    }

    return {
      recipientCode: body.data.recipient_code,
      type: body.data.type ?? null,
      name: body.data.name ?? null,
      currency: body.data.currency ?? null,
      active: body.data.active ?? false,
      details: {
        accountNumber: body.data.details?.account_number ?? null,
        accountName: body.data.details?.account_name ?? null,
        bankCode: body.data.details?.bank_code ?? null,
        bankName: body.data.details?.bank_name ?? null,
      },
      providerResponse: body,
    };
  }

  async initiateTransfer(input: InitiateTransferInput): Promise<TransferRecord> {
    logger.info('Initiating Paystack transfer', {
      reference: input.reference,
      recipientCode: input.recipientCode,
      amount: input.amount,
      amountInKobo: toPaystackKobo(input.amount),
      source: input.source ?? 'balance',
    });

    const response = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: input.source ?? 'balance',
        amount: toPaystackKobo(input.amount),
        recipient: input.recipientCode,
        reason: input.reason,
        reference: input.reference,
      }),
    });

    const body = (await response.json()) as PaystackTransferResponse;

    if (!response.ok || !body.status || !body.data?.reference) {
      logger.warn('Paystack transfer initiation failed', {
        status: response.status,
        reference: input.reference,
        message: body.message,
      });

      throw new AppError(body.message || 'Unable to initiate transfer', 502, 'PAYSTACK_TRANSFER_ERROR');
    }

    return mapTransferRecord(body);
  }

  async fetchTransfer(referenceOrId: string): Promise<TransferRecord> {
    logger.debug('Fetching Paystack transfer', {
      referenceOrId,
      url: `https://api.paystack.co/transfer/${referenceOrId}`,
    });

    const response = await fetch(
      `https://api.paystack.co/transfer/${encodeURIComponent(referenceOrId)}`,
      {
        headers: {
          Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        },
      },
    );

    const body = (await response.json()) as PaystackTransferFetchResponse;

    if (!response.ok || !body.status || !body.data?.reference) {
      logger.warn('Paystack transfer fetch failed', {
        status: response.status,
        referenceOrId,
        message: body.message,
      });

      throw new AppError(body.message || 'Unable to fetch transfer', 502, 'PAYSTACK_TRANSFER_FETCH_ERROR');
    }

    return mapTransferRecord(body);
  }

  parseTransferWebhookEvent(rawBody: string | Buffer): PaystackTransferEvent {
    const payload = JSON.parse(
      Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody,
    ) as PaystackTransferWebhookPayload;
    const reference = payload.data?.reference;

    if (!reference) {
      throw new AppError('Transfer webhook reference missing', 422, 'TRANSFER_WEBHOOK_REFERENCE_MISSING');
    }

    return {
      eventType: payload.event ?? 'transfer.webhook',
      reference,
      status: mapTransferStatus(payload.event, payload.data?.status),
      amount: Number(payload.data?.amount ?? 0) / 100,
      currency: payload.data?.currency ?? 'NGN',
      transferCode: payload.data?.transfer_code ?? null,
      recipientCode: payload.data?.recipient?.recipient_code ?? null,
      reason: payload.data?.reason ?? null,
      source: payload.data?.source ?? null,
      occurredAt: payload.data?.updatedAt ?? payload.data?.createdAt ?? null,
      raw: payload,
    };
  }
}

function toPaystackKobo(amount: number): number {
  return Math.round(amount * 100);
}

function getKeyPrefix(key: string): string {
  return key ? `${key.slice(0, 7)}...` : 'missing';
}

function mapPaystackStatus(event?: string, status?: string): ProviderEvent['status'] {
  if (event === 'charge.success' || status === 'success') {
    return 'SUCCESS';
  }

  if (status === 'failed' || status === 'abandoned' || status === 'reversed') {
    return 'FAILED';
  }

  return 'PENDING';
}

function buildPaystackEventId(
  event: string | undefined,
  transactionId: number | undefined,
  reference: string,
  status: string | undefined,
): string {
  if (transactionId) {
    return `paystack:${event ?? 'event'}:${transactionId}`;
  }

  return `paystack:${event ?? 'event'}:${reference}:${status ?? 'unknown'}`;
}

function mapTransferRecord(body: PaystackTransferResponse): TransferRecord {
  return {
    id: body.data?.id ? String(body.data.id) : null,
    reference: body.data?.reference ?? '',
    transferCode: body.data?.transfer_code ?? null,
    status: body.data?.status ?? null,
    amount: Number(body.data?.amount ?? 0) / 100,
    currency: body.data?.currency ?? 'NGN',
    source: body.data?.source ?? null,
    reason: body.data?.reason ?? null,
    recipientCode:
      typeof body.data?.recipient === 'object' ? body.data?.recipient?.recipient_code ?? null : null,
    recipientName:
      typeof body.data?.recipient === 'object' ? body.data?.recipient?.name ?? null : null,
    createdAt: body.data?.createdAt ?? null,
    updatedAt: body.data?.updatedAt ?? null,
    providerResponse: body,
  };
}

function mapTransferStatus(
  event?: string,
  status?: string,
): 'SUCCESS' | 'FAILED' | 'PENDING' {
  if (event === 'transfer.success' || status === 'success') {
    return 'SUCCESS';
  }

  if (event === 'transfer.failed' || status === 'failed' || status === 'reversed') {
    return 'FAILED';
  }

  return 'PENDING';
}

function getReusableAuthorizationCode(
  authorization:
    | {
        authorization_code?: string;
        reusable?: boolean;
      }
    | undefined,
): string | null {
  if (!authorization?.authorization_code || authorization.reusable === false) {
    return null;
  }

  return authorization.authorization_code;
}

function withPaymentReturnParams(baseUrl: string, input: InitializePaymentInput): string {
  const url = new URL(baseUrl);
  url.searchParams.set('orderId', input.orderId);
  url.searchParams.set('paymentId', input.paymentId);
  url.searchParams.set('reference', input.reference);
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
