import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BlogCategorySummary, BlogPostListItem } from '@yurdeals/shared';
import { BlogList } from '../components/BlogList';
import { CustomerNav } from '../components/CustomerNav';
import { fetchBlogCategories, fetchBlogPosts } from '../lib/blogApi';

const ALL_CATEGORY = 'all';

export default function BlogPage(): JSX.Element {
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [categories, setCategories] = useState<BlogCategorySummary[]>([]);
  const [posts, setPosts] = useState<BlogPostListItem[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    document.title = 'Guides & Insights | YurDeals';
  }, []);

  useEffect(() => {
    let isMounted = true;

    setIsLoadingCategories(true);
    fetchBlogCategories()
      .then((response) => {
        if (!isMounted) {
          return;
        }

        setCategories(response.data.categories);
      })
      .catch((requestError: Error) => {
        if (!isMounted) {
          return;
        }

        console.warn('Unable to load blog categories', requestError.message);
        setCategories([]);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingCategories(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [retryKey]);

  useEffect(() => {
    let isMounted = true;

    setIsLoadingPosts(true);
    setError('');

    fetchBlogPosts({
      category: selectedCategory === ALL_CATEGORY ? undefined : selectedCategory,
      limit: 24,
      page: 1,
    })
      .then((response) => {
        if (!isMounted) {
          return;
        }

        setPosts(response.data.posts);
      })
      .catch((requestError: Error) => {
        if (!isMounted) {
          return;
        }

        setError(requestError.message);
        setPosts([]);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingPosts(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCategory, retryKey]);

  const categoryOptions = useMemo(
    () => [
      { id: ALL_CATEGORY, label: 'All' },
      ...categories.map((category) => ({ id: category.slug, label: category.name })),
    ],
    [categories],
  );

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
          {(isLoadingCategories ? getCategorySkeletons() : categoryOptions).map((category) => {
            if (typeof category === 'string') {
              return <CategorySkeleton key={category} />;
            }

            const isActive = category.id === selectedCategory;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                className={`min-h-11 shrink-0 snap-center rounded-full border px-4 text-sm font-bold transition ${
                  isActive
                    ? 'border-primary-500 bg-primary-500 text-white shadow-sm'
                    : 'border-surface-200 bg-white text-surface-700 hover:border-primary-200 hover:text-primary-700'
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        {error && !isLoadingPosts ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
            <h2 className="font-display text-xl font-bold text-surface-950">
              We couldn&apos;t load the guides right now
            </h2>
            <p className="mt-2 text-sm leading-6 text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => setRetryKey((value) => value + 1)}
              className="mt-4 min-h-12 rounded-full bg-primary-500 px-5 text-sm font-bold text-white hover:bg-primary-600"
            >
              Try again
            </button>
          </div>
        ) : (
          <BlogList posts={posts} isLoading={isLoadingPosts} />
        )}

        {!isLoadingPosts && !error && posts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-surface-300 bg-white p-6 text-center shadow-sm">
            <h2 className="font-display text-xl font-bold text-surface-950">No guides yet</h2>
            <p className="mt-2 text-sm leading-6 text-surface-500">
              Try another category or browse all YurDeals guides.
            </p>
            <button
              type="button"
              onClick={() => setSelectedCategory(ALL_CATEGORY)}
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

function getCategorySkeletons(): string[] {
  return ['one', 'two', 'three', 'four'];
}

function CategorySkeleton(): JSX.Element {
  return <div className="h-11 w-28 shrink-0 rounded-full bg-surface-200" aria-hidden="true" />;
}
