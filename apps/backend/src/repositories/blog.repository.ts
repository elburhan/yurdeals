// ============================================
// Blog Repository
// ============================================

import { BlogPostStatus, Prisma } from '@prisma/client';
import {
  BlogCategorySummary,
  BlogPostDetail,
  BlogPostListItem,
} from '@yurdeals/shared';
import { prisma } from '../config';
import { BlogQueryInput } from '../schemas/blog.schema';
import { getPagination } from '../utils/pagination';

const PUBLIC_BLOG_WHERE = {
  status: BlogPostStatus.PUBLISHED,
  publishedAt: { not: null },
  OR: [{ categoryId: null }, { category: { isActive: true } }],
} satisfies Prisma.BlogPostWhereInput;

const BLOG_CATEGORY_SELECT = Prisma.validator<Prisma.BlogCategorySelect>()({
  id: true,
  name: true,
  slug: true,
  description: true,
  isActive: true,
});

const BLOG_POST_LIST_SELECT = Prisma.validator<Prisma.BlogPostSelect>()({
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  tags: true,
  status: true,
  views: true,
  featured: true,
  readingTimeMins: true,
  publishedAt: true,
  authorName: true,
  category: {
    select: BLOG_CATEGORY_SELECT,
  },
});

const BLOG_POST_DETAIL_SELECT = Prisma.validator<Prisma.BlogPostSelect>()({
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  content: true,
  tags: true,
  status: true,
  views: true,
  featured: true,
  readingTimeMins: true,
  publishedAt: true,
  authorName: true,
  seoTitle: true,
  seoDescription: true,
  category: {
    select: BLOG_CATEGORY_SELECT,
  },
});

const BLOG_ADMIN_SELECT = Prisma.validator<Prisma.BlogPostSelect>()({
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  status: true,
  featured: true,
  views: true,
  readingTimeMins: true,
  publishedAt: true,
  updatedAt: true,
  category: {
    select: BLOG_CATEGORY_SELECT,
  },
});

type BlogPostListRecord = Prisma.BlogPostGetPayload<{
  select: typeof BLOG_POST_LIST_SELECT;
}>;

type BlogPostDetailRecord = Prisma.BlogPostGetPayload<{
  select: typeof BLOG_POST_DETAIL_SELECT;
}>;

type BlogAdminRecord = Prisma.BlogPostGetPayload<{
  select: typeof BLOG_ADMIN_SELECT;
}>;

export interface BlogPageResult {
  posts: BlogPostListItem[];
  total: number;
}

export interface PublishedPostWithRelated {
  post: BlogPostDetail;
  relatedPosts: BlogPostListItem[];
}

export interface AdminBlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  featured: boolean;
  views: number;
  readingTimeMins: number | null;
  publishedAt: string | null;
  updatedAt: string;
  category: BlogCategorySummary | null;
}

export class BlogRepository {
  async findPublishedPosts(query: BlogQueryInput): Promise<BlogPageResult> {
    const where = buildPublishedPostWhere(query);
    const { skip, take } = getPagination(query);

    const [records, total] = await prisma.$transaction([
      prisma.blogPost.findMany({
        where,
        select: BLOG_POST_LIST_SELECT,
        orderBy: buildPublishedPostOrderBy(query.featured),
        skip,
        take,
      }),
      prisma.blogPost.count({ where }),
    ]);

    return {
      posts: records.map(mapBlogPostListItem),
      total,
    };
  }

  async findFeaturedPublishedPosts(limit: number): Promise<BlogPostListItem[]> {
    const records = await prisma.blogPost.findMany({
      where: {
        ...PUBLIC_BLOG_WHERE,
        featured: true,
      },
      select: BLOG_POST_LIST_SELECT,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return records.map(mapBlogPostListItem);
  }

  async findActiveCategories(): Promise<BlogCategorySummary[]> {
    const categories = await prisma.blogCategory.findMany({
      where: { isActive: true },
      select: BLOG_CATEGORY_SELECT,
      orderBy: [{ name: 'asc' }],
    });

    return categories.map(mapBlogCategorySummary);
  }

  async findPublishedPostBySlugWithIncrement(slug: string): Promise<PublishedPostWithRelated | null> {
    return prisma.$transaction(async (tx) => {
      const record = await tx.blogPost.findFirst({
        where: {
          ...PUBLIC_BLOG_WHERE,
          slug,
        },
        select: BLOG_POST_DETAIL_SELECT,
      });

      if (!record) {
        return null;
      }

      const calculatedReadingTime = getReadingTimeMinutes(record.content);

      await tx.blogPost.update({
        where: { id: record.id },
        data: {
          views: { increment: 1 },
          ...(record.readingTimeMins ? {} : { readingTimeMins: calculatedReadingTime }),
        },
      });

      const relatedFilters: Prisma.BlogPostWhereInput[] = [];

      if (record.category) {
        relatedFilters.push({ categoryId: record.category.id });
      }

      if (record.tags.length > 0) {
        relatedFilters.push({ tags: { hasSome: record.tags.slice(0, 3) } });
      }

      const relatedRecords = await tx.blogPost.findMany({
        where: {
          ...PUBLIC_BLOG_WHERE,
          id: { not: record.id },
          ...(relatedFilters.length > 0 ? { OR: relatedFilters } : {}),
        },
        select: BLOG_POST_LIST_SELECT,
        orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
        take: 3,
      });

      return {
        post: mapBlogPostDetail(record, calculatedReadingTime, 1),
        relatedPosts: relatedRecords.map(mapBlogPostListItem),
      };
    });
  }

  async findPublishedPostBySlug(slug: string): Promise<BlogPostDetail | null> {
    const record = await prisma.blogPost.findFirst({
      where: {
        ...PUBLIC_BLOG_WHERE,
        slug,
      },
      select: BLOG_POST_DETAIL_SELECT,
    });

    if (!record) {
      return null;
    }

    return mapBlogPostDetail(record);
  }

  async findPostsForAdmin(limit = 20): Promise<AdminBlogPostSummary[]> {
    const records = await prisma.blogPost.findMany({
      select: BLOG_ADMIN_SELECT,
      orderBy: [{ updatedAt: 'desc' }],
      take: limit,
    });

    return records.map(mapAdminBlogPostSummary);
  }

  async findPostByIdForAdmin(postId: string): Promise<AdminBlogPostSummary | null> {
    const record = await prisma.blogPost.findUnique({
      where: { id: postId },
      select: BLOG_ADMIN_SELECT,
    });

    return record ? mapAdminBlogPostSummary(record) : null;
  }
}

function buildPublishedPostWhere(query: BlogQueryInput): Prisma.BlogPostWhereInput {
  const and: Prisma.BlogPostWhereInput[] = [PUBLIC_BLOG_WHERE];

  if (query.category && query.category.toLowerCase() !== 'all') {
    and.push({
      category: {
        slug: query.category,
        isActive: true,
      },
    });
  }

  if (query.tag) {
    and.push({
      tags: {
        has: query.tag,
      },
    });
  }

  if (query.featured !== undefined) {
    and.push({ featured: query.featured });
  }

  return { AND: and };
}

function buildPublishedPostOrderBy(
  featured?: boolean,
): Prisma.BlogPostOrderByWithRelationInput[] {
  if (featured === true) {
    return [{ publishedAt: 'desc' }, { createdAt: 'desc' }];
  }

  return [{ featured: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }];
}

function mapBlogCategorySummary(
  category: Prisma.BlogCategoryGetPayload<{ select: typeof BLOG_CATEGORY_SELECT }>,
): BlogCategorySummary {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    isActive: category.isActive,
  };
}

function mapBlogPostListItem(record: BlogPostListRecord): BlogPostListItem {
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    excerpt: record.excerpt,
    coverImage: record.coverImage,
    tags: record.tags,
    status: record.status,
    views: record.views,
    featured: record.featured,
    readingTimeMins: record.readingTimeMins ?? getReadingTimeMinutes(record.excerpt),
    publishedAt: record.publishedAt?.toISOString() ?? null,
    authorName: record.authorName,
    category: record.category ? mapBlogCategorySummary(record.category) : null,
  };
}

function mapBlogPostDetail(
  record: BlogPostDetailRecord,
  calculatedReadingTime = getReadingTimeMinutes(record.content),
  viewIncrement = 0,
): BlogPostDetail {
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    excerpt: record.excerpt,
    coverImage: record.coverImage,
    tags: record.tags,
    status: record.status,
    views: record.views + viewIncrement,
    featured: record.featured,
    readingTimeMins: record.readingTimeMins ?? calculatedReadingTime,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    authorName: record.authorName,
    category: record.category ? mapBlogCategorySummary(record.category) : null,
    content: record.content,
    seoTitle: record.seoTitle,
    seoDescription: record.seoDescription,
  };
}

function mapAdminBlogPostSummary(record: BlogAdminRecord): AdminBlogPostSummary {
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    excerpt: record.excerpt,
    status: record.status,
    featured: record.featured,
    views: record.views,
    readingTimeMins: record.readingTimeMins,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
    category: record.category ? mapBlogCategorySummary(record.category) : null,
  };
}

function getReadingTimeMinutes(content: string): number {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

export const blogRepository = new BlogRepository();
