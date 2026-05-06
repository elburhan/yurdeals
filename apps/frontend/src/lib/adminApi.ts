// ============================================
// Admin API Service
// ============================================

import type {
  AdminOrderDetailData,
  AdminOrderListData,
  AdminOverviewData,
  AdminProductListData,
  AdminProductSummary,
  AdminShipmentListData,
} from '@yurdeals/shared';
import { api, type ApiResponse } from './api';

export async function getAdminOverview(): Promise<ApiResponse<AdminOverviewData>> {
  return api.get<AdminOverviewData>('/admin/overview');
}

export async function getAdminProducts(status = 'all'): Promise<ApiResponse<AdminProductListData>> {
  return api.get<AdminProductListData>('/admin/products', { status });
}

export async function createAdminProduct(input: {
  name: string;
  slug?: string;
  description: string;
  short_desc?: string;
  category_id: string;
  base_price: number;
  currency?: string;
  stock_type: 'LOCAL' | 'PREORDER';
  sku?: string;
  weight?: number;
  is_featured?: boolean;
  image_url?: string;
}): Promise<ApiResponse<{ product: AdminProductSummary }>> {
  return api.post<{ product: AdminProductSummary }>('/admin/products', input);
}

export async function uploadAdminProductImage(
  image: File,
): Promise<ApiResponse<{ url: string; publicId: string }>> {
  const formData = new FormData();
  formData.append('image', image);
  return api.postForm<{ url: string; publicId: string }>('/admin/uploads/product-image', formData);
}

export async function updateAdminProduct(
  productId: string,
  input: Partial<{
    name: string;
    slug: string;
    description: string;
    short_desc: string;
    category_id: string;
    base_price: number;
    currency: string;
    stock_type: 'LOCAL' | 'PREORDER';
    sku: string;
    weight: number;
    is_featured: boolean;
    is_active: boolean;
    image_url: string;
  }>,
): Promise<ApiResponse<{ product: AdminProductSummary }>> {
  return api.put<{ product: AdminProductSummary }>(`/admin/products/${productId}`, input);
}

export async function disableAdminProduct(
  productId: string,
): Promise<ApiResponse<{ product: AdminProductSummary }>> {
  return updateAdminProduct(productId, { is_active: false });
}

export async function deleteAdminProduct(
  productId: string,
): Promise<ApiResponse<{ product: AdminProductSummary }>> {
  return api.delete<{ product: AdminProductSummary }>(`/admin/products/${productId}`);
}

export async function getAdminOrders(status?: string): Promise<ApiResponse<AdminOrderListData>> {
  return api.get<AdminOrderListData>('/admin/orders', status ? { status } : undefined);
}

export async function getAdminOrder(
  orderId: string,
): Promise<ApiResponse<AdminOrderDetailData>> {
  return api.get<AdminOrderDetailData>(`/admin/orders/${orderId}`);
}

export async function updateAdminOrderStatus(
  orderId: string,
  status: string,
): Promise<ApiResponse<AdminOrderDetailData>> {
  return api.post<AdminOrderDetailData>(`/admin/orders/${orderId}/status`, { status });
}

export async function getAdminShipments(): Promise<ApiResponse<AdminShipmentListData>> {
  return api.get<AdminShipmentListData>('/admin/shipments');
}
