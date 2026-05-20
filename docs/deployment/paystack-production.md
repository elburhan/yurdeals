# Paystack Production Guide

This guide maps Paystack production setup to YurDeals payment architecture.

## Test vs Live Mode

- Use `sk_test_*` and `pk_test_*` only in development or staging.
- Use `sk_live_*` and `pk_live_*` only in production.
- Rotate any keys that were pasted into chats, screenshots, or local files shared outside the secret store.

## Required Environment Variables

- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_CALLBACK_URL`

Production example:

```bash
PAYSTACK_CALLBACK_URL="https://api.yourdomain.com/payment-return"
```

The callback URL must point to the backend, not the frontend. The backend verifies the payment and redirects the browser to `FRONTEND_URL`.

## Dashboard Configuration

In Paystack dashboard:

- Callback URL: `https://api.yourdomain.com/payment-return`
- Webhook URL: `https://api.yourdomain.com/api/v1/payments/paystack/webhook`

Keep webhook signature verification enabled. YurDeals verifies Paystack signatures using `x-paystack-signature` and the configured secret key.

## Safe Live Payment Verification

1. Confirm production database backup exists.
2. Confirm `NODE_ENV=production`.
3. Confirm `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` are live keys.
4. Create a low-value product or use a controlled low-value checkout.
5. Complete one live payment.
6. Verify:
   - order becomes confirmed
   - payment is `SUCCESS`
   - payment event timeline records callback/webhook activity
   - payment confirmed email sends
   - inventory reservation is confirmed

## Troubleshooting

Webhook not firing:

- Confirm dashboard webhook URL is backend `/api/v1/payments/paystack/webhook`.
- Confirm the backend service is public HTTPS.
- Check webhook rate limits and backend logs.

Callback mismatch:

- Confirm Paystack dashboard callback equals `PAYSTACK_CALLBACK_URL`.
- Confirm `PAYSTACK_CALLBACK_URL` points to `/payment-return` on the backend.

Payment pending forever:

- Check admin payment timeline for webhook and verify events.
- Confirm Paystack reference exists.
- Confirm backend can call Paystack verify endpoint.
- Use admin operations view to inspect payment attempts.

Wrong domain:

- Check `FRONTEND_URL`, `CORS_ORIGIN`, and Paystack dashboard URLs.
- Redeploy backend after env changes.
