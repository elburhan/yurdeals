import { Link } from 'react-router-dom';
import { CustomerNav } from '../components/CustomerNav';
import { EmptyState } from '../components/EmptyState';
import { OrderSummary } from '../components/OrderSummary';
import { QuantityStepper } from '../components/QuantityStepper';
import { CartItemSkeleton, SummarySkeleton } from '../components/Skeleton';
import { TrustBanner } from '../components/TrustBanner';
import { formatPrice } from '../components/ProductCard';
import { useCart } from '../hooks/useCart';
import { useToast } from '../context/ToastContext';

export default function CartPage() {
  return <CartContent />;
}

function CartContent() {
  const { cart, isLoading, error, updateItem, removeItem } = useCart();
  const { showToast } = useToast();
  const items = cart?.items ?? [];

  async function handleUpdateItem(itemId: string, quantity: number) {
    try {
      await updateItem(itemId, quantity);
      showToast('Cart quantity updated.', 'success');
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to update cart.', 'error');
    }
  }

  async function handleRemoveItem(itemId: string) {
    try {
      await removeItem(itemId);
      showToast('Item removed from cart.', 'success');
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to remove item.', 'error');
    }
  }

  return (
    <main className="min-h-screen bg-surface-50 pb-24 sm:pb-0">
      <CustomerNav />

      <section className="container-app grid gap-6 py-6 lg:grid-cols-[1fr_360px]">
        <div>
          <h1 className="mb-5 font-display text-3xl font-bold leading-tight text-surface-950">
            Your cart
          </h1>
          <div className="mb-5">
            <TrustBanner variant="checkout" />
          </div>

          {error && (
            <div
              className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}

          {isLoading && (
            <div className="space-y-4">
              <CartItemSkeleton />
              <CartItemSkeleton />
              <CartItemSkeleton />
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <EmptyState
              title="Your cart is empty"
              message="Start exploring preorder deals from China."
              ctaLabel="Browse products"
              ctaTo="/categories/all"
            />
          )}

          <div className="space-y-4">
            {items.map((item) => (
              <article
                key={item.id}
                className="grid gap-4 rounded-lg border border-surface-200 bg-white p-4 sm:grid-cols-[112px_1fr]"
              >
                <Link
                  to={`/products/${item.productId}`}
                  className="relative h-24 w-24 overflow-hidden rounded-lg bg-surface-100 sm:h-28 sm:w-28"
                >
                  <span className="absolute left-2 top-2 z-10 rounded-full bg-primary-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    Preorder
                  </span>
                  {item.product.primaryImage ? (
                    <img
                      src={item.product.primaryImage.url}
                      alt={item.product.primaryImage.alt ?? item.product.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-primary-100 to-accent-100" />
                  )}
                </Link>

                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <Link
                        to={`/products/${item.productId}`}
                        className="font-semibold text-surface-950 hover:text-primary-700"
                      >
                        {item.product.name}
                      </Link>
                      {item.variant && (
                        <p className="mt-1 text-sm text-surface-500">{item.variant.name}</p>
                      )}
                      <p className="mt-1 text-sm font-semibold text-surface-900">
                        Preorder Price: {formatPrice(item.priceSnapshot, item.currency)}
                      </p>
                      <p className="mt-1 text-sm font-medium text-emerald-700">
                        Estimated arrival: 25-40 days
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRemoveItem(item.id)}
                      className="min-h-12 w-full rounded-lg px-3 text-sm font-medium text-red-600 hover:bg-red-50 sm:w-auto"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <QuantityStepper
                      value={item.quantity}
                      max={item.variant?.stock ?? 99}
                      onChange={(quantity) => void handleUpdateItem(item.id, quantity)}
                    />
                    <p className="font-bold text-surface-950">
                      {formatPrice(item.lineTotal, item.currency)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {isLoading ? (
          <SummarySkeleton />
        ) : (
          <OrderSummary
            itemCount={cart?.summary.itemCount ?? 0}
            subtotal={cart?.summary.subtotal ?? 0}
            currency={cart?.summary.currency ?? 'NGN'}
            ctaTo="/checkout"
            disabled={items.length === 0}
            sticky
          />
        )}
      </section>
    </main>
  );
}
