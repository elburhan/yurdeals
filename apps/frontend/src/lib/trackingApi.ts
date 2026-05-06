// ============================================
// Tracking API Service
// ============================================

import type { OrderTrackingData } from '@yurdeals/shared';
import { api, type ApiResponse } from './api';

export async function getOrderTracking(
  orderId: string,
): Promise<ApiResponse<OrderTrackingData>> {
  return api.get<OrderTrackingData>(`/orders/${orderId}/tracking`);
}
