import { Link } from 'react-router-dom';
import type { BlogPost } from '../data/blogPosts';
import { SkeletonBlock } from './Skeleton';

interface BlogCardProps {
  post: BlogPost;
}

export function BlogCard({ post }: BlogCardProps): JSX.Element {
  return (
    <article className="group overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md">
      <Link to={`/blog/${post.slug}`} className="block" aria-label={`Read ${post.title}`}>
        <div className="relative aspect-[4/3] overflow-hidden bg-surface-100">
          <img
            src={post.coverImage}
            alt={post.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />
          <span className="absolute left-3 top-3 rounded-full bg-primary-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
            {post.category}
          </span>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-surface-500">
            <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
            <span aria-hidden="true">-</span>
            <span>{post.readTime}</span>
          </div>
          <h3 className="font-display text-lg font-bold leading-snug text-surface-950">
            {post.title}
          </h3>
          <p className="text-sm leading-6 text-surface-600">{post.excerpt}</p>
          <span className="inline-flex min-h-10 items-center rounded-full text-sm font-bold text-primary-700 group-hover:text-primary-800">
            Read guide
            <span className="ml-1" aria-hidden="true">
              -&gt;
            </span>
          </span>
        </div>
      </Link>
    </article>
  );
}

export function BlogCardSkeleton(): JSX.Element {
  return (
    <article className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm">
      <SkeletonBlock className="aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-4">
        <SkeletonBlock className="h-3 w-32" />
        <SkeletonBlock className="h-5 w-full" />
        <SkeletonBlock className="h-5 w-4/5" />
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-2/3" />
      </div>
    </article>
  );
}

function formatBlogDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(value),
  );
}
