// ============================================
// Blog Service
// ============================================

import {
  BlogCategorySummary,
  BlogPostDetail,
  BlogPostListItem,
  BlogPostListData,
} from '@yurdeals/shared';
import { AppError } from '../middleware/errorHandler';
import { blogRepository } from '../repositories/blog.repository';
import { BlogQueryInput, FeaturedBlogQueryInput } from '../schemas/blog.schema';
import { getPaginationMeta } from '../utils/pagination';

interface BlogCategoryListResponse {
  categories: BlogCategorySummary[];
}

interface BlogPostDetailResponse {
  post: BlogPostDetail;
  relatedPosts: BlogPostListItem[];
}

export async function listPublishedBlogPosts(query: BlogQueryInput): Promise<{
  data: BlogPostListData;
  meta: ReturnType<typeof getPaginationMeta>;
}> {
  const result = await blogRepository.findPublishedPosts(query);

  return {
    data: { posts: result.posts },
    meta: getPaginationMeta(query, result.total),
  };
}

export async function getFeaturedBlogPosts(
  query: FeaturedBlogQueryInput,
): Promise<BlogPostListData> {
  const posts = await blogRepository.findFeaturedPublishedPosts(query.limit);
  return { posts };
}

export async function getBlogCategories(): Promise<BlogCategoryListResponse> {
  const categories = await blogRepository.findActiveCategories();
  return { categories };
}

export async function getPublishedBlogPost(slug: string): Promise<BlogPostDetailResponse> {
  const result = await blogRepository.findPublishedPostBySlugWithIncrement(slug);

  if (!result) {
    throw new AppError('Blog post not found', 404, 'BLOG_POST_NOT_FOUND');
  }

  return {
    post: result.post,
    relatedPosts: result.relatedPosts,
  };
}

export async function getPublishedBlogPostPreview(slug: string): Promise<BlogPostDetailResponse> {
  const post = await blogRepository.findPublishedPostBySlug(slug);

  if (!post) {
    throw new AppError('Blog post not found', 404, 'BLOG_POST_NOT_FOUND');
  }

  return {
    post,
    relatedPosts: [],
  };
}
