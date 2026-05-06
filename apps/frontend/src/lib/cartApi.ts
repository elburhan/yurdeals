// ============================================
// Cart API Service
// ============================================

import type { CartData } from '@yurdeals/shared';
import { api, type ApiResponse } from './api';

export interface AddCartItemPayload {
  product_id: string;
  variant_id?: string;
  quantity: number;
}

export interface UpdateCartItemPayload {
  quantity: number;
}

export async function getCart(): Promise<ApiResponse<CartData>> {
  return api.get<CartData>('/cart');
}

export async function addCartItem(payload: AddCartItemPayload): Promise<ApiResponse<CartData>> {
  return api.post<CartData>('/cart/items', payload);
}

export async function updateCartItem(
  cartItemId: string,
  payload: UpdateCartItemPayload,
): Promise<ApiResponse<CartData>> {
  return api.put<CartData>(`/cart/items/${cartItemId}`, payload);
}

export async function removeCartItem(cartItemId: string): Promise<ApiResponse<CartData>> {
  return api.delete<CartData>(`/cart/items/${cartItemId}`);
}
