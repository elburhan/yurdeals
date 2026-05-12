import type { BlogPostListItem } from '@yurdeals/shared';
import { BlogCard, BlogCardSkeleton } from './BlogCard';

interface BlogListProps {
  posts: BlogPostListItem[];
  isLoading?: boolean;
  limit?: number;
  className?: string;
}

export function BlogList({
  posts,
  isLoading = false,
  limit,
  className = '',
}: BlogListProps): JSX.Element {
  const visiblePosts = limit ? posts.slice(0, limit) : posts;

  return (
    <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {isLoading
        ? Array.from({ length: limit ?? 3 }).map((_, index) => <BlogCardSkeleton key={index} />)
        : visiblePosts.map((post) => <BlogCard key={post.id} post={post} />)}
    </div>
  );
}
