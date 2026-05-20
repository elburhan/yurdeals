# Fraud Risk Operations

YurDeals Phase 1 fraud hardening adds lightweight order risk scoring without changing checkout architecture, payment provider logic, or inventory reservation integrity.

## Customer Experience Principles

- Legitimate customers should be able to create orders, complete payment, and see calm status updates without fraud language.
- Risk handling is primarily an internal operations and fulfillment control.
- Low-risk and medium-risk orders must not be blocked from checkout or payment.
- High-risk orders may still be paid successfully, but fulfillment progression stays paused until ops completes review.
- Customer-facing wording should stay neutral:
  - `Order received`
  - `Payment confirmed`
  - `Preparing your order`
  - `We may contact you if we need additional confirmation before dispatch`

## What the Risk Layer Does

Orders now store:

- `riskLevel`: `LOW`, `MEDIUM`, or `HIGH`
- `riskFlags`: array of internal fraud/risk flags
- `riskReviewedAt`
- `riskReviewedBy`
- `holdForManualReview`
- `fraudNotes`

Risk scoring runs during:

1. order creation
2. payment initiation
3. successful payment verification/webhook handling
4. failed payment verification/webhook handling

## Current Phase 1 Signals

The service can raise risk based on:

- elevated or high order total
- high-value guest checkout
- multiple failed or abandoned payment attempts
- excessive payment retry attempts
- suspicious preorder quantity spikes
- repeated order creation from the same IP in a short window
- disposable-looking email domains
- payment currency mismatch if observed
- non-standard delivery country if present

These checks are heuristic only. They do not replace human review.

## Current Threshold Baseline

The scoring model now uses env-backed thresholds instead of service hardcodes.

- `LOW`: below `RISK_MEDIUM_ORDER_TOTAL_NGN` (default `150000`)
- `MEDIUM`: from `RISK_MEDIUM_ORDER_TOTAL_NGN` up to `RISK_HIGH_ORDER_TOTAL_NGN - 1` (default `150000` to `349999`)
- `HIGH`: at or above `RISK_HIGH_ORDER_TOTAL_NGN` (default `350000+`)

Additive signals can raise risk above the amount band:

- guest checkout above the elevated guest threshold
- disposable email domain
- repeated failed or abandoned payment attempts
- suspicious retry velocity
- unusual preorder quantity spikes
- repeated order creation from the same IP
- currency mismatch or unusual delivery-country signals

The operational defaults are tuned to avoid promoting low-value legitimate orders straight to high-risk on light retry behavior alone.

## Fulfillment Safety Rule

High-risk orders can still:

- be created
- initialize payment
- complete payment
- keep correct reservation and payment state

But when `holdForManualReview=true`, the order must not auto-advance into fulfillment events.

This means:

- payment can still verify successfully
- the order can still be marked `PAID`
- automatic fulfillment transition/logging is skipped
- admin must review and clear the hold before moving the order to fulfillment statuses

This is intentionally an internal fulfillment brake, not a public checkout interruption.

## Admin Review Workflow

In admin order detail:

1. Review the risk badge and flags.
2. Check payment attempts and payment events.
3. Compare order total, customer details, and retry behavior.
4. Add notes in `fraudNotes`.
5. Leave `holdForManualReview` enabled if the order still looks suspicious.
6. Clear the hold only after support or ops is satisfied the order is safe.
7. After clearing the hold, move the order forward manually if appropriate.

## When Staff Should Contact The Customer

Support or ops should reach out only when there is a concrete operational need, for example:

- payment was confirmed but contact details need reconfirmation before dispatch
- the delivery address looks incomplete or conflicting
- repeated payment behavior suggests the customer may need help finishing checkout
- preorder quantities or item combinations look unusual enough to warrant a human check

Use calm wording. Do not accuse the customer of fraud. Focus on confirming payment, delivery details, or order intent.

## Important Guardrails

- Do not mark a risky order as shipped while the hold is active.
- Do not change payment provider data manually from the admin panel.
- Do not release inventory reservations manually; reservation integrity remains tied to payment state.
- Do not expose fraud flags or internal heuristics to customers.
- Do not interrupt a successful payment solely to surface internal review status.

## What This Phase Does Not Do

This phase does not add:

- third-party fraud SDKs
- KYC or identity document collection
- biometric checks
- automatic payment blocking for medium-risk orders
- card fingerprinting
- device fingerprint persistence
- external blacklist feeds

## Recommended Future Improvements

- per-category or preorder-only threshold overrides
- IP reputation and ASN heuristics
- card BIN and issuer-country signals if provider metadata allows it
- velocity checks across phone, email, and address clusters
- dedicated fraud-review queue filters in admin orders list
- manual approve/release audit events separate from notes
