# Pre-Production Dry Run

This checklist is the final operational rehearsal for YurDeals before go-live. It is designed to
verify the full customer, guest, payment, reservation, tracking, fraud-review, and admin lifecycle
without redesigning any system behavior.

Use this document together with:

- [`docs/checkout-payment-flow.md`](C:/Users/Burhan/Desktop/yurdeals.com/docs/checkout-payment-flow.md)
- [`docs/payment-reconciliation.md`](C:/Users/Burhan/Desktop/yurdeals.com/docs/payment-reconciliation.md)
- [`docs/inventory-preorder-controls.md`](C:/Users/Burhan/Desktop/yurdeals.com/docs/inventory-preorder-controls.md)
- [`docs/fraud-risk-operations.md`](C:/Users/Burhan/Desktop/yurdeals.com/docs/fraud-risk-operations.md)
- [`docs/production-security-checklist.md`](C:/Users/Burhan/Desktop/yurdeals.com/docs/production-security-checklist.md)

## Release Goal

Confirm that:

- legitimate customers can register, verify, browse, check out, and pay without confusing friction;
- guest checkout remains isolated from registered accounts;
- payment success, failure, callback, webhook, and reconciliation stay consistent;
- inventory reservations do not become orphaned;
- public tracking remains useful without leaking sensitive order data;
- fraud controls stay internal and do not disrupt valid payment confirmation;
- admin can safely review, reconcile, track, and progress orders.

## Required Environment Before Dry Run

- Production-like backend env values are loaded from sanitized secrets.
- `FRONTEND_URL` points to the deployed frontend origin.
- `CORS_ORIGIN` contains only expected frontend origins.
- Paystack live or test mode is intentionally selected and documented for the dry run date.
- Email sending is enabled only if the team is prepared to receive real transactional mail.
- Database migrations are applied.
- The following operational jobs are available:
  - `npm run payments:reconcile -w apps/backend`
  - `npm run reservations:expire -w apps/backend`

Recommended launch scheduler:

- payment reconciliation every `5-10` minutes
- reservation expiry every `5-10` minutes

## Build and Verification Gate

Run before manual QA:

```bash
npm run build:shared
npm run build:backend
npm run build:frontend
npm run lint
```

If local services are running, also run:

```bash
npx playwright test tests/auth-otp.spec.ts
npx playwright test tests/guest-payment-access.spec.ts
npx playwright test tests/fraud-risk.spec.ts
```

## Customer Flow Checklist

### Auth and OTP

- Register a new account from the storefront.
- Confirm the user is routed into OTP verification.
- Verify the account using the OTP flow.
- Confirm successful post-verification redirect behavior.
- Sign in and confirm the session is cookie-based.
- Refresh the browser and confirm the customer remains signed in without localStorage token usage.

Pass condition:

- customer can register and sign in normally;
- no debug-only route is required in production;
- no access token appears in browser localStorage.

### Browsing and Product UX

- Browse home, category, and product detail pages on desktop and mobile widths.
- Confirm preorder products show calm batch/ETA messaging only where relevant.
- Confirm no internal pricing-protection or fraud fields are exposed publicly.
- Confirm customer-facing payment wording stays provider-agnostic and trust-oriented.

Pass condition:

- no broken layout, clipped CTAs, or alarming payment/fraud wording;
- no internal supplier, FX, risk, or admin metadata appears publicly.

### Authenticated Checkout

- Add an in-stock item to cart.
- Add a preorder item to cart if available.
- Complete checkout with a saved or new structured Nigerian address.
- Initiate online payment.
- Confirm payment-return page handles success, pending, and failed states clearly.
- Confirm order appears in authenticated order history.
- Confirm authenticated tracking page works for the real owner.

Pass condition:

- order is created once;
- payment attempt is reusable only while still fresh;
- reservation becomes `ACTIVE` on payment init and `CONFIRMED` on payment success.

## Guest Flow Checklist

### Guest Checkout Isolation

- Create a registered user with email `X`.
- Complete guest checkout with the same email `X`.
- Confirm the guest order creates a separate shadow owner.
- Confirm the registered account does not receive the guest order, address, or notification.

Pass condition:

- guest records remain isolated even when email or phone overlaps with a real customer.

### Guest Payment and Recovery

- Initiate guest payment and confirm a guest access token is required for guest payment status.
- Confirm the callback URL does not expose the guest access token.
- Retry guest payment from the recovery flow if the first attempt fails or remains pending.
- Confirm guest public tracking works with phone number and order number together.
- Confirm phone-only public tracking fails validation.

Pass condition:

- guest payment access remains scoped by guest token;
- public tracking reveals only the sanitized payload.

## Payment and Reconciliation Checklist

- Verify a successful payment marks the order as paid once.
- Verify a failed payment keeps the order pending and releases any active reservation.
- Confirm webhook, callback, and manual verify can overlap without duplicate confirmation.
- Run `npm run payments:reconcile -w apps/backend` against a stale pending test payment.
- Confirm reconciliation records timeline events and converges the payment state safely.

Pass condition:

- no double-payment success;
- no silent payment mismatch;
- no stuck stale pending payments after reconciliation.

## Reservation and Inventory Checklist

- Start payment for a scarce in-stock or preorder item and confirm reservation creation.
- Allow one test payment attempt to go stale.
- Run `npm run reservations:expire -w apps/backend`.
- Confirm expired reservations restore stock or preorder slots.
- Confirm a fresh retry can reserve again if stock is still available.

Pass condition:

- no orphaned active reservations remain after scheduled cleanup;
- reservation release/expiry does not corrupt product availability.

## Fraud Review Checklist

- Place a normal low-value authenticated order and confirm no customer-facing friction appears.
- Place a high-value guest preorder using a disposable-looking email.
- Confirm the order is flagged internally and can remain paid while held for review.
- Confirm the customer still sees calm success messaging rather than fraud language.
- In admin, clear the hold and add review notes.
- Confirm fulfillment progression remains blocked until review is cleared.

Pass condition:

- fraud controls protect operations without interrupting legitimate payment confirmation UX.

## Admin Operations Checklist

### Order Visibility

- Open the admin dashboard.
- Confirm order list shows customer type, payment state, reservation state, and risk badges.
- Open a guest order detail and confirm guest orders still display correctly.
- Confirm no sensitive provider secrets, guest tokens, or raw authorization URLs are shown.

### Safe Admin Actions

- Update order status on a normal order.
- Attempt fulfillment progression on an order still held for review and confirm it is blocked.
- Use the admin risk-review control to clear the hold and persist fraud notes.
- Run admin payment reconciliation for a stale pending order if needed.

Pass condition:

- admin can operate safely without dangerous one-click actions that bypass review or payment truth.

## Tracking and Customer Communication Checklist

- Confirm authenticated tracking still shows the full owner-safe tracking view.
- Confirm public tracking requires both phone and order number.
- Confirm public tracking does not expose:
  - internal ids
  - full shipping address
  - full item detail objects
  - totals
  - payment references
- Confirm payment and order emails go to the guest-provided email when the order is guest-owned.

Pass condition:

- customer communication remains useful and calm without leaking sensitive data.

## Mobile QA Checklist

- Test home, PDP, cart, checkout, payment return, order tracking, and admin sign-in at a narrow viewport.
- Confirm tap targets remain usable.
- Confirm the nav, cart summary, payment CTA, and tracking form remain readable.
- Confirm no key checkout buttons fall below the fold without clear scrolling cues.

Pass condition:

- no obvious mobile blockers for the highest-traffic flows.

## Current Release Risks To Watch

These should be explicitly signed off before launch:

1. Scheduler wiring
   The codebase now includes both reconciliation and reservation-expiry scripts, but production still
   needs cron or worker scheduling configured.

2. Manual operations dependence
   Payment recovery and risk review are safe, but they still rely on the admin team following the
   documented playbook consistently.

3. End-to-end browser coverage gaps
   Automated coverage exists for OTP, guest payment access, and fraud review smoke, but there is
   still no full browser-admin lifecycle suite covering every production role and mobile viewport.

## Go / No-Go Signoff

Mark go-live only when all of the following are true:

- builds and lint pass;
- required Playwright checks pass or have documented environment-based skips;
- payment reconciliation scheduling is configured;
- reservation expiry scheduling is configured;
- guest isolation and public tracking hardening are verified;
- fraud review hold and release path are verified;
- admin team has completed one manual dry-run using this checklist.
