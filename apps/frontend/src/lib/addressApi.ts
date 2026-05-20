// ============================================
// Address API Service
// ============================================

import type { AddressListData, AddressSummary } from '@yurdeals/shared';
import { api, type ApiResponse } from './api';

export interface AddressPayload {
  label?: string;
  first_name: string;
  last_name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  lga: string;
  area: string;
  landmark: string;
  country?: string;
  postal_code?: string;
  delivery_notes?: string;
  is_default?: boolean;
}

export async function getAddresses(): Promise<ApiResponse<AddressListData>> {
  return api.get<AddressListData>('/addresses');
}

export async function createAddress(
  payload: AddressPayload,
): Promise<ApiResponse<{ address: AddressSummary }>> {
  return api.post<{ address: AddressSummary }>('/addresses', payload);
}

export async function updateAddress(
  addressId: string,
  payload: Partial<AddressPayload>,
): Promise<ApiResponse<{ address: AddressSummary }>> {
  return api.put<{ address: AddressSummary }>(`/addresses/${addressId}`, payload);
}

export async function deleteAddress(addressId: string): Promise<ApiResponse<null>> {
  return api.delete<null>(`/addresses/${addressId}`);
}

export async function setDefaultAddress(
  addressId: string,
): Promise<ApiResponse<{ address: AddressSummary }>> {
  return api.post<{ address: AddressSummary }>(`/addresses/${addressId}/default`);
}
