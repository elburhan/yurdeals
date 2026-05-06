// ============================================
// Payment API Service
// ============================================

import type { PaymentInitiationData, PaymentStatusData } from '@yurdeals/shared';
import { api, type ApiResponse } from './api';

export async function initiatePayment(
  orderId: string,
): Promise<ApiResponse<PaymentInitiationData>> {
  return api.post<PaymentInitiationData>(`/orders/${orderId}/payments`, { provider: 'PAYSTACK' });
}

export async function initiateGuestPayment(
  orderId: string,
  guestAccessToken: string,
): Promise<ApiResponse<PaymentInitiationData>> {
  return api.post<PaymentInitiationData>(`/orders/${orderId}/payments/guest`, {
    provider: 'PAYSTACK',
    guest_access_token: guestAccessToken,
  });
}

export async function getPaymentStatus(
  orderId: string,
  paymentId: string,
): Promise<ApiResponse<PaymentStatusData>> {
  return api.get<PaymentStatusData>(`/orders/${orderId}/payments/${paymentId}`);
}

export async function getGuestPaymentStatus(
  orderId: string,
  paymentId: string,
  guestAccessToken: string,
): Promise<ApiResponse<PaymentStatusData>> {
  return api.get<PaymentStatusData>(`/orders/${orderId}/payments/${paymentId}/guest`, {
    guest_access_token: guestAccessToken,
  });
}
