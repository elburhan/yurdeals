// ============================================
// Staff API Service
// ============================================

import type { ShipmentSummary, StaffLastMileData } from '@yurdeals/shared';
import { api, type ApiResponse } from './api';

export type StaffShipmentAction = 'LOCAL_DELIVERY' | 'DELIVERED' | 'DELIVERY_FAILED';

export async function getStaffLastMileShipments(): Promise<ApiResponse<StaffLastMileData>> {
  return api.get<StaffLastMileData>('/staff/shipments/last-mile');
}

export async function updateStaffShipmentStatus(
  shipmentId: string,
  status: StaffShipmentAction,
): Promise<ApiResponse<{ shipment: ShipmentSummary }>> {
  return api.post<{ shipment: ShipmentSummary }>(`/staff/shipments/last-mile/${shipmentId}/status`, {
    status,
  });
}
