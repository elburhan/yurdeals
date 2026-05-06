import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { OrderSummary, PaginationMeta } from '@yurdeals/shared';
import { CustomerNav } from '../components/CustomerNav';
import { EmptyState } from '../components/EmptyState';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { SkeletonBlock } from '../components/Skeleton';
import { TrustBanner } from '../components/TrustBanner';
import { formatPrice } from '../components/ProductCard';
import { cancelOrder, getOrders } from '../lib/orderApi';

export default function OrdersPage() {
  return (
    <ProtectedRoute>
      <OrdersContent />
    </ProtectedRoute>
  );
}

function OrdersContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState('');
  const [error, setError] = useState('');

  async function loadOrders() {
    setIsLoading(true);
    try {
      const response = await getOrders(Number.isNaN(page) ? 1 : page);
      setOrders(response.data.orders);
      setMeta(response.meta ?? null);
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load orders');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, [page]);

  function setPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
  }

  async function handleCancelOrder(orderId: string) {
    setCancellingId(orderId);
    setError('');
    try {
      await cancelOrder(orderId);
      await loadOrders();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to cancel order');
    } finally {
      setCancellingId('');
    }
  }

  return (
    <main className="min-h-screen bg-surface-50 pb-24 sm:pb-0">
      <CustomerNav />
      <section className="container-app py-6">
        <div className="mb-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
            My orders
          </p>
          <h1 className="font-display text-3xl font-bold leading-tight text-surface-950">Order history</h1>
          <p className="mt-2 text-sm text-surface-500">
            Track payments, delivery milestones, and past purchases from one place.
          </p>
        </div>

        <div className="mb-5">
          <TrustBanner variant="delivery" />
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadOrders()}
              className="mt-3 min-h-12 rounded-lg bg-red-100 px-4 font-semibold text-red-800"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading && (
          <div className="space-y-4">
            <OrderSkeleton />
            <OrderSkeleton />
            <OrderSkeleton />
          </div>
        )}

        {!isLoading && orders.length === 0 && (
          <EmptyState
            title="You haven't placed any preorders yet."
            message="Your preorder history will appear here after checkout."
            ctaLabel="Start your first preorder"
            ctaTo="/categories/all"
          />
        )}

        <div className="space-y-4">
          {orders.map((order) => (
            <article key={order.id} className="rounded-lg border border-surface-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-display text-lg font-bold text-surface-950">
                    {order.orderNumber}
                  </p>
                  <p className="text-sm text-surface-500">{formatDate(order.createdAt)}</p>
                </div>
                <span className="w-fit rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700">
                  {order.status}
                </span>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-surface-600">
                  <p>{order.itemCount} item(s)</p>
                  <p className="font-bold text-surface-950">
                    {formatPrice(order.total, order.currency)}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {order.status === 'PENDING' && (
                    <button
                      type="button"
                      disabled={cancellingId === order.id}
                      onClick={() => void handleCancelOrder(order.id)}
                      className="min-h-12 rounded-full border border-red-200 px-5 py-3 text-center text-sm font-semibold text-red-700 hover:bg-red-50 disabled:text-surface-400"
                    >
                      {cancellingId === order.id ? 'Cancelling...' : 'Cancel order'}
                    </button>
                  )}
                  <Link
                    to={`/orders/${order.id}/tracking`}
                    className="min-h-12 rounded-full bg-primary-500 px-5 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-primary-600 active:bg-primary-700"
                  >
                    Track order
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={meta.page <= 1}
              onClick={() => setPage(meta.page - 1)}
              className="min-h-12 rounded-lg border border-surface-300 px-4 text-sm font-semibold disabled:text-surface-300"
            >
              Previous
            </button>
            <span className="text-sm text-surface-500">
              Page {meta.page} of {meta.totalPages}
            </span>
            <button
              type="button"
              disabled={meta.page >= meta.totalPages}
              onClick={() => setPage(meta.page + 1)}
              className="min-h-12 rounded-lg border border-surface-300 px-4 text-sm font-semibold disabled:text-surface-300"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

function OrderSkeleton(): JSX.Element {
  return (
    <article className="rounded-lg border border-surface-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-5 w-44" />
          <SkeletonBlock className="h-4 w-28" />
        </div>
        <SkeletonBlock className="h-7 w-24 rounded-full" />
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SkeletonBlock className="h-10 w-32" />
        <SkeletonBlock className="h-12 w-full rounded-full sm:w-32" />
      </div>
    </article>
  );
}
