# Resend Production Guide

This guide covers production Resend setup for YurDeals transactional email. The application sends through the Resend HTTPS API; no Resend SDK is required for the current backend implementation.

## Production Sender Policy

Use these production values unless there is a deliberate support or domain change:

```bash
EMAIL_ENABLED=true
EMAIL_FROM="YurDeals <orders@yurdeals.com>"
EMAIL_REPLY_TO="support@yurdeals.com"
```

`RESEND_API_KEY` must be stored in Render only. Do not commit it, paste it into docs, or print it in logs.

## Resend Dashboard Setup

1. Open the Resend dashboard.
2. Go to Domains.
3. Add `yurdeals.com`.
4. Copy every DNS record Resend provides.
5. Add the DNS records at the DNS host for `yurdeals.com`.
6. Wait for Resend to show the domain as verified.
7. Confirm SPF verification passes.
8. Confirm DKIM verification passes.
9. Confirm DMARC exists for the domain. Use a monitored reporting address if DMARC reporting is enabled.
10. Create a production API key with email send permission.
11. Store the API key in Render as `RESEND_API_KEY`.
12. Set `EMAIL_FROM="YurDeals <orders@yurdeals.com>"` in Render.
13. Set `EMAIL_REPLY_TO="support@yurdeals.com"` in Render.
14. Set `EMAIL_ENABLED=true` in Render only after the domain and sender are verified.
15. Redeploy or restart the backend so the new environment values are loaded.

Do not use `onboarding@resend.dev` in production. That sender is only for early sandbox testing.

## Required Environment Variables

- `EMAIL_ENABLED=true`
- `RESEND_API_KEY` set in Render only
- `EMAIL_FROM="YurDeals <orders@yurdeals.com>"`
- `EMAIL_REPLY_TO="support@yurdeals.com"`

Run the no-network readiness check before live testing:

```bash
npm run email:readiness:check -w apps/backend
```

For a stricter launch gate that fails when email is disabled or incomplete:

```bash
npm run email:readiness:check -w apps/backend -- --strict
```

The readiness check validates config shape only. It does not call Resend and does not send emails.

## Implemented Notification Flows

- OTP verification email for signup and resend flows.
- Order created / preorder received email after order creation.
- Payment confirmed email after payment success.

Production behavior:

- OTP email fails safely if email is not configured or delivery fails in production.
- Order-created and payment-confirmed emails are non-blocking; failures are logged without breaking checkout or payment confirmation.
- Internal placeholder recipients ending in `.local` are skipped.
- Normal logs must never include raw OTP values, API keys, provider payloads, or full sensitive customer data.

## Production Test Procedure

Run the template and readiness checks first:

```bash
npm run email:templates:check -w apps/backend
npm run email:readiness:check -w apps/backend
```

Then test with controlled real inboxes only.

### OTP Email

1. Confirm Render has `EMAIL_ENABLED=true`.
2. Register with a real inbox controlled by the team.
3. Complete email verification.
4. Confirm the OTP email arrives.
5. Confirm the OTP works.
6. Confirm backend logs show masked recipient data and no raw OTP.

### Order-Created Email

1. Create a guest or authenticated checkout using a real team-controlled inbox.
2. Submit the order.
3. Confirm the order-created email arrives.
4. Confirm the subject includes the order number.
5. Confirm the body includes item summary, total, and next-step copy.

### Payment-Confirmed Email

1. Complete a controlled Paystack test payment or a production-safe live payment.
2. Wait for callback and webhook processing.
3. Confirm the payment-confirmed email arrives once.
4. Confirm duplicate callback/webhook processing does not send duplicate customer emails.

## Troubleshooting

- No email: check `EMAIL_ENABLED`, `RESEND_API_KEY`, and Resend domain verification.
- Email rejected: confirm `EMAIL_FROM` uses `orders@yurdeals.com` or another verified sender on `yurdeals.com`.
- Customer replies lost: confirm `EMAIL_REPLY_TO` routes to a monitored support inbox.
- OTP request fails: confirm email is configured and Resend accepts the sender.
- Order/payment email missing but checkout/payment succeeded: check masked backend logs and recipient deliverability.
- Duplicate payment email: inspect notification event keys, Resend idempotency key, and payment event timeline.

## Safety Notes

- Do not send real launch tests until Resend domain verification is complete.
- Do not send to customer inboxes during readiness testing.
- Do not log OTP codes in production.
- Do not send to placeholder `.local` addresses.
- Rotate `RESEND_API_KEY` immediately if exposed.
