// ============================================
// Order API Service
// ============================================

import type { OrderCreationData, OrderDetailData, OrderListData } from '@yurdeals/shared';
import { api, type ApiResponse } from './api';

export interface CreateOrderPayload {
  address_id: string;
  notes?: string;
}

export interface CreateGuestOrderPayload {
  guest: {
    full_name: string;
    phone: string;
    email: string;
    state: string;
    lga: string;
    city: string;
    area: string;
    street: string;
    landmark: string;
    address_line?: string;
    delivery_notes?: string;
    preferred_contact_method: 'WHATSAPP' | 'SMS' | 'CALL';
  };
  items: Array<{
    product_id: string;
    variant_id?: string;
    quantity: number;
  }>;
  notes?: string;
}

export async function createOrder(
  payload: CreateOrderPayload,
): Promise<ApiResponse<OrderCreationData>> {
  return api.post<OrderCreationData>('/orders', payload);
}

export async function createGuestOrder(
  payload: CreateGuestOrderPayload,
): Promise<ApiResponse<OrderCreationData>> {
  return api.post<OrderCreationData>('/orders/guest', payload);
}

export async function getOrders(page = 1): Promise<ApiResponse<OrderListData>> {
  return api.get<OrderListData>('/orders', { page, limit: 12 });
}

export async function getOrder(orderId: string): Promise<ApiResponse<OrderDetailData>> {
  return api.get<OrderDetailData>(`/orders/${orderId}`);
}

export async function cancelOrder(orderId: string): Promise<ApiResponse<OrderDetailData>> {
  return api.post<OrderDetailData>(`/orders/${orderId}/cancel`);
}

export async function markWhatsappCheckout(
  orderId: string,
): Promise<ApiResponse<OrderDetailData>> {
  return api.post<OrderDetailData>(`/orders/${orderId}/whatsapp`);
}

export async function markGuestWhatsappCheckout(
  orderId: string,
  guestAccessToken: string,
): Promise<ApiResponse<OrderDetailData>> {
  return api.post<OrderDetailData>(`/orders/${orderId}/whatsapp/guest`, {
    guest_access_token: guestAccessToken,
  });
}
