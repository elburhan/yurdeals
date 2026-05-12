# Inventory and Preorder Controls

Yurdeals uses a lightweight reservation model for online payment checkout. It hardens scarce stock and preorder slots without introducing preorder campaign automation yet.

## IN_STOCK Products

- `Product.stockType = IN_STOCK` marks a product as local/in-stock.
- If the product has active variants, `ProductVariant.stock` is the source of availability.
- If the product has no variant and `Product.inventoryQuantity` is set, `inventoryQuantity` is used as fallback availability.
- If neither variant stock nor `inventoryQuantity` is set, the product keeps the previous unlimited behavior for now.

Inventory is not decremented when an item is added to cart or when an order is created. It is reserved when a Paystack payment attempt is initialized. A successful payment confirms that reservation instead of decrementing stock again.

## PREORDER Products

- `Product.stockType = PREORDER` marks a product as preorder.
- `preorderStartsAt` blocks preorder before the configured start time.
- `preorderEndsAt` blocks preorder after the configured end time.
- `preorderSlotsRemaining`, when set, limits the quantity that can be added or checked out.
- `estimatedArrivalAt`, when set, is shown to customers as the product-specific estimated arrival date.

Preorder slots are reserved when a Paystack payment attempt is initialized. A successful payment confirms that reservation instead of decrementing slots again.

## Reservation Lifecycle

- One `InventoryReservation` row exists per `OrderItem`.
- Reservation history is recorded through `PaymentEvent` entries.
- Reservation status can be `ACTIVE`, `CONFIRMED`, `RELEASED`, or `EXPIRED`.
- Active reservations expire after 30 minutes, matching the pending payment stale window.
- A valid active reservation is reused when the same payment link is reused.
- An expired, released, or previously expired reservation row can be reactivated on retry if stock or slots are still available.
- Confirmed reservations are never re-reserved.

## Customer Visibility

The checkout payment panel explains that items are held for 30 minutes while the customer completes Paystack payment. The payment-return page keeps the language calm:

- pending confirmation tells the customer the order is saved and items are being held;
- failed payment tells the customer the hold may be released, but retry will check availability again;
- missing guest payment session tells the customer confirmation may still complete automatically and points them to order tracking or WhatsApp support.

Customers do not see raw reservation records or internal reservation event names.

## Admin Visibility

Admin order detail exposes safe reservation summaries separately from the payment event timeline. The reservation section is the current operational view, while `PaymentEvent` remains the audit trail.

Reservation labels:

- `ACTIVE`: Held for payment
- `CONFIRMED`: Confirmed after payment
- `RELEASED`: Released
- `EXPIRED`: Expired

The admin reservation summary includes item/product ids, variant id, stock type, quantity, status, expiry, confirmation, release, creation, and update timestamps. It does not expose guest tokens, provider payloads, authorization URLs, access codes, or secrets.

## Payment-Success Decrement

Payment verification and webhooks can both observe the same Paystack transaction. To avoid duplicate inventory movement:

- reservations are created/reactivated during payment initialization;
- payment success confirms active reservations inside the payment status transition transaction;
- the payment row is updated with a status guard;
- confirmation only runs when the guarded update proves the payment moved from non-success to `SUCCESS`;
- already-successful payments do not confirm again.

If stock or preorder slots are insufficient while creating/reactivating a reservation, the payment initialization fails with a customer-safe availability error. If a payment succeeds without an active reservation, the system records an `inventory.reservation_failed` payment event for manual review.

## Release and Expiry

- Failed payments release active reservations and restore stock/slots.
- Abandoned stale pending payments release active reservations and restore stock/slots.
- Customer order cancellation releases active reservations and restores stock/slots.
- Lazy expiry happens when the customer retries payment: expired active reservations are marked `EXPIRED`, restored, then reactivated if stock/slots remain available.

## Admin Field Meanings

- `Inventory quantity`: fallback quantity for simple in-stock products without variants.
- `Preorder slots total`: total planned preorder capacity.
- `Preorder slots remaining`: remaining customer-facing preorder capacity.
- `Preorder starts`: optional opening time for preorder.
- `Preorder ends`: optional closing time for preorder.
- `Estimated arrival`: optional customer-facing ETA.

## PaymentEvent Audit Entries

Reservation lifecycle events use safe `PaymentEvent` rows:

- `inventory.reservation_created`
- `inventory.reservation_reused`
- `inventory.reservation_reactivated`
- `inventory.reservation_confirmed`
- `inventory.reservation_released`
- `inventory.reservation_expired`
- `inventory.reservation_failed`

## Current Limitations

- No scheduled background expiry job yet.
- `PreorderCampaign` and `PreorderSlot` remain dormant in Phase 1.
- There is no inventory audit ledger yet.
- Admin variant stock management remains a future improvement.

## Phase 2 TODOs

- Add scheduled reservation expiry.
- Activate preorder campaigns and per-user slots if needed.
- Add inventory adjustment history and admin stock operations.
- Add manual payment/inventory reconciliation tools.
