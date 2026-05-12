# Guest Payment Access QA Checklist

Use this checklist after changing guest checkout, guest payment access, or Paystack return handling.

## Automated Smoke Coverage

Run:

```bash
npx playwright test tests/guest-payment-access.spec.ts
```

The smoke test verifies:

- a guest order can be created through the real backend API
- `guestAccessToken` is returned once to the client response
- `Order.guestAccessTokenHash` is populated
- `Order.guestAccessTokenExpiresAt` is populated
- raw guest tokens are not stored in `Order.notes`
- new orders do not contain the legacy `[guestAccessToken:...]` note tag
- the guest payment status endpoint accepts the valid token
- the guest payment status endpoint rejects a wrong token safely
- Paystack payment initialization can be exercised through the backend service with `fetch` mocked inside the test process
- generated guest Paystack callback URLs do not include `guestAccessToken`

The smoke test does not automate real Paystack redirects or live provider verification.

## Manual Paystack Redirect QA

1. Start the backend and frontend locally.
2. Confirm backend `.env` uses Paystack test keys and the current backend callback URL:

```text
PAYSTACK_CALLBACK_URL=https://<backend-ngrok-url>/payment-return
```

3. In the Paystack test dashboard, set:

```text
Callback URL: https://<backend-ngrok-url>/payment-return
Webhook URL:  https://<backend-ngrok-url>/api/v1/payments/paystack/webhook
```

4. Open the customer frontend and check out as a guest.
5. Confirm the order creation response includes `guestAccessToken`.
6. In Prisma Studio or the database, confirm the new order has:

```text
guestAccessTokenHash      populated
guestAccessTokenExpiresAt populated
notes                     no [guestAccessToken:...] tag
```

7. Click **Pay online**.
8. Confirm the browser stores a short-lived guest payment session in `sessionStorage`.
9. Confirm Paystack opens in test mode and the Paystack URL/callback URL does not expose `guestAccessToken`.
10. Complete or abandon the test payment.
11. Confirm `/payment-return` loads and polls the guest payment status from the stored session.
12. Confirm successful test payments eventually show `Payment.status = SUCCESS` and `Order.status = PAID`.
13. In a fresh browser, open the same `/payment-return` URL and confirm the recovery UI links to order tracking and WhatsApp support instead of trying authenticated polling.

## Legacy Compatibility

Old guest orders created before `guestAccessTokenHash` existed may still validate through the legacy
`[guestAccessToken:...]` note tag. Keep this fallback until old pending guest orders have aged out.

Older payment-return links that already contain `guestAccessToken` in the URL may still work through
the temporary frontend query fallback. New Paystack callback URLs must not include the token.

## Future Hardening TODOs

- Add durable guest session recovery after reloads or abandoned returns.
- Remove the temporary `guestAccessToken` query fallback.
- Remove the legacy notes-token fallback after the compatibility window closes.
