// ============================================
// Catalog API Service
// ============================================

import {
  CategoryListData,
  HomeCatalogData,
  ProductCatalogFilters,
  ProductDetail,
  ProductListData,
} from '@yurdeals/shared';
import { api, ApiResponse } from './api';

export async function getHomeCatalog(): Promise<ApiResponse<HomeCatalogData>> {
  return api.get<HomeCatalogData>('/home');
}

export async function getCategories(parentId?: string): Promise<ApiResponse<CategoryListData>> {
  return api.get<CategoryListData>('/categories', parentId ? { parent_id: parentId } : undefined);
}

export async function getProducts(
  filters: ProductCatalogFilters = {},
): Promise<ApiResponse<ProductListData>> {
  return api.get<ProductListData>('/products', filters);
}

export async function getProduct(
  productId: string,
): Promise<ApiResponse<{ product: ProductDetail }>> {
  return api.get<{ product: ProductDetail }>(`/products/${productId}`);
}
