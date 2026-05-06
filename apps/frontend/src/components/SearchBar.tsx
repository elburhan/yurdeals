import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const popularCategories = ['Electronics', 'Fashion', 'Power & Solar', 'Cars and Trucks', 'Bulk deals'];

export function SearchBar(): JSX.Element {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/categories/all?search=${encodeURIComponent(trimmed)}` : '/categories/all');
    setIsFocused(false);
  }

  return (
    <div className="relative w-full">
      <form onSubmit={handleSubmit} role="search">
        <label htmlFor="site-search" className="sr-only">
          Search products
        </label>
        <div className="flex min-h-12 items-center rounded-full border border-surface-200 bg-surface-50 px-3 shadow-sm focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
          <span className="text-surface-400" aria-hidden="true">
            🔎
          </span>
          <input
            id="site-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => window.setTimeout(() => setIsFocused(false), 140)}
            placeholder="Search products from China (e.g. iPhone, earpods, power bank)"
            className="h-11 min-w-0 flex-1 bg-transparent px-2 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none"
          />
          <button
            type="submit"
            className="hidden min-h-9 rounded-full bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 sm:inline-flex sm:items-center"
          >
            Search
          </button>
        </div>
      </form>

      {isFocused && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 rounded-lg border border-surface-200 bg-white p-3 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">
            Popular searches
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {popularCategories.map((category) => (
              <Link
                key={category}
                to={`/categories/all?search=${encodeURIComponent(category)}`}
                className="min-h-10 rounded-full bg-surface-100 px-3 py-2 text-sm font-semibold text-surface-700 hover:bg-primary-50 hover:text-primary-700"
              >
                {category}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
