// ============================================
// Blog Service
// ============================================

import {
  AdminBlogPostDetail,
  AdminBlogPostListData,
  BlogCategorySummary,
  BlogPostDetail,
  BlogPostListItem,
  BlogPostListData,
} from '@yurdeals/shared';
import { AppError } from '../middleware/errorHandler';
import { blogRepository } from '../repositories/blog.repository';
import {
  AdminBlogPostQueryInput,
  AdminCreateBlogPostInput,
  AdminUpdateBlogPostInput,
  BlogQueryInput,
  FeaturedBlogQueryInput,
} from '../schemas/blog.schema';
import { getPaginationMeta } from '../utils/pagination';
import { AuditContext, writeAuditLog } from './audit.service';

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

export async function listAdminBlogPosts(
  query: AdminBlogPostQueryInput,
): Promise<AdminBlogPostListData> {
  const posts = await blogRepository.findPostsForAdmin(query);
  return { posts };
}

export async function getAdminBlogPost(postId: string): Promise<{ post: AdminBlogPostDetail }> {
  const post = await blogRepository.findPostByIdForAdmin(postId);

  if (!post) {
    throw new AppError('Blog post not found', 404, 'BLOG_POST_NOT_FOUND');
  }

  return { post };
}

export async function createAdminBlogPost(
  input: AdminCreateBlogPostInput,
  auditContext?: AuditContext,
): Promise<{ post: AdminBlogPostDetail }> {
  const post = await blogRepository.createPostForAdmin(input, auditContext?.userId ?? undefined);
  await writeAuditLog({
    ...auditContext,
    action: 'ADMIN_BLOG_POST_CREATED',
    entity: 'BlogPost',
    entityId: post.id,
    newData: { title: post.title, slug: post.slug, status: post.status },
  });

  return { post };
}

export async function updateAdminBlogPost(
  postId: string,
  input: AdminUpdateBlogPostInput,
  auditContext?: AuditContext,
): Promise<{ post: AdminBlogPostDetail }> {
  const post = await blogRepository.updatePostForAdmin(postId, input);

  if (!post) {
    throw new AppError('Blog post not found', 404, 'BLOG_POST_NOT_FOUND');
  }

  await writeAuditLog({
    ...auditContext,
    action: 'ADMIN_BLOG_POST_UPDATED',
    entity: 'BlogPost',
    entityId: post.id,
    newData: { title: post.title, slug: post.slug, status: post.status, fields: Object.keys(input) },
  });

  return { post };
}

export async function archiveAdminBlogPost(
  postId: string,
  auditContext?: AuditContext,
): Promise<{ post: AdminBlogPostDetail }> {
  const post = await blogRepository.archivePostForAdmin(postId);

  if (!post) {
    throw new AppError('Blog post not found', 404, 'BLOG_POST_NOT_FOUND');
  }

  await writeAuditLog({
    ...auditContext,
    action: 'ADMIN_BLOG_POST_ARCHIVED',
    entity: 'BlogPost',
    entityId: post.id,
    newData: { title: post.title, slug: post.slug, status: post.status },
  });

  return { post };
}
