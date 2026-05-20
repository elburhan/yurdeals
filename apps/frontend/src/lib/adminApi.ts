// ============================================
// Admin API Service
// ============================================

import type {
  AdminOrderDetailData,
  AdminOrderListData,
  AdminBlogPostDetailData,
  AdminBlogPostListData,
  AdminBlogPostDetail,
  AdminOverviewData,
  AdminProductListData,
  AdminProductSummary,
  AdminShipmentListData,
} from '@yurdeals/shared';
import { api, type ApiResponse } from './api';

export async function getAdminOverview(): Promise<ApiResponse<AdminOverviewData>> {
  return api.get<AdminOverviewData>('/admin/overview');
}

export interface AdminBlogPostInput {
  title: string;
  slug?: string;
  excerpt: string;
  content: string;
  category_name?: string;
  tags?: string[];
  featured?: boolean;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  cover_image?: string;
  seo_title?: string;
  seo_description?: string;
}

export async function getAdminBlogPosts(
  status = 'all',
): Promise<ApiResponse<AdminBlogPostListData>> {
  return api.get<AdminBlogPostListData>('/admin/blog-posts', { status, limit: 100 });
}

export async function getAdminBlogPost(
  postId: string,
): Promise<ApiResponse<AdminBlogPostDetailData>> {
  return api.get<AdminBlogPostDetailData>(`/admin/blog-posts/${postId}`);
}

export async function createAdminBlogPost(
  input: AdminBlogPostInput,
): Promise<ApiResponse<{ post: AdminBlogPostDetail }>> {
  return api.post<{ post: AdminBlogPostDetail }>('/admin/blog-posts', input);
}

export async function updateAdminBlogPost(
  postId: string,
  input: Partial<AdminBlogPostInput>,
): Promise<ApiResponse<{ post: AdminBlogPostDetail }>> {
  return api.put<{ post: AdminBlogPostDetail }>(`/admin/blog-posts/${postId}`, input);
}

export async function archiveAdminBlogPost(
  postId: string,
): Promise<ApiResponse<{ post: AdminBlogPostDetail }>> {
  return api.delete<{ post: AdminBlogPostDetail }>(`/admin/blog-posts/${postId}`);
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
  stock_type: 'IN_STOCK' | 'PREORDER';
  inventory_quantity?: number;
  preorder_slots_total?: number;
  preorder_slots_remaining?: number;
  preorder_starts_at?: string;
  preorder_ends_at?: string;
  estimated_arrival_at?: string;
  sku?: string;
  weight?: number;
  is_featured?: boolean;
  is_published?: boolean;
  is_sold_out?: boolean;
  marketing_badge?: 'SELLING_FAST' | 'TRENDING' | null;
  approval_status?: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  image_url?: string;
  images?: string[];
  variants?: Array<{
    id?: string;
    name: string;
    price: number;
    stock: number;
    sku?: string;
  }>;
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

export async function uploadAdminArticleCoverImage(
  image: File,
): Promise<ApiResponse<{ url: string; publicId: string }>> {
  return uploadAdminProductImage(image);
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
    stock_type: 'IN_STOCK' | 'PREORDER';
    inventory_quantity: number;
    preorder_slots_total: number;
    preorder_slots_remaining: number;
    preorder_starts_at: string;
    preorder_ends_at: string;
    estimated_arrival_at: string;
    sku: string;
    weight: number;
    is_featured: boolean;
    is_published: boolean;
    is_sold_out: boolean;
    marketing_badge: 'SELLING_FAST' | 'TRENDING' | null;
    approval_status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
    is_active: boolean;
    image_url: string;
    images: string[];
    variants: Array<{
      id?: string;
      name: string;
      price: number;
      stock: number;
      sku?: string;
    }>;
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

export async function updateAdminOrderRiskReview(
  orderId: string,
  input: {
    hold_for_manual_review?: boolean;
    fraud_notes?: string;
    risk_level_override?: 'LOW' | 'MEDIUM' | 'HIGH';
  },
): Promise<ApiResponse<AdminOrderDetailData>> {
  return api.post<AdminOrderDetailData>(`/admin/orders/${orderId}/risk-review`, input);
}

export async function getAdminShipments(): Promise<ApiResponse<AdminShipmentListData>> {
  return api.get<AdminShipmentListData>('/admin/shipments');
}
