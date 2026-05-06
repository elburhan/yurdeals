import { Link } from 'react-router-dom';
import type { CategorySummary } from '@yurdeals/shared';

interface CategoryChipProps {
  category: CategorySummary;
}

export function CategoryChip({ category }: CategoryChipProps) {
  return (
    <Link
      to={`/categories/${category.id}`}
      className="inline-flex min-h-11 shrink-0 snap-center items-center gap-2 rounded-full border border-surface-200 bg-white px-4 py-2 text-sm font-medium text-surface-800 shadow-sm transition-colors hover:border-primary-300 hover:text-primary-700 focus-visible:outline-primary-500"
    >
      {category.image ? (
        <img
          src={category.image}
          alt=""
          className="h-7 w-7 rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="h-2.5 w-2.5 rounded-full bg-primary-500" aria-hidden="true" />
      )}
      <span>{category.name}</span>
    </Link>
  );
}
