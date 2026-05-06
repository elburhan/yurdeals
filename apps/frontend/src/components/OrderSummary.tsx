import { Link } from 'react-router-dom';
import { formatPrice } from './ProductCard';

interface OrderSummaryProps {
  itemCount: number;
  subtotal: number;
  currency: string;
  ctaTo?: string;
  ctaLabel?: string;
  disabled?: boolean;
  sticky?: boolean;
}

export function OrderSummary({
  itemCount,
  subtotal,
  currency,
  ctaTo,
  ctaLabel = 'Proceed to Checkout',
  disabled = false,
  sticky = false,
}: OrderSummaryProps): JSX.Element {
  return (
    <aside
      className={`h-fit rounded-2xl border border-surface-200 bg-white p-5 shadow-sm ${
        sticky ? 'lg:sticky lg:top-32' : ''
      }`}
    >
      <h2 className="font-display text-xl font-bold text-surface-950">Order Summary</h2>
      <div className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-surface-500">Items</span>
          <span className="font-medium text-surface-950">{itemCount}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-surface-500">Subtotal</span>
          <span className="font-medium text-surface-950">{formatPrice(subtotal, currency)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-surface-500">Estimated shipping</span>
          <span className="text-right font-medium text-surface-950">Calculated at checkout</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-surface-200 pt-3 text-base">
          <span className="font-semibold text-surface-950">Total</span>
          <span className="font-bold text-surface-950">{formatPrice(subtotal, currency)}</span>
        </div>
      </div>

      {ctaTo && (
        <Link
          to={ctaTo}
          aria-disabled={disabled}
          className={`mt-5 flex min-h-[52px] w-full items-center justify-center rounded-full px-5 py-3 text-base font-semibold text-white ${
            disabled ? 'pointer-events-none bg-surface-300' : 'bg-primary-500 hover:bg-primary-600 active:bg-primary-700'
          }`}
        >
          {ctaLabel}
        </Link>
      )}

      <div className="mt-4 space-y-2 text-sm text-surface-500">
        <p>Estimated delivery: 25-40 days after order confirmation.</p>
        <p>We inspect your preorder in China before shipping.</p>
      </div>
    </aside>
  );
}
