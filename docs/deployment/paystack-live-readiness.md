# Paystack Live Readiness

This guide covers YurDeals Paystack live-mode readiness before switching keys or accepting real payments.

Do not switch to live keys until the checklist is complete. Do not create real transactions while performing config readiness checks.

## Current Protection Audit

The backend already has these production protections:

- Paystack webhook routes receive raw request bodies before JSON parsing.
- Webhook signatures are verified with `x-paystack-signature` and HMAC SHA512 using `PAYSTACK_SECRET_KEY`.
- A signed Paystack webhook is treated as a trigger, not proof of success. The backend calls Paystack transaction verify before changing payment state.
- `/payment-return` callback verification also verifies server-side and does not trust the browser redirect alone.
- Manual user/guest verify and reconciliation reuse the same provider verification path.
- Payment events use deterministic event IDs so duplicate webhook/verification events are ignored safely.
- Final payment states are not downgraded.
- Amount and currency mismatches are recorded and do not transition the payment to success.
- Successful payment confirms inventory reservations and marks the order paid.
- Failed payment releases active reservations when the order is still pending.
- Fraud review can hold fulfillment progression after payment success without blocking payment confirmation.

## Readiness Script

Run the no-network config check before live mode:

```bash
npm run paystack:readiness:check -w apps/backend
```

For a stricter live-mode gate:

```bash
npm run paystack:readiness:check -w apps/backend -- --live
```

The script validates key shape, key mode alignment, callback URL shape, rate-limit values, and reconciliation settings. It does not call Paystack, create payments, switch keys, or print secrets.

## Required Environment Variables

```env
PAYSTACK_SECRET_KEY="sk_live_..."
PAYSTACK_PUBLIC_KEY="pk_live_..."
PAYSTACK_CALLBACK_URL="https://api.yourdomain.com/payment-return"
PAYMENT_RECONCILIATION_THRESHOLD_MINUTES=15
PAYMENT_RECONCILIATION_BATCH_SIZE=50
PAYMENT_RATE_LIMIT_WINDOW_MS=60000
PAYMENT_RATE_LIMIT_MAX_REQUESTS=60
WEBHOOK_RATE_LIMIT_WINDOW_MS=60000
WEBHOOK_RATE_LIMIT_MAX_REQUESTS=600
```

Set live keys in Render only. Do not commit keys or paste them into docs, tickets, screenshots, or chat.

## Paystack Dashboard Setup

In the Paystack dashboard live mode:

1. Confirm business and settlement setup are complete.
2. Copy live secret and public keys.
3. Set callback URL:

```text
https://api.yourdomain.com/payment-return
```

4. Set webhook URL:

```text
https://api.yourdomain.com/api/v1/payments/paystack/webhook
```

5. Confirm webhook delivery is enabled.
6. Confirm the dashboard is in live mode before copying live keys.
7. Keep test keys in non-production environments only.

## Test To Live Transition Sequence

1. Finish staging tests using Paystack test keys.
2. Confirm database backups and Sentry monitoring are ready.
3. Run `npm run paystack:readiness:check -w apps/backend` locally/staging.
4. Add live `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` in Render.
5. Set production `PAYSTACK_CALLBACK_URL`.
6. Confirm Paystack live webhook URL.
7. Redeploy/restart backend.
8. Run backend health check.
9. Create one controlled low-value order.
10. Complete one live payment with an operator-owned card/account.
11. Confirm order/payment/reservation/email/admin timeline.
12. Keep soft launch traffic low while monitoring.

## Callback Vs Webhook Responsibilities

Callback:

- Brings the customer browser back from Paystack.
- Verifies the reference server-side when `orderId`, `paymentId`, and `reference` are present.
- Redirects to the frontend payment-return page.
- Must not be treated as customer-facing proof of payment on its own.

Webhook:

- Is the primary asynchronous provider notification path.
- Must include a valid Paystack signature.
- Must be verified again with Paystack transaction verify.
- Should be idempotent and safe to receive multiple times.

Reconciliation:

- Recovers older pending payments when callback/webhook is delayed or missed.
- Calls Paystack transaction verify.
- Writes payment events for auditability.

## Idempotency And Duplicate Handling

YurDeals stores each provider event in `payment_events`.

- Paystack event IDs are deterministic from event type and transaction ID/reference.
- Duplicate `eventId` records are ignored.
- Payment updates guard on previous status in a transaction.
- `SUCCESS`, `FAILED`, `ABANDONED`, and `REFUNDED` are final states and are not downgraded.
- Payment success notification and fulfillment transition only run when status actually changes.

## Pending Payment Recovery

If a customer says they were debited but the order is still pending:

1. Open the admin order detail panel.
2. Check the latest payment attempt and reference.
3. Check payment event timeline for webhook, callback, manual verify, or reconciliation events.
4. Confirm whether Paystack dashboard shows success for the same reference.
5. Run protected admin reconciliation or the scheduled command:

```bash
npm run payments:reconcile -w apps/backend
```

6. Re-check the timeline.
7. If Paystack verify still returns pending/failed, do not manually mark paid; escalate with order number, payment ID, and Paystack reference.

## Guest Payment Recovery

Guest payment status requires the guest access token. If the customer loses the browser session:

- Webhook and reconciliation can still update the backend payment state.
- The customer can use public tracking with checkout phone number and exact order number.
- Support can inspect admin order details and Paystack reference.
- Do not expose guest access tokens or full payment references in public tracking responses.

## Fraud Review Interaction

Successful payment can still leave `holdForManualReview=true`.

- Payment state and inventory confirmation remain correct.
- Automatic fulfillment transition is skipped while the hold is active.
- Ops must review risk flags and clear the hold before fulfillment progression.
- Do not refund or alter payment state solely because fraud review is pending.

## Inventory Reservation Interaction

- Payment initialization reserves local stock/preorder capacity.
- Reusing a fresh pending payment refreshes the same held intent.
- Stale pending attempts are marked `ABANDONED` and their reservations are released.
- Failed payment releases active reservations when the order remains pending.
- Successful payment confirms reservations.
- Reservation expiry cron should continue running during normal operations.

## Webhook Delivery Validation

After the first controlled live payment:

1. Confirm Paystack dashboard shows a delivered webhook.
2. Confirm backend logs show `Payment webhook processed`.
3. Confirm admin timeline shows a Paystack event with amount/currency matched.
4. Confirm duplicate webhook delivery does not duplicate customer email or fulfillment transition.
5. Confirm payment-confirmed email arrives once.

## Safe Replay And Reconciliation

Use backend reconciliation instead of manually editing payment rows.

Safe options:

- customer/manual verify endpoint,
- guest verify endpoint with guest token,
- admin reconciliation endpoint,
- `npm run payments:reconcile -w apps/backend`.

Do not:

- manually set `payments.status='SUCCESS'`,
- insert fake payment events,
- disable webhook signature verification,
- replay raw webhooks with edited payloads,
- mark paid from the frontend callback alone.

## Rollback If Live Rollout Fails

If live payment initialization fails:

1. Pause checkout traffic if possible.
2. Keep existing pending orders intact.
3. Inspect Render logs, Sentry, and Paystack dashboard errors.
4. Check key mode alignment and callback URL.
5. Roll back the application deploy only if code changed.
6. If the issue is credentials/config, fix Render env and restart.

If customers were debited:

1. Do not switch back and forth blindly between test/live keys.
2. Use Paystack dashboard references as source of provider truth.
3. Run reconciliation after the backend is healthy.
4. Escalate unmatched debits with Paystack support.
5. Keep support informed with order numbers and expected resolution path.

## Final Live Readiness Checklist

- `PAYSTACK_SECRET_KEY` starts with `sk_live_`.
- `PAYSTACK_PUBLIC_KEY` starts with `pk_live_`.
- Live secret/public modes match.
- `PAYSTACK_CALLBACK_URL` is `https://api.yourdomain.com/payment-return`.
- Paystack live webhook URL is `https://api.yourdomain.com/api/v1/payments/paystack/webhook`.
- `npm run paystack:readiness:check -w apps/backend -- --live` passes.
- Reconciliation cron is scheduled every 5-10 minutes.
- Reservation expiry cron is scheduled every 5-10 minutes.
- Admin payment timeline is visible to ops.
- Sentry and Render logs are monitored during first live payment.
- One controlled low-value live payment is completed before public launch.
