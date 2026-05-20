# Email Notifications

YurDeals Phase 1 customer email notifications use Resend through a small backend HTTPS client. No Resend SDK is required.

## Provider Setup

1. Create or open a Resend account.
2. Add the production sending domain in Resend: `yurdeals.com`.
3. Add every DNS record Resend provides at the DNS host.
4. Wait for SPF and DKIM verification to pass in Resend.
5. Confirm DMARC exists for `yurdeals.com`.
6. Create a server-side Resend API key with send permission.
7. Store the key in Render only as `RESEND_API_KEY`.
8. Configure backend environment variables:

```env
EMAIL_ENABLED=true
RESEND_API_KEY="re_xxxxxxxxx"
EMAIL_FROM="YurDeals <orders@yurdeals.com>"
EMAIL_REPLY_TO="support@yurdeals.com"
```

Use `onboarding@resend.dev` only for early Resend sandbox testing. Production must use the verified `yurdeals.com` sender domain.

## Implemented Triggers

- OTP verification email for `EMAIL` channel signup/resend flows.
- Order created / preorder received email after order creation.
- Payment confirmed email when payment status changes to `SUCCESS`.

Order status and shipment emails are intentionally left for a later phase.

## Development Behavior

- The existing dev OTP helper remains available.
- If email is disabled in development, OTP codes are still captured by the dev helper.
- The backend does not log raw OTP values.
- Order/payment emails are skipped when email is disabled.
- Automated QA should use the template verification script; it does not call Resend.

```bash
npm run email:templates:check -w apps/backend
```

This renders the OTP, preorder received, and payment confirmed templates, checks required copy, and verifies dangerous input is HTML-escaped.

Config QA should use the readiness script; it does not call Resend and does not send emails.

```bash
npm run email:readiness:check -w apps/backend
```

## Production Behavior

- `EMAIL_ENABLED=true`, `RESEND_API_KEY`, and `EMAIL_FROM` are required for OTP email delivery.
- If OTP email delivery is not configured or fails in production, the OTP request fails instead of pretending an email was sent.
- Order-created and payment-confirmed email failures are logged safely and do not break checkout or payment confirmation.
- Emails are not sent to internal placeholder addresses ending in `.local`.
- Normal logs must never include raw OTP values, API keys, provider payloads, or full sensitive customer data.

## Production Checklist

- Resend domain `yurdeals.com` is added in the Resend dashboard.
- Resend DNS records are added at the DNS host.
- SPF verification passes in Resend.
- DKIM verification passes in Resend.
- DMARC exists for `yurdeals.com`.
- `EMAIL_ENABLED=true` is set in Render.
- `RESEND_API_KEY` is set in Render only.
- `EMAIL_FROM="YurDeals <orders@yurdeals.com>"` uses the verified domain.
- `EMAIL_REPLY_TO="support@yurdeals.com"` routes to a monitored inbox.
- `npm run email:templates:check -w apps/backend` passes.
- `npm run email:readiness:check -w apps/backend` passes.
- Signup OTP email is tested with a real team-controlled inbox.
- Guest checkout with a real team-controlled email receives the preorder received email.
- A controlled Paystack payment receives one payment confirmed email.
- Backend logs show masked recipients only, never OTPs or provider secrets.

## Idempotency

The in-app notification system uses deterministic `eventKey` values and only sends email after a new notification record is created.

Resend idempotency keys are also sent:

- `otp:<verificationSessionId>`
- `order-created:<orderId>`
- `payment-success:<paymentId>`

This helps prevent duplicate sends during webhook/callback retries.

To verify idempotency manually:

1. Complete a Paystack test payment and confirm one payment email arrives.
2. Let both callback verification and webhook processing run.
3. Open admin order details and confirm payment events may include more than one verification/webhook event.
4. Confirm only one `PAYMENT_SUCCESS` in-app notification exists for the order.
5. Confirm only one payment confirmed email arrives for the same payment ID.

## Manual Delivery Test Procedure

### 1. Enable Email In Development

Use a Resend test key or sandbox sender. Do not use production customer addresses for QA.

```env
EMAIL_ENABLED=true
RESEND_API_KEY="re_test_or_dev_key"
EMAIL_FROM="YurDeals <onboarding@resend.dev>"
EMAIL_REPLY_TO="support@example.com"
```

Restart the backend after changing env values.

### 2. Trigger OTP Email

1. Open the frontend signup flow.
2. Register with an email address you control.
3. Choose/use email verification.
4. Confirm the OTP email arrives and contains:
   - 6-digit code,
   - expiry notice,
   - "If you did not request this..." security copy.

In development, the dev OTP helper still captures the code for manual QA. The raw OTP must not appear in normal logs.

### 3. Trigger Order-Created Email

1. Add a product to cart.
2. Checkout as a guest with a real email address, or as an authenticated customer.
3. Create the preorder/order.
4. Confirm the email subject includes the order number and the body includes:
   - customer name,
   - item summary,
   - total,
   - preorder next-step expectations.

### 4. Trigger Payment-Confirmed Email

1. From the checkout payment panel, choose Pay online.
2. Complete Paystack test payment.
3. Wait for callback/webhook verification.
4. Confirm the payment confirmed email includes:
   - order number,
   - amount paid,
   - next-step expectations.

## Dry-Run Behavior

There is no separate `EMAIL_DRY_RUN` flag in Phase 1. The safe dry-run path is:

- keep `EMAIL_ENABLED=false`,
- run `npm run email:templates:check -w apps/backend`,
- run `npm run email:readiness:check -w apps/backend`,
- use the development OTP helper for OTP QA.

This avoids a second mode that could accidentally be left enabled in production. Real delivery is controlled by `EMAIL_ENABLED=true`.

## Troubleshooting

- If OTP email fails in production, confirm `EMAIL_ENABLED=true`.
- Confirm `RESEND_API_KEY` starts with the expected Resend key prefix and has send permissions.
- Confirm `EMAIL_FROM` uses the verified Resend sender domain.
- Confirm the backend was restarted after changing env values.
- Confirm the recipient is not an internal placeholder address ending in `.local`.
- For Resend sandbox testing, confirm the recipient is allowed by the Resend account/test mode.
- Check spam/promotions folders for the test inbox.
- Check backend logs for masked recipient, subject, and provider status. Raw OTPs, guest tokens, and provider secrets are never logged.
- If order/payment emails do not arrive but checkout succeeds, check whether the user email is deliverable and not an internal `.local` address.
