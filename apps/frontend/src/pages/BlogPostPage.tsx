import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BlogList } from '../components/BlogList';
import { CustomerNav } from '../components/CustomerNav';
import { blogPosts, getBlogPostBySlug } from '../data/blogPosts';

export default function BlogPostPage(): JSX.Element {
  const { slug } = useParams();
  const post = getBlogPostBySlug(slug);

  useEffect(() => {
    document.title = post ? `${post.title} | YurDeals Guides` : 'Guide not found | YurDeals';
  }, [post]);

  if (!post) {
    return (
      <main className="min-h-screen bg-surface-50">
        <CustomerNav />
        <section className="container-app py-12">
          <div className="rounded-2xl border border-surface-200 bg-white p-6 text-center shadow-sm">
            <h1 className="font-display text-2xl font-bold text-surface-950">Guide not found</h1>
            <p className="mt-2 text-sm leading-6 text-surface-500">
              This guide may have moved. Browse all YurDeals guides instead.
            </p>
            <Link
              to="/blog"
              className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-primary-500 px-5 text-sm font-bold text-white hover:bg-primary-600"
            >
              View guides
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const relatedPosts = blogPosts.filter((item) => item.id !== post.id).slice(0, 3);
  const shareText = `Read this YurDeals guide: ${post.title} ${window.location.href}`;

  return (
    <main className="min-h-screen bg-surface-50">
      <CustomerNav />

      <article className="container-app py-6 sm:py-8">
        <Link
          to="/blog"
          className="sticky top-28 z-10 inline-flex min-h-10 items-center rounded-full border border-surface-200 bg-white/95 px-4 text-sm font-bold text-surface-700 shadow-sm backdrop-blur hover:text-primary-700"
        >
          &lt;- Back to guides
        </Link>

        <header className="mt-6 overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm">
          <div className="aspect-[16/10] overflow-hidden bg-surface-100 sm:aspect-[16/7]">
            <img
              src={post.coverImage}
              alt={post.title}
              className="h-full w-full object-cover"
              loading="eager"
            />
          </div>
          <div className="space-y-4 p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-surface-500">
              <span className="rounded-full bg-primary-50 px-3 py-1 text-primary-700 ring-1 ring-primary-100">
                {post.category}
              </span>
              <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
              <span aria-hidden="true">-</span>
              <span>{post.readTime}</span>
            </div>
            <h1 className="font-display text-3xl font-extrabold leading-tight text-surface-950 sm:text-5xl">
              {post.title}
            </h1>
            <p className="max-w-3xl text-base leading-7 text-surface-600 sm:text-lg">
              {post.excerpt}
            </p>
            <div className="grid gap-3 sm:flex sm:flex-wrap">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#25D366] px-5 text-sm font-bold text-white shadow-sm"
              >
                Share on WhatsApp
              </a>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(window.location.href)}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-surface-300 bg-white px-5 text-sm font-bold text-surface-700 hover:border-primary-200 hover:text-primary-700"
              >
                Copy link
              </button>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr] lg:items-start">
          <aside className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm lg:sticky lg:top-32">
            <h2 className="text-sm font-bold uppercase tracking-wide text-surface-500">
              In this guide
            </h2>
            <nav className="mt-3 space-y-2" aria-label="Table of contents">
              {post.content.map((section) => (
                <a
                  key={section.heading}
                  href={`#${toHeadingId(section.heading)}`}
                  className="block rounded-lg px-3 py-2 text-sm font-semibold text-surface-700 hover:bg-primary-50 hover:text-primary-700"
                >
                  {section.heading}
                </a>
              ))}
            </nav>
          </aside>

          <div className="space-y-5">
            {post.content.map((section) => (
              <section
                key={section.heading}
                id={toHeadingId(section.heading)}
                className="scroll-mt-32 rounded-2xl border border-surface-200 bg-white p-5 shadow-sm sm:p-7"
              >
                <h2 className="font-display text-2xl font-bold text-surface-950">
                  {section.heading}
                </h2>
                <div className="mt-4 space-y-4">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="text-base leading-8 text-surface-600">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </article>

      <section className="container-app pb-12">
        <div className="mb-4">
          <p className="text-sm font-bold uppercase tracking-wide text-primary-700">
            Keep learning
          </p>
          <h2 className="font-display text-2xl font-bold text-surface-950">Related articles</h2>
        </div>
        <BlogList posts={relatedPosts} />
      </section>
    </main>
  );
}

function toHeadingId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatBlogDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(
    new Date(value),
  );
}
