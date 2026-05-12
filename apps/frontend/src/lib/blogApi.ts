// ============================================
// Blog API Service
// ============================================

import type {
  BlogCategoryListData,
  BlogPostDetailData,
  BlogPostListData,
} from '@yurdeals/shared';
import { api, type ApiResponse } from './api';

export interface FetchBlogPostsParams {
  category?: string;
  tag?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
}

export async function fetchBlogPosts(
  params: FetchBlogPostsParams = {},
): Promise<ApiResponse<BlogPostListData>> {
  return api.get<BlogPostListData>('/blog', params);
}

export async function fetchBlogPostBySlug(
  slug: string,
): Promise<ApiResponse<BlogPostDetailData>> {
  return api.get<BlogPostDetailData>(`/blog/${slug}`);
}

export async function fetchFeaturedBlogPosts(
  limit = 3,
): Promise<ApiResponse<BlogPostListData>> {
  return api.get<BlogPostListData>('/blog/featured', { limit });
}

export async function fetchBlogCategories(): Promise<ApiResponse<BlogCategoryListData>> {
  return api.get<BlogCategoryListData>('/blog/categories');
}
