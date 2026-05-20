import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { OrderSummary, OrderTrackingData, PublicOrderTrackingData } from '@yurdeals/shared';
import { CustomerNav } from '../components/CustomerNav';
import {
  getNigerianPhoneError,
  normalizeNigerianPhoneNumber,
} from '../components/ShippingForm';
import { SkeletonBlock } from '../components/Skeleton';
import { TrackingTimeline } from '../components/TrackingTimeline';
import { TrustBanner } from '../components/TrustBanner';
import { formatPrice } from '../components/ProductCard';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import { getOrder } from '../lib/orderApi';
import {
  getOrderTracking,
  lookupPublicOrderTracking,
} from '../lib/trackingApi';
import { getDeliveryEstimate, inferDeliveryStockType } from '../lib/deliveryEstimate';

interface LookupFormState {
  phone: string;
  orderNumber: string;
}

export default function OrderTrackingPage() {
  return <OrderTrackingContent />;
}

function OrderTrackingContent() {
  const { user, isAuthenticated } = useAuth();
  const { orderId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [lookupForm, setLookupForm] = useState<LookupFormState>({
    phone: searchParams.get('phone') ?? '',
    orderNumber: searchParams.get('orderNumber') ?? '',
  });
  const [authenticatedTracking, setAuthenticatedTracking] = useState<{
    order: OrderSummary;
    tracking: OrderTrackingData;
  } | null>(null);
  const [publicTracking, setPublicTracking] = useState<PublicOrderTrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(orderId) && isAuthenticated);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId || !isAuthenticated) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    getOrderTracking(orderId)
      .then(async (response) => {
        if (!isMounted) {
          return;
        }

        const orderResponse = await getOrder(orderId);
        if (!isMounted) {
          return;
        }

        setAuthenticatedTracking({
          order: orderResponse.data.order,
          tracking: response.data,
        });
        setPublicTracking(null);
        setError('');
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
  }, [isAuthenticated, orderId]);

  useEffect(() => {
    const phone = searchParams.get('phone');
    const orderNumber = searchParams.get('orderNumber');
    if (!phone || !orderNumber) {
      return;
    }

    void handleLookup(phone, orderNumber, true);
  }, [searchParams]);

  async function handleLookup(
    phoneInput = lookupForm.phone,
    orderNumberInput = lookupForm.orderNumber,
    silent = false,
  ) {
    const normalizedPhone = normalizeNigerianPhoneNumber(phoneInput);
    if (!normalizedPhone) {
      setError(getNigerianPhoneError(phoneInput));
      return;
    }
    const trimmedOrderNumber = orderNumberInput.trim();
    if (!trimmedOrderNumber) {
      setError('Enter your order number so we can safely look up your tracking details.');
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      const response = await lookupPublicOrderTracking(normalizedPhone, trimmedOrderNumber);
      setPublicTracking(response.data);
      setAuthenticatedTracking(null);

      if (!silent) {
        setSearchParams(
          {
            phone: normalizedPhone,
            orderNumber: trimmedOrderNumber,
          },
          { replace: true },
        );
      }
    } catch (requestError) {
      setPublicTracking(null);
      if (requestError instanceof ApiError && requestError.code === 'TRACKING_RATE_LIMIT_EXCEEDED') {
        setError('Too many tracking lookups right now. Please wait a few minutes, then try again.');
      } else if (requestError instanceof ApiError && requestError.code === 'ORDER_NOT_FOUND') {
        setError(
          'We could not find a match for that phone number and order number. Check both values and try again.',
        );
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Unable to track this order right now.');
      }
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface-50 pb-24 sm:pb-0">
      <CustomerNav />

      <section className="container-app py-6">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">
            Order tracking
          </p>
          <h1 className="font-display text-3xl font-bold leading-tight text-surface-950">
            Track your delivery
          </h1>
          <p className="mt-2 text-sm text-surface-500">
            Enter the phone number used at checkout and your order number.
          </p>
        </div>

        <div className="mb-5">
          <TrustBanner variant="delivery" />
        </div>

        <section className="mb-6 rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
          <form
            className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void handleLookup();
            }}
          >
            <label className="grid gap-1 text-sm font-semibold text-surface-700">
              Phone number
              <input
                type="tel"
                value={lookupForm.phone}
                onChange={(event) =>
                  setLookupForm((current) => ({ ...current, phone: event.target.value }))
                }
                className="min-h-12 rounded-lg border border-surface-300 px-3 text-base font-normal sm:text-sm"
                placeholder="08012345678 or +2348012345678"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-surface-700">
              Order number
              <input
                value={lookupForm.orderNumber}
                onChange={(event) =>
                  setLookupForm((current) => ({ ...current, orderNumber: event.target.value }))
                }
                className="min-h-12 rounded-lg border border-surface-300 px-3 text-base font-normal uppercase sm:text-sm"
                placeholder="YD1001"
              />
            </label>
            <button
              type="submit"
              disabled={isSearching}
              className="min-h-12 rounded-full bg-primary-500 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 disabled:bg-surface-300"
            >
              {isSearching ? 'Checking...' : 'Track order'}
            </button>
          </form>

          <p className="mt-3 text-sm text-surface-500">
            We only show tracking details when both values match the order used at checkout.
          </p>

          {user?.phone && (
            <button
              type="button"
              onClick={() => {
                setLookupForm((current) => ({
                  ...current,
                  phone: current.phone || user.phone || '',
                }));
              }}
              className="mt-3 text-sm font-semibold text-primary-700 hover:text-primary-800"
            >
              Use my saved phone number
            </button>
          )}
        </section>

        {(isLoading || isSearching) && (
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

        {!isLoading &&
          !isSearching &&
          !authenticatedTracking &&
          !publicTracking &&
          !error && (
          <section className="rounded-lg border border-dashed border-surface-300 bg-white p-6 text-center shadow-sm">
            <h2 className="font-display text-xl font-bold text-surface-950">Find your order</h2>
            <p className="mt-2 text-sm leading-6 text-surface-500">
              Enter the phone number you used during checkout and your order number. If you just came
              back from payment, your order number is the fastest way to recover tracking.
            </p>
          </section>
        )}

        {!isLoading && !isSearching && authenticatedTracking && (
          <TrackedOrderCard tracked={authenticatedTracking} />
        )}

        {!isLoading && !isSearching && publicTracking && (
          <PublicTrackedOrderCard tracked={publicTracking} />
        )}
      </section>
    </main>
  );
}

function TrackedOrderCard({ tracked }: { tracked: { order: OrderSummary; tracking: OrderTrackingData } }) {
  const deliveryEstimate = getDeliveryEstimate(
    inferDeliveryStockType(tracked.order.items.map((item) => item.stockTypeSnapshot)),
  );

  return (
    <article className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-display text-xl font-bold text-surface-950">
            {tracked.order.orderNumber}
          </p>
          <p className="mt-1 text-sm text-surface-500">
            Status: <span className="font-semibold text-surface-900">{tracked.order.status}</span>
            {tracked.tracking.eta ? ` · ETA ${formatEta(tracked.tracking.eta)}` : ''}
          </p>
          {tracked.order.shippingAddress && (
            <p className="mt-1 text-sm text-surface-500">
              Delivery to {tracked.order.shippingAddress.city}, {tracked.order.shippingAddress.state}
            </p>
          )}
          <p className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${deliveryEstimate.badgeClassName}`}>
            <span aria-hidden="true">{deliveryEstimate.icon}</span>
            <span>{deliveryEstimate.label}</span>
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold text-surface-950">
            {formatPrice(tracked.order.total, tracked.order.currency)}
          </p>
          <p className="text-surface-500">{tracked.order.itemCount} item(s)</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-surface-50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-surface-500">Items</h2>
        <div className="mt-3 space-y-2">
          {tracked.order.items.map((item: (typeof tracked.order.items)[number]) => (
            <div key={item.id} className="flex justify-between gap-3 text-sm">
              <span className="text-surface-700">
                {item.quantity} x {item.name}
              </span>
              <span className="font-medium text-surface-950">
                {formatPrice(item.total, tracked.order.currency)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <TrackingTimeline events={tracked.tracking.timeline} />
      </div>
    </article>
  );
}

function PublicTrackedOrderCard({ tracked }: { tracked: PublicOrderTrackingData }) {
  const deliveryEstimate = getDeliveryEstimate(tracked.stockType);

  return (
    <article className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-display text-xl font-bold text-surface-950">{tracked.orderNumber}</p>
          <p className="mt-1 text-sm text-surface-500">
            Status: <span className="font-semibold text-surface-900">{tracked.status}</span>
            {tracked.eta ? ` · ETA ${formatEta(tracked.eta)}` : ''}
          </p>
          <p className="mt-1 text-sm text-surface-500">
            Payment: {tracked.paymentStatus ?? 'Pending'} · Shipment: {tracked.shipmentStatus ?? 'Awaiting update'}
          </p>
          <p className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${deliveryEstimate.badgeClassName}`}>
            <span aria-hidden="true">{deliveryEstimate.icon}</span>
            <span>{deliveryEstimate.label}</span>
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold text-surface-950">{tracked.itemCount} item(s)</p>
          <p className="text-surface-500">Tracking details only</p>
        </div>
      </div>

      {tracked.itemSummary.length > 0 && (
        <div className="mt-4 rounded-lg bg-surface-50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-surface-500">Order summary</h2>
          <div className="mt-3 space-y-2">
            {tracked.itemSummary.map((item: string) => (
              <p key={item} className="text-sm text-surface-700">
                {item}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <TrackingTimeline events={tracked.tracking.timeline} />
      </div>
    </article>
  );
}

function formatEta(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}


