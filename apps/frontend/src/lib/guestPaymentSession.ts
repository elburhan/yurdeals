// ============================================
// Guest Payment Session Bridge
// ============================================

import type { DeliveryStockType } from './deliveryEstimate';

const GUEST_PAYMENT_SESSION_PREFIX = 'yurdeals_guest_payment';
const GUEST_PAYMENT_SESSION_TTL_MS = 60 * 60 * 1000;

export interface GuestPaymentSession {
  orderId: string;
  paymentId: string;
  guestAccessToken: string;
  deliveryStockType?: DeliveryStockType;
  createdAt: number;
}

export function saveGuestPaymentSession(input: Omit<GuestPaymentSession, 'createdAt'>): void {
  if (typeof window === 'undefined') {
    return;
  }

  const session: GuestPaymentSession = {
    ...input,
    createdAt: Date.now(),
  };

  window.sessionStorage.setItem(
    getGuestPaymentSessionKey(input.orderId, input.paymentId),
    JSON.stringify(session),
  );
}

export function getGuestPaymentSession(orderId: string, paymentId: string): GuestPaymentSession | null {
  if (typeof window === 'undefined' || !orderId || !paymentId) {
    return null;
  }

  const key = getGuestPaymentSessionKey(orderId, paymentId);
  const stored = window.sessionStorage.getItem(key);

  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<GuestPaymentSession>;
    if (
      parsed.orderId !== orderId ||
      parsed.paymentId !== paymentId ||
      typeof parsed.guestAccessToken !== 'string' ||
      !parsed.guestAccessToken ||
      typeof parsed.createdAt !== 'number'
    ) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    if (Date.now() - parsed.createdAt > GUEST_PAYMENT_SESSION_TTL_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return parsed as GuestPaymentSession;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

export function clearGuestPaymentSession(orderId: string, paymentId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(getGuestPaymentSessionKey(orderId, paymentId));
}

function getGuestPaymentSessionKey(orderId: string, paymentId: string): string {
  return `${GUEST_PAYMENT_SESSION_PREFIX}:${orderId}:${paymentId}`;
}
