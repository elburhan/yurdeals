import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { PaymentSummary } from '@yurdeals/shared';
import { CustomerNav } from '../components/CustomerNav';
import { TrustBanner } from '../components/TrustBanner';
import { getGuestPaymentStatus, getPaymentStatus } from '../lib/paymentApi';
import { formatPrice } from '../components/ProductCard';
import {
  clearGuestPaymentSession,
  getGuestPaymentSession,
} from '../lib/guestPaymentSession';
import { useAuth } from '../hooks/useAuth';

export default function PaymentReturnPage() {
  return <PaymentReturnContent />;
}

function PaymentReturnContent() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') ?? '';
  const paymentId = searchParams.get('paymentId') ?? '';
  const legacyGuestAccessToken = searchParams.get('guestAccessToken') ?? '';
  const storedGuestSession = getGuestPaymentSession(orderId, paymentId);
  const guestAccessToken = storedGuestSession?.guestAccessToken ?? legacyGuestAccessToken;
  const isGuestReturn = Boolean(guestAccessToken || (!isAuthenticated && orderId && paymentId));
  const needsGuestRecovery = !isAuthLoading && !isAuthenticated && !guestAccessToken && orderId && paymentId;
  const orderNumber = searchParams.get('orderNumber') ?? orderId;
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [error, setError] = useState('');
  const [isPolling, setIsPolling] = useState(!needsGuestRecovery);
  const pendingTimedOut = !isPolling && payment?.status === 'PENDING';

  useEffect(() => {
    if (!orderId || !paymentId) {
      setError('Payment return details are missing.');
      setIsPolling(false);
      return;
    }

    if (isAuthLoading) {
      return;
    }

    if (needsGuestRecovery) {
      setIsPolling(false);
      return;
    }

    let isMounted = true;
    let attempts = 0;

    const intervalId = window.setInterval(() => {
      attempts += 1;
      const statusRequest = guestAccessToken
        ? getGuestPaymentStatus(orderId, paymentId, guestAccessToken)
        : getPaymentStatus(orderId, paymentId);

      statusRequest
        .then((response) => {
          if (!isMounted) return;
          setPayment(response.data.payment);
          if (response.data.payment.status === 'SUCCESS' && guestAccessToken) {
            clearGuestPaymentSession(orderId, paymentId);
          }
          if (
            response.data.payment.status === 'SUCCESS' ||
            response.data.payment.status === 'FAILED' ||
            attempts >= 10
          ) {
            setIsPolling(false);
            window.clearInterval(intervalId);
          }
        })
        .catch((requestError: Error) => {
          if (!isMounted) return;
          setError(requestError.message);
          setIsPolling(false);
          window.clearInterval(intervalId);
        });
    }, 3000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [orderId, paymentId, guestAccessToken, needsGuestRecovery, isAuthLoading]);

  return (
    <main className="min-h-screen bg-surface-50">
      <CustomerNav />

      <section className="container-app py-8">
        <div className="mx-auto max-w-lg rounded-lg border border-surface-200 bg-white p-6 text-center">
          <h1 className="font-display text-2xl font-bold text-surface-950">
            {payment?.status === 'SUCCESS'
              ? 'Thank you! Your preorder has been received.'
              : 'Payment status'}
          </h1>
          <div className="mt-4 text-left">
            <TrustBanner variant="payment" />
          </div>
          {isPolling && (
            <p className="mt-3 text-sm text-surface-500">
              We're confirming your payment. Your order is saved, and your items are being held while confirmation completes.
            </p>
          )}
          {needsGuestRecovery && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-800">
              <p className="font-semibold">We're still confirming your payment.</p>
              <p className="mt-1">
                If you completed payment, your order will update automatically.
              </p>
              <p className="mt-1">
                Need help? Contact us on WhatsApp and we'll help confirm your order.
              </p>
            </div>
          )}
          {pendingTimedOut && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              We're still confirming your payment. If you completed payment, your order will update automatically. You can check order status or contact WhatsApp support.
            </p>
          )}
          {error && (
            <p
              className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}
          {payment && (
            <div className="mt-5 space-y-2 text-sm text-surface-600">
              <p className="text-lg font-bold text-surface-950">{payment.status}</p>
              <p>
                {formatPrice(payment.amount, payment.currency)} online payment
              </p>
              <p>Order: {orderNumber}</p>
              <p>Reference: {payment.providerRef}</p>
              {payment.status === 'SUCCESS' && (
                <div className="space-y-2">
                  <p className="rounded-lg bg-emerald-50 p-3 font-semibold text-emerald-700">
                    Estimated delivery: 25-40 days.
                  </p>
                  <p className="rounded-lg bg-primary-50 p-3 font-medium text-primary-800">
                    Receipt has been sent to your email.
                  </p>
                </div>
              )}
            </div>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {payment?.status === 'SUCCESS' && (
              <button
                type="button"
                onClick={() => {
                  const message = `Hi YurDeals, I want to track order ${orderNumber}.`;
                  const phone = (import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER ?? '').replace(/\D/g, '');
                  window.open(
                    `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
                    '_blank',
                    'noopener,noreferrer',
                  );
                }}
                className="min-h-11 rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700"
              >
                Track this order on WhatsApp
              </button>
            )}
            <Link
              to="/"
              className="min-h-11 rounded-full bg-primary-600 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Continue shopping
            </Link>
            {needsGuestRecovery && (
              <>
                <Link
                  to="/orders/track"
                  className="min-h-11 rounded-full border border-surface-300 px-5 py-3 text-sm font-semibold text-surface-700 hover:border-primary-300 hover:text-primary-700"
                >
                  Check order status
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    const message = `Hi YurDeals, I need help confirming payment for order ${orderNumber}.`;
                    const phone = (import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER ?? '').replace(/\D/g, '');
                    window.open(
                      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
                      '_blank',
                      'noopener,noreferrer',
                    );
                  }}
                  className="min-h-11 rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700"
                >
                  Contact WhatsApp support
                </button>
              </>
            )}
            {payment?.status === 'FAILED' && (
              <>
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 sm:basis-full">
                  Payment wasn't completed. Your reserved items may be released, but you can retry and we'll check availability again.
                </p>
                <Link
                  to="/checkout"
                  className="min-h-11 rounded-full border border-surface-300 px-5 py-3 text-sm font-semibold text-surface-700 hover:border-primary-300 hover:text-primary-700"
                >
                  Retry payment
                </Link>
              </>
            )}
            {orderId && !isGuestReturn && (
              <Link
                to={`/orders/${orderId}/tracking`}
                className="min-h-11 rounded-full border border-surface-300 px-5 py-3 text-sm font-semibold text-surface-700 hover:border-primary-300 hover:text-primary-700"
              >
                View tracking
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
