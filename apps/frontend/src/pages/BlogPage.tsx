import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BlogList } from '../components/BlogList';
import { CustomerNav } from '../components/CustomerNav';
import { blogPosts } from '../data/blogPosts';

export default function BlogPage(): JSX.Element {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    document.title = 'Guides & Insights | YurDeals';
    const timerId = window.setTimeout(() => setIsLoading(false), 250);

    return () => window.clearTimeout(timerId);
  }, []);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(blogPosts.map((post) => post.category)))],
    [],
  );

  const visiblePosts =
    selectedCategory === 'All'
      ? blogPosts
      : blogPosts.filter((post) => post.category === selectedCategory);

  return (
    <main className="min-h-screen bg-surface-50">
      <CustomerNav />

      <section className="border-b border-primary-100 bg-gradient-to-br from-primary-50 via-white to-surface-50">
        <div className="container-app py-8 sm:py-12">
          <Link
            to="/"
            className="inline-flex min-h-10 items-center text-sm font-bold text-primary-700 hover:text-primary-800"
          >
            &lt;- Back home
          </Link>
          <div className="mt-4 max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-wide text-primary-700">
              YurDeals learning center
            </p>
            <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight text-surface-950 sm:text-5xl">
              Guides & Insights
            </h1>
            <p className="mt-4 text-base leading-7 text-surface-600 sm:text-lg">
              Practical, trust-focused guides for Nigerians preordering products from China with
              clearer timelines, safer payments, and better quality checks.
            </p>
          </div>
        </div>
      </section>

      <section className="container-app py-8">
        <div className="mb-6 flex snap-x gap-2 overflow-x-auto pb-2" aria-label="Blog categories">
          {categories.map((category) => {
            const isActive = category === selectedCategory;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`min-h-11 shrink-0 snap-center rounded-full border px-4 text-sm font-bold transition ${
                  isActive
                    ? 'border-primary-500 bg-primary-500 text-white shadow-sm'
                    : 'border-surface-200 bg-white text-surface-700 hover:border-primary-200 hover:text-primary-700'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>

        <BlogList posts={visiblePosts} isLoading={isLoading} />

        {!isLoading && visiblePosts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-surface-300 bg-white p-6 text-center shadow-sm">
            <h2 className="font-display text-xl font-bold text-surface-950">No guides yet</h2>
            <p className="mt-2 text-sm leading-6 text-surface-500">
              Try another category or browse all YurDeals guides.
            </p>
            <button
              type="button"
              onClick={() => setSelectedCategory('All')}
              className="mt-4 min-h-12 rounded-full bg-primary-500 px-5 text-sm font-bold text-white hover:bg-primary-600"
            >
              Show all guides
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
