import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type {
  CategorySummary,
  HomeCatalogData,
  ProductListItem,
  ProductCatalogFilters,
  PaginationMeta,
} from '@yurdeals/shared';
import { getCategories, getHomeCatalog, getProducts } from '../lib/catalogApi';
import { CustomerNav } from '../components/CustomerNav';
import { EmptyState } from '../components/EmptyState';
import { ProductCard } from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/Skeleton';

export default function CategoryPage() {
  const { categoryId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [fallbackProducts, setFallbackProducts] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFallbackLoading, setIsFallbackLoading] = useState(false);
  const [error, setError] = useState('');
  const isAllProductsPage = categoryId === 'all' || !categoryId;
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const pageTitle = isAllProductsPage
    ? 'All Products - Preorder from China to Nigeria'
    : `${selectedCategory?.name ?? 'Products'} - Preorder from China to Nigeria`;
  const displayedProducts =
    isAllProductsPage && products.length === 0 ? fallbackProducts : products;
  const shouldShowSkeletons =
    isLoading || (isAllProductsPage && isFallbackLoading && displayedProducts.length === 0);

  const filters = useMemo<ProductCatalogFilters>(() => {
    const page = Number(searchParams.get('page') ?? '1');
    const search = searchParams.get('search') ?? undefined;
    const sort = searchParams.get('sort') as ProductCatalogFilters['sort'] | null;
    const preorder = searchParams.get('preorder') === 'true' ? true : undefined;

    return {
      page: Number.isNaN(page) ? 1 : page,
      limit: categoryId === 'all' ? 24 : 12,
      category_id: categoryId === 'all' ? undefined : categoryId,
      search,
      preorder,
      sort: sort ?? 'newest',
    };
  }, [categoryId, searchParams]);

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    getProducts(filters)
      .then((response) => {
        if (isMounted) {
          setProducts(response.data.products);
          setMeta(response.meta ?? null);
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
  }, [filters]);

  useEffect(() => {
    let isMounted = true;

    if (!isAllProductsPage) {
      setFallbackProducts([]);
      return;
    }

    setIsFallbackLoading(true);
    getHomeCatalog()
      .then((response) => {
        if (isMounted) {
          setFallbackProducts(
            getUniqueProducts([
              ...response.data.preorderProducts,
              ...response.data.featuredProducts,
            ]).slice(0, 24),
          );
        }
      })
      .catch(() => {
        if (isMounted) {
          setFallbackProducts([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsFallbackLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAllProductsPage]);

  useEffect(() => {
    let isMounted = true;

    getCategories()
      .then((response) => {
        if (isMounted) {
          setCategories(response.data.categories);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCategories([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function updateSearch(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) {
      next.set('search', value.trim());
    } else {
      next.delete('search');
    }
    next.set('page', '1');
    setSearchParams(next);
  }

  return (
    <main className="min-h-screen bg-surface-50 pb-24 sm:pb-0">
      <CustomerNav />

      <section className="container-app py-6">
        <div className="mb-5 space-y-3">
          <p className="text-sm font-bold uppercase tracking-wide text-primary-700">
            China to Nigeria catalog
          </p>
          <h1 className="font-display text-3xl font-bold leading-tight text-surface-950">
            {isAllProductsPage ? 'All Products' : selectedCategory?.name ?? 'Products'}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-surface-500">
            Browse preorder and local product picks with clear pricing, Paystack checkout, and
            WhatsApp support.
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              type="search"
              defaultValue={searchParams.get('search') ?? ''}
              onBlur={(event) => updateSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  updateSearch(event.currentTarget.value);
                }
              }}
              placeholder="Search products"
              className="min-h-12 rounded-lg border border-surface-300 px-4 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 sm:text-sm"
            />
            <select
              value={filters.sort ?? 'newest'}
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                next.set('sort', event.target.value);
                next.set('page', '1');
                setSearchParams(next);
              }}
              className="min-h-12 rounded-lg border border-surface-300 px-4 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 sm:text-sm"
              aria-label="Sort products"
            >
              <option value="newest">Newest</option>
              <option value="featured">Featured</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="name_asc">Name</option>
            </select>
          </div>
        </div>

        <div className="mb-6 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
          <Link
            to="/categories/all"
            className={`inline-flex min-h-11 shrink-0 snap-center items-center rounded-full border px-4 py-2 text-sm font-semibold shadow-sm ${
              isAllProductsPage
                ? 'border-primary-500 bg-primary-500 text-white'
                : 'border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100'
            }`}
          >
            All
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/categories/${category.id}`}
              className={`inline-flex min-h-11 shrink-0 snap-center items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
                category.id === categoryId
                  ? 'border-primary-500 bg-primary-500 text-white'
                  : 'border-surface-200 bg-white text-surface-800 hover:border-primary-300 hover:text-primary-700'
              }`}
            >
              {category.image ? (
                <img
                  src={category.image}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    category.id === categoryId ? 'bg-white' : 'bg-primary-500'
                  }`}
                  aria-hidden="true"
                />
              )}
              <span>{category.name}</span>
            </Link>
          ))}
        </div>

        {error && (
          <div
            className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {shouldShowSkeletons
            ? Array.from({ length: 12 }).map((_, index) => (
                <ProductCardSkeleton key={index} />
              ))
            : displayedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
        </div>

        {!isLoading && !isAllProductsPage && products.length === 0 && (
          <EmptyState
            title="No products found"
            message="Try another keyword or browse all categories for preorder deals."
            ctaLabel="Browse categories"
            ctaTo="/categories/all"
          />
        )}

        {meta && meta.totalPages > 1 && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <PaginationButton page={meta.page - 1} disabled={meta.page <= 1} />
            <span className="text-sm text-surface-600">
              Page {meta.page} of {meta.totalPages}
            </span>
            <PaginationButton page={meta.page + 1} disabled={meta.page >= meta.totalPages} />
          </div>
        )}
      </section>
    </main>
  );
}

function getUniqueProducts(products: HomeCatalogData['featuredProducts']): ProductListItem[] {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.id)) {
      return false;
    }
    seen.add(product.id);
    return true;
  });
}

interface PaginationButtonProps {
  page: number;
  disabled: boolean;
}

function PaginationButton({ page, disabled }: PaginationButtonProps) {
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  next.set('page', String(page));

  if (disabled) {
    return (
      <span className="inline-flex min-h-12 items-center rounded-lg border border-surface-200 px-4 py-2 text-sm text-surface-300">
        {page < 1 ? 'Previous' : 'Next'}
      </span>
    );
  }

  return (
    <Link
      to={{ search: next.toString() }}
      className="inline-flex min-h-12 items-center rounded-lg border border-surface-300 bg-white px-4 py-2 text-sm font-medium text-surface-700 hover:border-primary-400 hover:text-primary-700"
    >
      {page < Number(searchParams.get('page') ?? '1') ? 'Previous' : 'Next'}
    </Link>
  );
}
