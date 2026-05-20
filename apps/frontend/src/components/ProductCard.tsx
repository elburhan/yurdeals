import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { ProductListItem } from '@yurdeals/shared';
import { useCart } from '../hooks/useCart';
import { useToast } from '../context/ToastContext';
import { getDeliveryEstimate } from '../lib/deliveryEstimate';

interface ProductCardProps {
  product: ProductListItem;
  badgeLabel?: string;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const { showToast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);
  const primaryImage = product.primaryImage;
  const isPreorder = product.stockType === 'PREORDER';
  const isSoldOut = product.isSoldOut;
  const deliveryEstimate = getDeliveryEstimate(product.stockType);
  const availabilityLabel = getAvailabilityLabel(product);
  const preorderBatchMessage = getPreorderBatchMessage(product);
  const marketingBadge = isSoldOut ? null : getMarketingBadgeLabel(product.marketingBadge);

  async function handleAddToCart() {
    if (isSoldOut) {
      showToast('This item is currently sold out.', 'error');
      return;
    }

    setIsAdding(true);
    try {
      await addItem({
        product_id: product.id,
        quantity: 1,
      });
      showToast(`${product.name} added to cart.`, 'success');
    } catch (error) {
      console.error('Failed to add to cart:', error);
      showToast(error instanceof Error ? error.message : 'Unable to add item to cart.', 'error');
    } finally {
      setIsAdding(false);
    }
  }
  return (
    <article className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-md">
      <Link to={`/products/${product.id}`} className="block">
        <div className="relative aspect-[5/6] bg-surface-100">
          <span className="absolute left-2 top-2 z-10 rounded-full bg-primary-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            {isPreorder ? 'Preorder' : 'Local'}
          </span>
          {marketingBadge && (
            <span className="absolute right-2 top-2 z-10 rounded-full bg-amber-400 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-surface-950 shadow-sm">
              {marketingBadge}
            </span>
          )}
          {isSoldOut && (
            <span className="absolute inset-x-3 bottom-3 z-10 rounded-xl bg-surface-950/85 px-3 py-2 text-center text-xs font-black uppercase tracking-wide text-white shadow-sm">
              Sold Out
            </span>
          )}
          {primaryImage && !hasImageError ? (
            <img
              src={primaryImage.url}
              alt={primaryImage.alt ?? product.name}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={() => setHasImageError(true)}
            />
          ) : (
            <ProductCardImagePlaceholder productName={product.name} />
          )}
        </div>
        <div className="space-y-2 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-primary-700 sm:text-xs">
              {isPreorder ? 'Preorder' : 'Local'}
            </span>
            {product.isFeatured && (
              <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-medium text-accent-700 sm:text-xs">
                Featured
              </span>
            )}
          </div>
          <h3 className="line-clamp-2 min-h-11 text-sm font-semibold leading-5 text-surface-950 sm:min-h-12 sm:text-base sm:leading-6">
            {product.name}
          </h3>
          <p className="text-xs text-surface-500">{product.category.name}</p>
          <p className="text-sm font-bold text-surface-950 sm:text-base">
            <span className="block text-xs font-semibold text-surface-500">Preorder Price</span>
            {formatPrice(product.basePrice, product.currency)}
          </p>
          <p
            className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${deliveryEstimate.badgeClassName}`}
          >
            <span aria-hidden="true">{deliveryEstimate.icon}</span>
            <span>{deliveryEstimate.label}</span>
          </p>
          {availabilityLabel && (
            <p className={`text-xs font-semibold ${isSoldOut ? 'text-red-700' : 'text-amber-700'}`}>
              {availabilityLabel}
            </p>
          )}
          {preorderBatchMessage && (
            <p className="text-xs leading-5 text-surface-600">{preorderBatchMessage}</p>
          )}
        </div>
      </Link>
      <div className="space-y-2 border-t border-surface-200 px-3 py-3 sm:px-4">
        <Link
          to={`/products/${product.id}`}
          className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-center text-sm font-semibold shadow-sm transition active:scale-[0.98] sm:text-base ${
            isSoldOut
              ? 'bg-surface-800 text-white hover:bg-surface-900'
              : 'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700'
          }`}
        >
          <span>{isSoldOut ? 'View details' : 'Preorder Now'}</span>
          <span aria-hidden="true">-&gt;</span>
        </Link>
        <button
          onClick={handleAddToCart}
          disabled={isAdding || isSoldOut}
          className="min-h-11 w-full rounded-xl border border-primary-500 px-3 py-2 text-sm font-semibold text-primary-700 transition hover:bg-primary-50 active:scale-[0.98] disabled:opacity-50"
          aria-label={`Add ${product.name} to cart`}
        >
          {isSoldOut ? 'Sold out' : isAdding ? 'Adding...' : 'Add to cart'}
        </button>
      </div>
    </article>
  );
}

function getMarketingBadgeLabel(badge: ProductListItem['marketingBadge']): string | null {
  if (badge === 'SELLING_FAST') {
    return 'Selling Fast';
  }

  if (badge === 'TRENDING') {
    return 'Trending Item';
  }

  return null;
}

function getAvailabilityLabel(product: ProductListItem): string | null {
  if (product.isSoldOut) {
    return 'Sold out - check back later or contact support';
  }

  if (product.stockType === 'PREORDER' && product.preorderSlotsRemaining !== null) {
    return `${product.preorderSlotsRemaining} preorder slot(s) left`;
  }

  if (product.stockType === 'IN_STOCK' && product.inventoryQuantity !== null) {
    return `${product.inventoryQuantity} in local stock`;
  }

  return null;
}

function getPreorderBatchMessage(product: ProductListItem): string | null {
  if (product.stockType !== 'PREORDER' || product.isSoldOut) {
    return null;
  }

  if (isClosingSoon(product.preorderEndsAt)) {
    return 'Current preorder batch closes soon. Prices may update in future preorder batches.';
  }

  if (product.pricingBatchLabel) {
    return `${product.pricingBatchLabel}. Prices may update in future preorder batches.`;
  }

  return 'Preorder pricing is set per batch and may update in future preorder batches.';
}

function isClosingSoon(preorderEndsAt: string | null): boolean {
  if (!preorderEndsAt) {
    return false;
  }

  const closingTime = new Date(preorderEndsAt).getTime();
  if (Number.isNaN(closingTime)) {
    return false;
  }

  const hoursUntilClose = (closingTime - Date.now()) / (1000 * 60 * 60);
  return hoursUntilClose > 0 && hoursUntilClose <= 72;
}

function ProductCardImagePlaceholder({ productName }: { productName: string }): JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-100 via-white to-accent-100 px-4 text-center text-sm font-medium text-surface-500">
      {productName}
    </div>
  );
}

export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
