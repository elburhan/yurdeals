# Production Security Checklist

Use this before every production deploy and immediately after any suspected secret exposure.

## Core Rules

- Never commit `.env` files, copied secret dumps, or provider dashboard screenshots.
- Store production secrets only in your hosting platform or secret manager.
- Rotate any previously exposed or shared secrets before launch, even if they are no longer in the repo.
- Keep `NODE_ENV=production` in production so dev-only helpers stay disabled.

## Required Production Environment Variables

Backend:

- `DATABASE_URL`
- `NODE_ENV=production`
- `PORT`
- `API_VERSION`
- `JWT_SECRET`
- `JWT_ACCESS_EXPIRES_IN_SECONDS`
- `JWT_REFRESH_EXPIRES_IN_SECONDS`
- `COOKIE_SECRET`
- `CORS_ORIGIN`
- `FRONTEND_URL`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`
- `AUTH_RATE_LIMIT_WINDOW_MS`
- `AUTH_RATE_LIMIT_MAX_REQUESTS`
- `ORDER_RATE_LIMIT_WINDOW_MS`
- `ORDER_RATE_LIMIT_MAX_REQUESTS`
- `PAYMENT_RATE_LIMIT_WINDOW_MS`
- `PAYMENT_RATE_LIMIT_MAX_REQUESTS`
- `ADMIN_RATE_LIMIT_WINDOW_MS`
- `ADMIN_RATE_LIMIT_MAX_REQUESTS`
- `WEBHOOK_RATE_LIMIT_WINDOW_MS`
- `WEBHOOK_RATE_LIMIT_MAX_REQUESTS`
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_CALLBACK_URL`
- `FLUTTERWAVE_SECRET_KEY`
- `FLUTTERWAVE_PUBLIC_KEY`
- `FLUTTERWAVE_WEBHOOK_SECRET_HASH`
- `FLUTTERWAVE_CALLBACK_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `RESEND_API_KEY`
- `EMAIL_ENABLED`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`

Frontend:

- `VITE_API_URL`
- `VITE_WHATSAPP_BUSINESS_NUMBER`

## Key Rotation Checklist

- Rotate `JWT_SECRET` and `COOKIE_SECRET` in the deployment platform, then redeploy backend instances together so token signing stays consistent.
- Rotate Paystack live keys in the Paystack dashboard and update both `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY`.
- Rotate Flutterwave keys and webhook secret hash together if Flutterwave is enabled.
- Rotate Cloudinary API credentials if they were ever shared in chat, screenshots, or committed history.
- Rotate `RESEND_API_KEY` if it was stored outside the secret manager or exposed in logs.
- If any old `.env` contents were committed or pasted publicly, replace the secrets before launch instead of assuming deletion is enough.

## Payment Provider Notes

- Use Paystack test keys only in non-production environments.
- Use Paystack live keys only in production.
- `PAYSTACK_CALLBACK_URL` should point to the backend `/payment-return` route, not directly to the frontend.
- After switching Paystack from test to live, run one real end-to-end payment verification in production-safe conditions.

## Email and Media Notes

- Verify the sending domain in Resend before setting `EMAIL_ENABLED=true`.
- Confirm `EMAIL_FROM` uses a verified domain and that replies route to a monitored inbox.
- Keep Cloudinary credentials in the deployment secret store only; do not embed them in frontend code or docs.

## Deployment Checks

- Run database migrations with `npm run db:migrate:prod -w apps/backend`.
- Run `npm run build:shared`.
- Run `npm run build:backend`.
- Run `npm run build:frontend`.
- Run `npm run lint`.
- If local servers are running, run `npm run test:e2e:auth`.

## Final Launch Sanity Checks

- Confirm browser auth works with HttpOnly cookies and no access token persistence in `localStorage`.
- Confirm `/payment-return` redirects to the exact `FRONTEND_URL`.
- Confirm no debug or dev-only auth inspection routes are reachable in production.
- Confirm CORS allows only approved frontend origins.
- Confirm production `.env` values are present in the deployment platform and absent from the repository.
- Confirm anonymous guest checkout always creates an isolated guest-owned order/address record, even when the submitted guest email or phone matches an existing registered account.
- Confirm guest order-created and payment-confirmed emails use the guest-submitted contact details without attaching the order to a registered account.
- Confirm public order tracking requires both the checkout phone number and the exact order number.
- Confirm public tracking is rate-limited and returns only sanitized tracking details, never full shipping addresses, full item details, totals, or payment references.
