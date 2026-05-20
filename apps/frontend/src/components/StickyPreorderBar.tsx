import type { DeliveryStockType } from '../lib/deliveryEstimate';
import { getDeliveryEstimate } from '../lib/deliveryEstimate';

interface StickyPreorderBarProps {
  price: string;
  stockType: DeliveryStockType;
  isAdding: boolean;
  isSoldOut?: boolean;
  onPreorder: () => void;
}

export function StickyPreorderBar({
  price,
  stockType,
  isAdding,
  isSoldOut = false,
  onPreorder,
}: StickyPreorderBarProps): JSX.Element {
  const deliveryEstimate = getDeliveryEstimate(stockType);

  return (
    <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 rounded-2xl border border-surface-200 bg-white p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] lg:hidden">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">
            {stockType === 'PREORDER' ? 'Preorder price' : 'Price'}
          </p>
          <p className="font-display text-lg font-bold text-surface-950">{price}</p>
          <p
            className={
              isSoldOut
                ? 'text-xs font-semibold text-red-700'
                : `inline-flex items-center gap-1 text-xs font-semibold ${deliveryEstimate.textClassName}`
            }
          >
            {isSoldOut ? null : <span aria-hidden="true">{deliveryEstimate.icon}</span>}
            <span>{isSoldOut ? 'Currently sold out' : deliveryEstimate.label}</span>
          </p>
        </div>
        <button
          type="button"
          disabled={isAdding || isSoldOut}
          onClick={onPreorder}
          className="min-h-12 rounded-full bg-primary-500 px-5 text-sm font-bold text-white shadow-sm hover:bg-primary-600 active:bg-primary-700 disabled:bg-surface-300"
        >
          {isSoldOut ? 'Sold Out' : isAdding ? 'Adding...' : 'Preorder Now'}
        </button>
      </div>
    </div>
  );
}
