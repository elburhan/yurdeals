import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { PaymentSummary } from '@yurdeals/shared';
import { CustomerNav } from '../components/CustomerNav';
import { TrustBanner } from '../components/TrustBanner';
import { getGuestPaymentStatus, getPaymentStatus } from '../lib/paymentApi';
import { formatPrice } from '../components/ProductCard';

export default function PaymentReturnPage() {
  return <PaymentReturnContent />;
}

function PaymentReturnContent() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') ?? '';
  const paymentId = searchParams.get('paymentId') ?? '';
  const guestAccessToken = searchParams.get('guestAccessToken') ?? '';
  const orderNumber = searchParams.get('orderNumber') ?? orderId;
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [error, setError] = useState('');
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    if (!orderId || !paymentId) {
      setError('Payment return details are missing.');
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
  }, [orderId, paymentId, guestAccessToken]);

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
          {isPolling && <p className="mt-3 text-sm text-surface-500">Checking payment status...</p>}
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
                {formatPrice(payment.amount, payment.currency)} via {payment.provider}
              </p>
              <p>Order: {orderNumber}</p>
              <p>Reference: {payment.providerRef}</p>
              {payment.status === 'SUCCESS' && (
                <p className="rounded-lg bg-emerald-50 p-3 font-semibold text-emerald-700">
                  Estimated delivery: 25-40 days.
                </p>
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
            {payment?.status === 'FAILED' && (
              <Link
                to="/checkout"
                className="min-h-11 rounded-full border border-surface-300 px-5 py-3 text-sm font-semibold text-surface-700 hover:border-primary-300 hover:text-primary-700"
              >
                Retry payment
              </Link>
            )}
            {orderId && !guestAccessToken && (
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
