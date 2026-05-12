# Admin Payment Operations

This guide is for support and operations checks when a customer asks about an order payment.

## Where to inspect

1. Open the admin dashboard.
2. Go to the Orders tab.
3. Find the order by order number, customer email, or payment reference.
4. Select **View details**.

The detail panel is visibility-only. It does not change payment state, retry payments, or reconcile provider data.

## What the detail panel shows

- Order summary: status, inspection status, checkout method, customer type, payment reference, and timestamps.
- Customer and delivery: customer name, email, phone, delivery phone, and delivery address.
- Items: product names, variants when present, quantities, unit prices, line totals, and inspection flags.
- Inventory reservations: current item holds created when Paystack payment is initialized.
- Payment attempts: every recorded payment attempt for the order.
- Payment and webhook timeline: safe summaries of payment events received by the backend.

## Inventory reservations

Reservations are the current operational view of whether stock or preorder slots are held for the order. The payment event timeline remains the audit trail of how that state changed.

Status labels:

- `ACTIVE` / Held for payment: items are currently held while the customer completes payment.
- `CONFIRMED` / Confirmed after payment: payment succeeded and the hold is now final.
- `RELEASED` / Released: the hold was restored after failed, abandoned, or cancelled payment.
- `EXPIRED` / Expired: the previous hold expired before a retry refreshed availability.

Useful support fields:

- Quantity held: units reserved for the order item.
- Stock type: `IN_STOCK` or `PREORDER`.
- Expires: when an active hold stops being reusable.
- Confirmed: when payment success confirmed the reservation.
- Released: when the hold was restored to availability.

If there is no reservation, payment has usually not been initialized yet. If a payment is `SUCCESS` but reservation status is missing or failed in the timeline, escalate to engineering for manual review.

## Payment attempt fields

- `PENDING`: payment was initialized or is waiting for confirmation.
- `SUCCESS`: payment has been confirmed by backend verification/webhook handling.
- `FAILED`: provider or verification marked the attempt failed.
- `ABANDONED`: an older pending attempt was replaced after it became stale.
- `REFUNDED`: payment was refunded if refund support is added later.

Useful support fields:

- Reference: the local/provider reference used to identify the transaction.
- Provider ref: the reference returned by the provider when available.
- Provider transaction: the provider transaction ID when available.
- Gateway response: a short safe status/message summary.
- Verified: when the backend last verified the payment.
- Paid: when the provider/backend marked payment as paid.
- Has checkout URL: confirms a Paystack authorization URL was created without exposing the URL itself.

## Payment and webhook timeline

The timeline shows webhook and verification events newest-first. It intentionally hides raw provider payloads, access codes, authorization codes, customer secrets, and full checkout URLs.

Check:

- whether a webhook arrived,
- whether amount and currency matched,
- whether the event status is `SUCCESS`, `FAILED`, `PENDING`, or `ABANDONED`,
- whether the provider transaction ID is present.

## When a customer says “I paid but it still says pending”

1. Confirm the order exists and the customer phone/email matches.
2. Open **View details**.
3. Check Payment attempts:
   - If there is no payment attempt, the customer likely did not start Paystack payment from this order.
   - If there is a recent `PENDING` attempt, ask the customer to wait briefly while Paystack/webhook confirmation completes.
   - If there is a `SUCCESS` attempt but the order is not progressing, escalate to engineering.
   - If the latest attempt is `FAILED` or `ABANDONED`, ask the customer to retry payment or use WhatsApp support.
4. Check Inventory reservations:
   - `ACTIVE` means the item is still held for payment.
   - `CONFIRMED` means inventory/preorder capacity was secured after payment.
   - `RELEASED` or `EXPIRED` means retry will need to check availability again.
5. Check the timeline:
   - If no webhook event exists, Paystack may not have sent the webhook yet, or the customer may not have completed payment.
   - If amount/currency mismatch appears, escalate to engineering.
   - Reservation events such as `inventory.reservation_created`, `inventory.reservation_confirmed`, `inventory.reservation_released`, and `inventory.reservation_failed` explain inventory movement.
6. Do not manually mark payment as paid from this panel. Manual reconciliation is intentionally not implemented in this phase.

## Security notes

The admin detail response must not expose:

- full Paystack authorization URLs,
- access codes,
- authorization codes,
- raw provider payloads,
- guest access tokens,
- secrets or card data.
