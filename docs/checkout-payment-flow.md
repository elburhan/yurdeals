# Checkout Payment Flow

This note defines the canonical checkout and payment path for Yurdeals.

## Canonical Flow

Yurdeals uses a two-step checkout flow:

1. Create the order first
2. Initiate payment against that existing order

This is the supported production path for both frontend and backend development.

## Registered User Flow

1. Customer reviews cart and selects a saved address
2. Frontend calls `POST /api/v1/orders`
3. Backend creates an order with status `PENDING`
4. Frontend shows the payment panel for that order
5. Frontend calls `POST /api/v1/orders/:orderId/payments`
6. Backend creates a pending payment record and initializes Paystack
7. Browser redirects to Paystack
8. Callback, webhook, and manual verify paths reconcile the payment
9. Successful payment marks the order `PAID`

## Guest User Flow

1. Customer enters shipping details on checkout
2. Frontend calls `POST /api/v1/orders/guest`
3. Backend creates a guest order with status `PENDING`
4. Backend stores the guest's submitted contact details for payment, tracking, and support, but does not attach the order or address to any pre-existing registered account
5. Backend returns the guest access token required for payment/status access
6. Frontend shows the payment panel for that order
7. Frontend calls `POST /api/v1/orders/:orderId/payments/guest`
8. Backend creates a pending guest payment record and initializes Paystack
9. Browser redirects to Paystack
10. Callback, webhook, and manual verify paths reconcile the payment

## Payment Reconciliation Recovery

If webhook delivery, callback verification, or the customer browser fails, older pending Paystack
payments are recovered by the reconciliation runner. The runner scans pending Paystack payments after
`PAYMENT_RECONCILIATION_THRESHOLD_MINUTES`, calls Paystack transaction verify, and sends the verified
provider result through the same idempotent payment status path used by webhook/callback handling.

Safe recovery events appear in the admin payment timeline:

- `payment.reconciliation_started`
- `payment.reconciliation_verified`
- `payment.reconciliation_failed`
- `payment.reconciliation_released`

Run manually or from a scheduled worker:

```bash
npm run payments:reconcile -w apps/backend
```

To prevent stale inventory holds from lingering after abandoned checkout attempts, also run:

```bash
npm run reservations:expire -w apps/backend
```

Admin-only endpoint:

```http
POST /api/v1/admin/payments/reconcile
```
11. Successful payment marks the order `PAID`

## Paystack Live-Mode Safety

The production Paystack flow must keep these responsibilities separate:

- Browser callback returns the customer from Paystack and may trigger backend verification, but it is not trusted as proof of success.
- Webhook delivery must use the raw request body and a valid `x-paystack-signature`.
- Signed Paystack webhooks still trigger backend transaction verification before state changes.
- Reconciliation is the fallback when callback or webhook delivery is delayed or missed.

Before live mode, run:

```bash
npm run paystack:readiness:check -w apps/backend -- --live
```

Dashboard URLs:

- Callback: `https://api.yourdomain.com/payment-return`
- Webhook: `https://api.yourdomain.com/api/v1/payments/paystack/webhook`

Never manually mark a payment successful from frontend callback data. Use webhook, manual verify, or reconciliation so amount, currency, reference, duplicate event, fraud review, and inventory reservation rules stay intact.

## Ownership Rules

- Authenticated checkout attaches new orders only to the currently authenticated user and one of that user's saved addresses.
- Anonymous guest checkout always creates an isolated guest-owned order/address record, even if the submitted guest email or phone matches an existing registered customer.
- Guest contact details are preserved for payment metadata, guest tracking, support, and transactional email delivery without merging the guest checkout into an existing account.

## Guest Access Token Storage

Guest access tokens are opaque secrets returned once to the frontend after guest order creation.
The backend stores only an HMAC-SHA256 token digest on the order:

- `Order.guestAccessTokenHash`
- `Order.guestAccessTokenExpiresAt`

Raw guest access tokens must not be stored in `Order.notes` or logs. Guest payment initiation,
guest payment status, guest payment verification, and guest WhatsApp checkout all validate the
token through the centralized guest order access helper.

For backward compatibility, old guest orders that were created before dedicated guest access
fields existed may still be validated through the legacy `[guestAccessToken:...]` note tag. This
fallback is temporary and should be removed after legacy guest orders age out.

New guest Paystack callback URLs do not include `guestAccessToken`. Before redirecting to
Paystack, the frontend stores the guest payment token in `sessionStorage` under the order/payment
pair and restores it on `/payment-return` to poll guest payment status. Existing older return URLs
that still contain `guestAccessToken` are supported temporarily as a legacy fallback.

If a guest opens `/payment-return` in a fresh browser or after session storage expires, the page
cannot poll guest payment status directly. Webhook confirmation can still process the payment, and
the user should track with the checkout phone number plus the exact order number or contact WhatsApp support.

## Public Tracking Safety

- Public order tracking requires both the phone number used at checkout and the exact order number.
- Public tracking returns only customer-safe tracking fields such as order number, order status, payment status summary, shipment status summary, ETA, limited item summary, and timeline updates.
- Public tracking does not return full shipping addresses, full itemized order details, totals, internal ids, payment references, or other sensitive customer data.

## Why Order Is Created Before Payment

Yurdeals creates the order before payment so the system has:

- a real local order number before redirecting off-site
- a stable server-side total and item snapshot
- a local record to reconcile webhooks, callback verifies, and support inquiries
- a clean way to support both Paystack and manual WhatsApp checkout against the same order

## Canonical Endpoints

Order creation:

- `POST /api/v1/orders`
- `POST /api/v1/orders/guest`

Payment initiation:

- `POST /api/v1/orders/:orderId/payments`
- `POST /api/v1/orders/:orderId/payments/guest`

Payment status and verification:

- `GET /api/v1/orders/:orderId/payments/:paymentId`
- `GET /api/v1/orders/:orderId/payments/:paymentId/guest`
- `POST /api/v1/orders/:orderId/payments/:paymentId/verify`
- `POST /api/v1/orders/:orderId/payments/:paymentId/guest/verify`

Return and webhooks:

- `GET /payment-return`
- `POST /api/v1/payments/paystack/webhook`
- `POST /api/v1/webhooks/paystack`

## Payment Retry Rules

Yurdeals preserves payment attempt history per order. Retries do not overwrite old attempts.

### Paid Orders

- Orders with a confirmed `SUCCESS` or `AUTHORIZED` payment cannot start another payment
- Orders that have already moved beyond `PENDING` also cannot start another payment

### Failed Payments

- Failed payment attempts can be retried
- A retry creates a brand-new `Payment` row and a brand-new provider reference
- Older failed rows remain in place for audit and reconciliation

### Recent Pending Payments

- If the latest pending payment is still fresh and already has a usable `authorizationUrl`, Yurdeals reuses that existing payment link
- This avoids creating duplicate pending payments for the same order

### Stale Pending Payments

- Pending payments older than 30 minutes are treated as stale
- Stale or unusable pending payments are marked `ABANDONED`
- After that, Yurdeals creates a fresh payment attempt with a new reference

### Pending Without Redirect Link

- If a pending payment exists but has no usable `authorizationUrl`, it is not reused
- That attempt is marked `ABANDONED`, then a fresh payment attempt is created

### Payment Return Pending State

- If the payment-return page stops polling while a payment is still `PENDING`, the UI should guide the user gently instead of implying failure
- Current guidance is: refresh the page or check orders shortly while confirmation completes in the background

## Removed Legacy Endpoint

The old single-call checkout route below is no longer part of the supported flow:

- `POST /api/v1/orders/checkout`

It was removed because the frontend does not use it, and keeping two checkout architectures increases production drift risk.

## Future Hardening Phases

- Add durable guest session recovery for reloads and abandoned returns
- Remove the temporary legacy `guestAccessToken` query fallback
- Improve pending and abandoned payment recovery UX and backend rules
- Tighten order and payment lifecycle state transitions after `PAID`
