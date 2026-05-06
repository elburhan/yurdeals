import { Link } from 'react-router-dom';

interface EmptyStateProps {
  title: string;
  message: string;
  ctaLabel?: string;
  ctaTo?: string;
  icon?: string;
}

export function EmptyState({
  title,
  message,
  ctaLabel,
  ctaTo,
  icon = 'YD',
}: EmptyStateProps): JSX.Element {
  return (
    <div className="rounded-lg border border-dashed border-surface-300 bg-white p-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-base font-display font-bold text-primary-700">
        {icon}
      </div>
      <h2 className="mt-4 font-display text-xl font-bold text-surface-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-surface-500">{message}</p>
      {ctaLabel && ctaTo && (
        <Link
          to={ctaTo}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary-600 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-700 sm:w-auto"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
