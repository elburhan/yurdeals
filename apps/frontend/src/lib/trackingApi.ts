// ============================================
// Tracking API Service
// ============================================

import type { OrderTrackingData, PublicOrderTrackingData } from '@yurdeals/shared';
import { api, type ApiResponse } from './api';

export async function getOrderTracking(
  orderId: string,
): Promise<ApiResponse<OrderTrackingData>> {
  return api.get<OrderTrackingData>(`/orders/${orderId}/tracking`);
}

export async function lookupPublicOrderTracking(
  phone: string,
  orderNumber: string,
): Promise<ApiResponse<PublicOrderTrackingData>> {
  return api.get<PublicOrderTrackingData>('/orders/track', {
    phone,
    orderNumber,
  });
}
