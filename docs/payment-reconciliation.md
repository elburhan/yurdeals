# Payment Reconciliation and Recovery

YurDeals treats Paystack webhook, payment return callback, manual verify, and reconciliation as
separate triggers for the same idempotent confirmation path.

## What the Reconciliation Runner Does

The runner scans Paystack payments that are still `PENDING` or `AUTHORIZED`, belong to `PENDING`
orders, and are older than `PAYMENT_RECONCILIATION_THRESHOLD_MINUTES` minutes.

For each candidate it:

1. records `payment.reconciliation_started`;
2. calls Paystack transaction verify using the stored provider reference;
3. sends the verified provider event through the existing payment processing path;
4. records `payment.reconciliation_verified`, `payment.reconciliation_failed`, or
   `payment.reconciliation_released`.

It does not trust local UI state or a customer redirect. Paystack verification remains the source
for recovery.

## Idempotency and Inventory Safety

Reconciliation reuses the same transactional code path as webhook/callback verification:

- `PaymentEvent.eventId` dedupes repeated Paystack verify/webhook events.
- final payment statuses are not downgraded.
- payment state changes use guarded updates from the previous status.
- inventory reservations confirm only when payment first transitions to `SUCCESS`.
- active reservations release only on failed/abandoned payments.
- confirmed reservations are not released.

This means webhook, callback, manual verify, and reconciliation can overlap without double-confirming
payments or double-moving stock.

## How Often to Run

Recommended launch setting:

- `PAYMENT_RECONCILIATION_THRESHOLD_MINUTES=15`
- `PAYMENT_RECONCILIATION_BATCH_SIZE=50`
- run every 5-10 minutes from a Render cron job or scheduled worker.

Command:

```bash
npm run payments:reconcile -w apps/backend
```

Admin-only manual endpoint:

```http
POST /api/v1/admin/payments/reconcile
```

Use the endpoint only from an authenticated admin session.

## Investigating “I Was Debited”

1. Open the order in the admin dashboard.
2. Check Payment attempts:
   - confirm the Paystack reference;
   - confirm whether the latest attempt is `PENDING`, `SUCCESS`, `FAILED`, or `ABANDONED`.
3. Check Payment and webhook timeline:
   - `payment.reconciliation_started` means the recovery runner inspected it;
   - `payment.reconciliation_verified` means Paystack verify returned a result;
   - `transaction.verify` is the provider verify event;
   - `payment.reconciliation_released` means Paystack did not confirm payment success and the
     active hold was released.
4. Check Inventory reservations:
   - `CONFIRMED` means stock/slots were secured after successful payment;
   - `RELEASED` or `EXPIRED` means the payment did not complete successfully in time.

If the customer has proof of debit but Paystack verify still returns pending or failed, escalate with
the Paystack reference and order number. Do not manually mark an order paid without provider
confirmation.

## Failure Modes

- Paystack timeout or 5xx: the runner records `payment.reconciliation_failed` and tries again on the
  next run.
- Missing provider reference: the runner records a safe failure event and skips the payment.
- Already-successful payment: skipped by the candidate query and guarded again by payment processing.
- Duplicate webhook/callback/reconciliation: provider event IDs and guarded status transitions prevent
  duplicate confirmation.
