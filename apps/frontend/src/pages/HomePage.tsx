import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BlogPostListItem, HomeCatalogData } from '@yurdeals/shared';
import { fetchFeaturedBlogPosts } from '../lib/blogApi';
import { getHomeCatalog } from '../lib/catalogApi';
import { BlogList } from '../components/BlogList';
import { CategoryChip } from '../components/CategoryChip';
import { CustomerNav } from '../components/CustomerNav';
import { ProductCard } from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/Skeleton';
import { SocialProof } from '../components/SocialProof';
import { TrustBanner } from '../components/TrustBanner';
import { HERO_BACKGROUND_IMAGES } from '../config/heroBackgrounds';
import { businessIdeas, type BusinessIdea } from '../data/businessIdeas';

const SHOW_BLOG = false;

const whyChooseItems = [
  {
    icon: 'check',
    title: 'Factory-Direct Prices',
    description: 'Cut out every middleman. Pay what Chinese factories actually charge.',
  },
  {
    icon: 'shield',
    title: 'We Inspect, You Relax',
    description: 'Professional quality check in China before we ship.',
  },
  {
    icon: 'truck',
    title: 'Live Tracking',
    description: 'Know exactly where your order is from China to your door in Nigeria.',
  },
  {
    icon: 'clock',
    title: 'Preorder Early = Save Big',
    description: 'Lowest prices before products hit the Nigerian market.',
  },
  {
    icon: 'support',
    title: 'Built for Nigerians',
    description: 'Local payments, reliable shipping, and real support that understands our market.',
  },
] as const;

const heroValueBadges = [
  { icon: 'factory', label: 'Direct from China' },
  { icon: 'shield', label: 'Inspected before shipping' },
  { icon: 'truck', label: 'Fast delivery to Nigeria' },
] as const;

export default function HomePage() {
  const [catalog, setCatalog] = useState<HomeCatalogData | null>(null);
  const [featuredBlogPosts, setFeaturedBlogPosts] = useState<BlogPostListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlogLoading, setIsBlogLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);

  useEffect(() => {
    document.title = 'Yurdeals - Preorder Premium Products from China to Nigeria';
  }, []);

  useEffect(() => {
    let isMounted = true;

    getHomeCatalog()
      .then((response) => {
        if (isMounted) {
          setCatalog(response.data);
          setError('');
        }
      })
      .catch((requestError: Error) => {
        if (isMounted) {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetchFeaturedBlogPosts(3)
      .then((response) => {
        if (!isMounted) {
          return;
        }

        setFeaturedBlogPosts(response.data.posts);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setFeaturedBlogPosts([]);
      })
      .finally(() => {
        if (isMounted) {
          setIsBlogLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (HERO_BACKGROUND_IMAGES.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setCurrentHeroIndex((currentIndex) => (currentIndex + 1) % HERO_BACKGROUND_IMAGES.length);
    }, 7000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <main className="min-h-screen bg-surface-50">
      <CustomerNav />

      <section className="relative overflow-hidden bg-surface-950 text-white">
        {HERO_BACKGROUND_IMAGES.map((image, index) => (
          <div
            key={image}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
              index === currentHeroIndex ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ backgroundImage: `url(${image})` }}
            aria-hidden="true"
          />
        ))}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(34,197,94,0.38),transparent_32%),radial-gradient(circle_at_18%_82%,rgba(251,191,36,0.18),transparent_30%),linear-gradient(135deg,rgba(2,6,23,0.86),rgba(5,46,22,0.78))]" aria-hidden="true" />
        <div
          className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/10 to-transparent opacity-60"
          aria-hidden="true"
        />
        <div className="container-app relative z-10 py-3 sm:py-5 md:py-8">
          <div className="max-w-3xl space-y-2 sm:space-y-3.5">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-300">
              China to Nigeria marketplace
            </p>
            <h1 className="max-w-2xl font-display text-[1.9rem] font-bold leading-[1.08] sm:text-5xl">
              Get Premium Products from China at Factory Prices - Delivered to Nigeria
            </h1>
            <p className="max-w-xl text-sm leading-5.5 text-surface-200 sm:text-lg sm:leading-7">
              Preorder smart. Save up to 40%. We inspect every order in China.
            </p>
            <div className="hidden flex-wrap gap-2 sm:flex">
              {heroValueBadges.map((badge) => (
                <span
                  key={badge.label}
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-primary-50 backdrop-blur"
                >
                  <HeroBadgeIcon name={badge.icon} />
                  {badge.label}
                </span>
              ))}
            </div>
            <p className="inline-flex max-w-[23rem] rounded-full border border-primary-300/40 bg-primary-500/15 px-3 py-1 text-[11px] font-bold leading-4.5 text-primary-100 sm:max-w-none sm:px-4 sm:py-2 sm:text-sm sm:leading-6">
              Limited preorder slots at factory prices - prices may rise after arrival in Nigeria.
            </p>
            <div className="grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
              <Link
                to="/categories/all"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-950/20 transition hover:-translate-y-0.5 hover:bg-primary-400 active:translate-y-0 sm:min-h-[52px] sm:w-auto sm:text-base"
              >
                Browse All Products
              </Link>
              <a
                href="#how-preordering-works"
                className="inline-flex min-h-10 w-full items-center justify-center rounded-full border border-white/40 bg-white/10 px-5 py-2 text-sm font-semibold text-white hover:bg-white/20 sm:min-h-[52px] sm:w-auto sm:px-6 sm:py-3 sm:text-base"
              >
                How Preordering Works
              </a>
            </div>
            <div className="hidden flex-wrap items-center gap-2 text-sm text-surface-200 sm:flex">
              <span className="rounded-full bg-white px-3 py-1 font-bold text-primary-700">
                Secure payment
              </span>
              <span>Secure online payment. Over 100 happy customers.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container-app pb-8 pt-1.5 sm:pt-3">
        <div className="mb-3">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-surface-950">Categories</h2>
              <p className="text-sm text-surface-500">Start with a focused department.</p>
            </div>
          </div>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
            {isLoading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-11 w-28 shrink-0 animate-shimmer rounded-full bg-gradient-to-r from-surface-100 via-surface-200 to-surface-100 bg-[length:200%_100%]"
                  />
                ))
              : catalog?.categories.map((category) => (
                  <CategoryChip key={category.id} category={category} />
                ))}
          </div>
        </div>

        <TrendingProductsSection
          products={getUniqueProducts([
            ...(catalog?.preorderProducts ?? []),
            ...(catalog?.featuredProducts ?? []),
          ]).slice(0, 6)}
          isLoading={isLoading}
        />
        {error && (
          <div
            className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        <ProductSection
          title="Preorder picks"
          products={catalog?.preorderProducts ?? []}
          isLoading={isLoading}
        />

        <ProductSection
          title="Featured products"
          products={catalog?.featuredProducts ?? []}
          isLoading={isLoading}
        />

        <WhyChooseSection />

        <div className="mb-6">
          <TrustBanner variant="delivery" />
        </div>

        {SHOW_BLOG ? <BusinessIdeasSection ideas={businessIdeas.slice(0, 3)} /> : null}

        <section className="mb-10 rounded-2xl border border-primary-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-primary-700">
                Guides & insights
              </p>
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-surface-950">
                Learn How It Works
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-surface-500">
                Clear answers about preorder timelines, inspection in China, customs, and delivery
                expectations for Nigeria.
              </p>
            </div>
            <Link
              to="/blog"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-primary-200 px-4 text-sm font-bold text-primary-700 hover:bg-primary-50"
            >
              View all guides
            </Link>
          </div>
          <BlogList posts={featuredBlogPosts} limit={3} isLoading={isBlogLoading} />
          {!isBlogLoading && featuredBlogPosts.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-surface-500">
              Fresh guides will appear here as new articles are published.
            </p>
          ) : null}
        </section>

        <SocialProof
          limit={4}
          eyebrow="Customer trust"
          title="What Our Customers Say"
          subtitle="Real preorder feedback from Nigerian shoppers who wanted safer China-to-Nigeria buying."
          className="mb-10"
        />

        <section className="mb-20 rounded-2xl border border-primary-100 bg-white p-5 shadow-sm sm:mb-10">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
                Need help ordering?
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold text-surface-950">
                Talk to YurDeals support
              </h2>
              <p className="mt-2 text-sm text-surface-500">
                Get help with China sourcing, preorder timing, and delivery to Nigeria.
              </p>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-3">
              <a
                href="tel:+23470609716345"
                className="min-h-12 rounded-full bg-primary-500 px-5 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-primary-600 active:bg-primary-700"
              >
                Call +234 706 097 1634
              </a>
              <a
                href="https://wa.me/23470609716345"
                className="min-h-12 rounded-full border border-green-200 px-5 py-3 text-center text-sm font-semibold text-green-700 hover:bg-green-50"
              >
                WhatsApp
              </a>
              <a
                href="https://instagram.com/yurdeals"
                className="min-h-12 rounded-full border border-surface-300 px-5 py-3 text-center text-sm font-semibold text-surface-700 hover:border-primary-300 hover:text-primary-700"
              >
                Instagram
              </a>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function BusinessIdeasSection({ ideas }: { ideas: BusinessIdea[] }) {
  return (
    <section className="mb-10">
      <div className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
          Learn and resell
        </p>
        <h2 className="font-display text-2xl font-bold text-surface-950">
          Business Ideas for Nigerian Entrepreneurs
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-surface-500">
          Practical product ideas and import tips for testing small, learning quickly, and growing
          with less guesswork.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {ideas.map((idea) => (
          <article key={idea.id} className="rounded-lg border border-surface-200 bg-white p-4">
            <time className="text-xs font-semibold uppercase tracking-wide text-surface-400">
              {formatDate(idea.publishedAt)}
            </time>
            <h3 className="mt-2 font-display text-lg font-bold text-surface-950">
              {idea.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-surface-600">{idea.excerpt}</p>
            <Link
              to={`/ideas/${idea.slug}`}
              className="mt-4 inline-flex min-h-10 items-center rounded-full text-sm font-semibold text-primary-700 hover:text-primary-800"
            >
              Read more
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

function getUniqueProducts(
  products: HomeCatalogData['featuredProducts'],
): HomeCatalogData['featuredProducts'] {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.id)) {
      return false;
    }
    seen.add(product.id);
    return true;
  });
}

interface ProductSectionProps {
  title: string;
  subtitle?: string;
  products: HomeCatalogData['featuredProducts'];
  isLoading: boolean;
  productBadge?: string;
}

function TrendingProductsSection({
  products,
  isLoading,
}: {
  products: HomeCatalogData['featuredProducts'];
  isLoading: boolean;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-primary-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <p className="text-sm font-bold uppercase tracking-wide text-primary-700">
          Popular this week
        </p>
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-surface-950">
          Trending in Nigeria
        </h2>
        <p className="mt-1 text-sm leading-6 text-surface-500">
          Recently preordered items Nigerian shoppers are checking out right now.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => <ProductCardSkeleton key={index} />)
          : products.map((product) => (
              <ProductCard key={product.id} product={product} badgeLabel="Trending Now" />
            ))}
      </div>

      {!isLoading && products.length === 0 && (
        <p className="mt-4 rounded-2xl border border-dashed border-surface-300 p-5 text-center text-sm text-surface-500">
          Trending preorder picks will appear here once catalog items are active.
        </p>
      )}

      <Link
        to="/categories/all"
        className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-primary-500 px-6 py-3 text-base font-bold text-white shadow-sm transition hover:bg-primary-600 active:bg-primary-700"
      >
        View All Products
      </Link>
    </section>
  );
}

function WhyChooseSection(): JSX.Element {
  return (
    <section className="mb-6 rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-primary-50 to-accent-100 p-4 text-surface-950 shadow-sm sm:p-5">
      <div className="mb-4">
        <p className="text-sm font-bold uppercase tracking-wide text-primary-700">
          Why choose us
        </p>
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-surface-950">
          Safer preorders from China to Nigeria
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {whyChooseItems.map((item) => (
          <article
            key={item.title}
            className="flex gap-3 rounded-2xl border border-primary-100 bg-white/85 p-3 shadow-sm backdrop-blur"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700 ring-1 ring-primary-100">
              <WhyChooseIcon name={item.icon} />
            </span>
            <div>
              <h3 className="font-semibold text-surface-950">{item.title}</h3>
              <p className="text-sm leading-6 text-surface-700">{item.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductSection({ title, subtitle, products, isLoading, productBadge }: ProductSectionProps) {
  return (
    <section className="mb-10 py-1">
      <div className="mb-4">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-surface-950">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm leading-6 text-surface-500">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <ProductCardSkeleton key={index} />
            ))
          : products.map((product) => (
              <ProductCard key={product.id} product={product} badgeLabel={productBadge} />
            ))}
      </div>
      {!isLoading && products.length === 0 && (
        <p className="rounded-lg border border-dashed border-surface-300 p-6 text-center text-sm text-surface-500">
          Products will appear here once catalog items are active.
        </p>
      )}
    </section>
  );
}

function WhyChooseIcon({ name }: { name: (typeof whyChooseItems)[number]['icon'] }): JSX.Element {
  const commonProps = {
    className: 'h-5 w-5',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (name === 'shield') {
    return (
      <svg {...commonProps}>
        <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-5" />
      </svg>
    );
  }

  if (name === 'truck') {
    return (
      <svg {...commonProps}>
        <path d="M3 7h11v9H3z" />
        <path d="M14 10h3l3 3v3h-6z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="17" cy="18" r="2" />
      </svg>
    );
  }

  if (name === 'clock') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }

  if (name === 'support') {
    return (
      <svg {...commonProps}>
        <path d="M4 12a8 8 0 0 1 16 0" />
        <path d="M4 12v3a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 1Z" />
        <path d="M20 12v3a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 1Z" />
        <path d="M15 19h-3" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function HeroBadgeIcon({ name }: { name: (typeof heroValueBadges)[number]['icon'] }): JSX.Element {
  const commonProps = {
    className: 'h-4 w-4 text-primary-300',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (name === 'factory') {
    return (
      <svg {...commonProps}>
        <path d="M3 21h18" />
        <path d="M5 21V9l5 3V9l5 3V7h4v14" />
        <path d="M9 17h1M13 17h1M17 17h1" />
      </svg>
    );
  }

  if (name === 'truck') {
    return (
      <svg {...commonProps}>
        <path d="M3 7h11v9H3z" />
        <path d="M14 10h3l3 3v3h-6z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="17" cy="18" r="2" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-5" />
    </svg>
  );
}
