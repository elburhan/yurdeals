interface SkeletonBlockProps {
  className?: string;
}

export function SkeletonBlock({ className = '' }: SkeletonBlockProps): JSX.Element {
  return (
    <div
      className={`animate-shimmer rounded-lg bg-gradient-to-r from-surface-100 via-surface-200 to-surface-100 bg-[length:200%_100%] ${className}`}
      aria-hidden="true"
    />
  );
}

export function ProductCardSkeleton(): JSX.Element {
  return (
    <article className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm">
      <SkeletonBlock className="aspect-[5/6] rounded-none" />
      <div className="space-y-3 p-3 sm:p-4">
        <SkeletonBlock className="h-3 w-20" />
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-3/4" />
        <SkeletonBlock className="h-5 w-24" />
        <SkeletonBlock className="h-3 w-28" />
      </div>
      <div className="space-y-2 border-t border-surface-200 px-3 py-3 sm:px-4">
        <SkeletonBlock className="h-12 w-full rounded-lg" />
        <SkeletonBlock className="h-11 w-full rounded-lg" />
      </div>
    </article>
  );
}

export function CartItemSkeleton(): JSX.Element {
  return (
    <article className="grid gap-4 rounded-2xl border border-surface-200 bg-white p-4 sm:grid-cols-[112px_1fr]">
      <SkeletonBlock className="h-24 w-24 sm:h-28 sm:w-28" />
      <div className="space-y-3">
        <SkeletonBlock className="h-5 w-3/4" />
        <SkeletonBlock className="h-4 w-36" />
        <SkeletonBlock className="h-4 w-44" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SkeletonBlock className="h-12 w-36" />
          <SkeletonBlock className="h-6 w-24" />
        </div>
      </div>
    </article>
  );
}

export function SummarySkeleton(): JSX.Element {
  return (
    <aside className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
      <SkeletonBlock className="h-6 w-36" />
      <div className="mt-5 space-y-4">
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-5/6" />
        <SkeletonBlock className="h-8 w-full" />
      </div>
    </aside>
  );
}
