import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { ProductListItem } from '@yurdeals/shared';
import { useCart } from '../hooks/useCart';
import { useToast } from '../context/ToastContext';

interface ProductCardProps {
  product: ProductListItem;
  badgeLabel?: string;
}

export function ProductCard({ product, badgeLabel }: ProductCardProps) {
  const { addItem } = useCart();
  const { showToast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const conversionBadge =
    badgeLabel ?? (product.isFeatured ? 'Selling Fast' : product.stockType === 'PREORDER' ? 'Limited Preorder' : undefined);

  async function handleAddToCart() {
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
            Preorder
          </span>
          {conversionBadge && (
            <span className="absolute right-2 top-2 z-10 rounded-full bg-amber-400 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-surface-950 shadow-sm">
              {conversionBadge}
            </span>
          )}
          {product.primaryImage ? (
            <img
              src={product.primaryImage.url}
              alt={product.primaryImage.alt ?? product.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-100 via-white to-accent-100 px-4 text-center text-sm font-medium text-surface-500">
              {product.name}
            </div>
          )}
        </div>
        <div className="space-y-2 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-primary-700 sm:text-xs">
              {product.stockType === 'PREORDER' ? 'Preorder' : 'Local'}
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
          <p className="text-xs font-medium text-emerald-700">
            Arrives in 25-40 days
          </p>
        </div>
      </Link>
      <div className="space-y-2 border-t border-surface-200 px-3 py-3 sm:px-4">
        <Link
          to={`/products/${product.id}`}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-3 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-primary-600 active:scale-[0.98] active:bg-primary-700 sm:text-base"
        >
          <span>Preorder Now</span>
          <span aria-hidden="true">-&gt;</span>
        </Link>
        <button
          onClick={handleAddToCart}
          disabled={isAdding}
          className="min-h-11 w-full rounded-xl border border-primary-500 px-3 py-2 text-sm font-semibold text-primary-700 transition hover:bg-primary-50 active:scale-[0.98] disabled:opacity-50"
          aria-label={`Add ${product.name} to cart`}
        >
          {isAdding ? 'Adding...' : 'Add to cart'}
        </button>
      </div>
    </article>
  );
}

export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
