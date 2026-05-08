// ============================================
// Payment Gateway Types
// ============================================

import { PaymentProvider } from '@prisma/client';

export interface InitializePaymentInput {
  amount: number;
  currency: string;
  orderId: string;
  paymentId: string;
  reference: string;
  email: string;
  name: string;
  guestAccessToken?: string;
}

export interface InitializePaymentResult {
  authorizationUrl: string;
  reference: string;
  accessCode?: string | null;
  providerResponse: unknown;
}

export interface ProviderEvent {
  provider: Extract<PaymentProvider, 'PAYSTACK' | 'FLUTTERWAVE'>;
  reference: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  amount: number;
  currency: string;
  authorizationCode?: string | null;
  eventId?: string;
  eventType?: string;
  providerTransactionId?: string | null;
  channel?: string | null;
  gatewayMessage?: string | null;
  paidAt?: string | null;
  raw: unknown;
}

export interface PaymentGateway {
  initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult>;
  verifyTransaction?(reference: string): Promise<ProviderEvent>;
  verifyWebhookSignature(rawBody: string | Buffer, headers: Record<string, string>): boolean;
  parseWebhookEvent(rawBody: string | Buffer, headers: Record<string, string>): ProviderEvent;
}
