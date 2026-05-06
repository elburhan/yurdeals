import { useState } from 'react';
import type { OrderSummary } from '@yurdeals/shared';
import { formatPrice } from './ProductCard';
import { useAuth } from '../hooks/useAuth';
import { initiateGuestPayment, initiatePayment } from '../lib/paymentApi';
import { markGuestWhatsappCheckout, markWhatsappCheckout } from '../lib/orderApi';
import { buildWhatsappCheckoutUrl } from '../lib/whatsappCheckout';
import { useToast } from '../context/ToastContext';

interface PaymentPanelProps {
  order: OrderSummary;
  guestAccessToken?: string;
  isGuestCheckout?: boolean;
}

const WHATSAPP_RESPONSE_TIME_NOTE = "We'll respond in under 10 minutes during business hours.";

export function PaymentPanel({ order, guestAccessToken, isGuestCheckout = false }: PaymentPanelProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isStartingPayment, setIsStartingPayment] = useState(false);
  const [error, setError] = useState('');

  async function handlePay() {
    setIsStartingPayment(true);
    setError('');

    try {
      let response;
      if (isGuestCheckout) {
        if (!guestAccessToken) {
          const message = 'Guest checkout session is missing. Please place the order again.';
          setError(message);
          showToast(message, 'error');
          return;
        }
        response = await initiateGuestPayment(order.id, guestAccessToken);
      } else {
        response = await initiatePayment(order.id);
      }
      window.location.assign(response.data.authorizationUrl);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to start payment';
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsStartingPayment(false);
    }
  }

  async function handleWhatsappCheckout() {
    setError('');
    const whatsappNumber = import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER;

    if (!whatsappNumber) {
      const message = 'WhatsApp checkout is not configured yet. Please choose secure online payment.';
      setError(message);
      showToast(message, 'error');
      return;
    }

    try {
      if (guestAccessToken) {
        await markGuestWhatsappCheckout(order.id, guestAccessToken);
      } else {
        await markWhatsappCheckout(order.id);
      }
      window.location.assign(buildWhatsappCheckoutUrl(order, user));
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'Unable to start WhatsApp checkout';
      setError(message);
      showToast(message, 'error');
    }
  }

  return (
    <section className="rounded-2xl border border-primary-200 bg-primary-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-primary-950">Payment</h2>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-primary-700">
          Paystack
        </span>
      </div>
      <p className="mt-1 text-sm text-primary-800">
        Order {order.orderNumber} is ready for payment. Total:{' '}
        {formatPrice(order.total, order.currency)}
      </p>
      <div className="mt-4 rounded-lg bg-white/80 p-3 text-sm leading-6 text-primary-900">
        <p>Secure online payments via Paystack.</p>
        <p>Your payment is safe. We only release funds to the supplier after quality inspection in China.</p>
        <p>100% Nigerian support via WhatsApp.</p>
      </div>

      {error && (
        <div
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={isStartingPayment}
        onClick={() => void handlePay()}
        className="mt-4 min-h-[52px] w-full rounded-full bg-primary-500 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-primary-600 active:bg-primary-700 disabled:cursor-not-allowed disabled:bg-surface-300"
      >
        {isStartingPayment ? 'Redirecting...' : 'Pay online'}
      </button>

      <div className="mt-4 rounded-lg border border-green-200 bg-white p-4">
        <h3 className="font-semibold text-surface-950">Prefer manual payment?</h3>
        <p className="mt-1 text-sm text-surface-600">
          Send this order to our support team on WhatsApp and complete payment manually.
        </p>
        <button
          type="button"
          onClick={() => void handleWhatsappCheckout()}
          className="mt-3 min-h-[52px] w-full rounded-full bg-green-600 px-5 py-3 text-base font-semibold text-white hover:bg-green-700"
        >
          Complete via WhatsApp
        </button>
        <p className="mt-2 text-xs text-surface-500">{WHATSAPP_RESPONSE_TIME_NOTE}</p>
      </div>

      <div className="mt-4 space-y-1 text-sm text-primary-800">
        <p>No card details are stored by YurDeals.</p>
        <p>Payments are verified by secure provider webhooks.</p>
      </div>
    </section>
  );
}
