// ============================================
// Notification API Service
// ============================================

import type { NotificationListData } from '@yurdeals/shared';
import { api, type ApiResponse } from './api';

export async function getNotifications(): Promise<ApiResponse<NotificationListData>> {
  return api.get<NotificationListData>('/notifications');
}

export async function markAllNotificationsRead(): Promise<ApiResponse<{ updatedCount: number }>> {
  return api.patch<{ updatedCount: number }>('/notifications/read-all');
}
