import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { OrderTrackingData } from '@yurdeals/shared';
import { CustomerNav } from '../components/CustomerNav';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { SkeletonBlock } from '../components/Skeleton';
import { TrackingTimeline } from '../components/TrackingTimeline';
import { TrustBanner } from '../components/TrustBanner';
import { getOrderTracking } from '../lib/trackingApi';

export default function OrderTrackingPage() {
  return (
    <ProtectedRoute>
      <OrderTrackingContent />
    </ProtectedRoute>
  );
}

function OrderTrackingContent() {
  const { orderId = '' } = useParams();
  const [tracking, setTracking] = useState<OrderTrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) {
      setError('Order id is missing.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    getOrderTracking(orderId)
      .then((response) => {
        if (isMounted) {
          setTracking(response.data);
          setError('');
        }
      })
      .catch((requestError: Error) => {
        if (isMounted) {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  return (
    <main className="min-h-screen bg-surface-50 pb-24 sm:pb-0">
      <CustomerNav />

      <section className="container-app py-6">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
            Order tracking
          </p>
          <h1 className="font-display text-3xl font-bold leading-tight text-surface-950">Delivery timeline</h1>
          {tracking && (
            <p className="mt-2 text-sm text-surface-500">
              Current status: <span className="font-semibold">{tracking.currentStatus}</span>
              {tracking.eta ? ` - ETA ${formatEta(tracking.eta)}` : ''}
            </p>
          )}
        </div>
        <div className="mb-5">
          <TrustBanner variant="delivery" />
        </div>

        {isLoading && (
          <div className="rounded-lg border border-surface-200 bg-white p-5">
            <div className="space-y-4">
              <SkeletonBlock className="h-5 w-44" />
              <SkeletonBlock className="h-16 w-full" />
              <SkeletonBlock className="h-16 w-full" />
              <SkeletonBlock className="h-16 w-full" />
            </div>
          </div>
        )}

        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        {tracking && <TrackingTimeline events={tracking.timeline} />}
      </section>
    </main>
  );
}

function formatEta(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}
