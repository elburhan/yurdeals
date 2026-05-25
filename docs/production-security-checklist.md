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
- `COOKIE_SAME_SITE`
- `CSRF_ENABLED`
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
- `SENTRY_DSN` (optional; required for production error monitoring)
- `SENTRY_ENVIRONMENT`
- `SENTRY_TRACES_SAMPLE_RATE`
- `SEED_ADMIN_EMAIL` (optional; only needed for seed-time admin bootstrap)
- `SEED_ADMIN_PASSWORD` (optional; only needed for seed-time admin bootstrap)

Frontend:

- `VITE_API_URL`
- `VITE_WHATSAPP_BUSINESS_NUMBER`

## Key Rotation Checklist

- Rotate `JWT_SECRET` and `COOKIE_SECRET` in the deployment platform, then redeploy backend instances together so token signing stays consistent.
- Rotate Paystack live keys in the Paystack dashboard and update both `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY`.
- Rotate Flutterwave keys and webhook secret hash together if Flutterwave is enabled.
- Rotate Cloudinary API credentials if they were ever shared in chat, screenshots, or committed history.
- Rotate `RESEND_API_KEY` if it was stored outside the secret manager or exposed in logs.
- Rotate or replace `SENTRY_DSN` if it was committed or exposed outside deployment configuration.
- If any old `.env` contents were committed or pasted publicly, replace the secrets before launch instead of assuming deletion is enough.

## Payment Provider Notes

- Use Paystack test keys only in non-production environments.
- Use Paystack live keys only in production.
- `PAYSTACK_CALLBACK_URL` should point to the backend `/payment-return` route, not directly to the frontend.
- Paystack live webhook URL should be `https://api.yourdomain.com/api/v1/payments/paystack/webhook`.
- Run `npm run paystack:readiness:check -w apps/backend -- --live` before switching production to live keys.
- Confirm Paystack webhook signature verification remains enabled and raw request bodies are preserved before JSON parsing.
- Never treat the frontend callback as proof of payment; backend verification, webhook, or reconciliation must confirm the payment.
- After switching Paystack from test to live, run one real end-to-end payment verification in production-safe conditions.

## CSRF Notes

- Keep `CSRF_ENABLED=true` in production when browser auth uses HttpOnly cookies.
- Confirm `GET /api/v1/auth/csrf` sets a readable `csrf_token` cookie.
- Confirm unsafe browser requests send `X-CSRF-Token`.
- Confirm CORS allows `X-CSRF-Token`.
- Confirm unsafe requests without a valid token fail with `CSRF_INVALID`.
- Confirm Paystack webhook routes remain exempt and still rely on provider signature verification.

## Email and Media Notes

- Verify the sending domain in Resend before setting `EMAIL_ENABLED=true`.
- Confirm `EMAIL_FROM` uses a verified domain and that replies route to a monitored inbox.
- Keep Cloudinary credentials in the deployment secret store only; do not embed them in frontend code or docs.

## Sentry Production Checklist

- Create a backend Node.js project in Sentry.
- Set `SENTRY_DSN` in Render only.
- Set `SENTRY_ENVIRONMENT=production`.
- Set `SENTRY_TRACES_SAMPLE_RATE=0.05`.
- Confirm backend Express errors are captured in Sentry without changing API error responses.
- Confirm payment reconciliation and reservation expiry script failures are captured in staging before launch.
- Confirm captured events do not include passwords, OTPs, auth cookies, bearer tokens, payment card data, Paystack secret keys, or raw provider payloads.
- Configure Sentry alerts for new issues, regressions, and high-frequency backend errors.
- Do not add a public production test-error route.

## Resend Production Checklist

- Add `yurdeals.com` in the Resend dashboard.
- Add all Resend DNS records at the DNS host.
- Confirm SPF verification passes.
- Confirm DKIM verification passes.
- Confirm DMARC exists for `yurdeals.com`.
- Set `EMAIL_ENABLED=true` in Render after verification.
- Set `RESEND_API_KEY` in Render only.
- Set `EMAIL_FROM="YurDeals <orders@yurdeals.com>"`.
- Set `EMAIL_REPLY_TO="support@yurdeals.com"` and confirm the inbox is monitored.
- Run `npm run email:templates:check -w apps/backend`.
- Run `npm run email:readiness:check -w apps/backend`.
- Run one real team-controlled OTP inbox test.
- Run one real team-controlled order-created inbox test.
- Run one real team-controlled payment-confirmed inbox test.

## Deployment Checks

- Confirm automated database backups are enabled and retention is documented.
- Confirm PITR is enabled, or document why the provider plan does not support it.
- Take a manual database snapshot before production migrations.
- Complete a restore-to-staging test before launch; never restore-test against production.
- Use a pooled production `DATABASE_URL` when your Postgres provider offers one, for example `postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public&connection_limit=5&sslmode=require`.
- If your provider separates pooled runtime URLs from direct migration URLs, keep the pooled URL in app runtime config and use the direct URL only for migrations when the provider recommends that split.
- Run `npm run db:migrate:status -w apps/backend` before and after production migration work.
- Run database migrations with `npm run db:migrate:prod -w apps/backend`.
- Configure `npm run payments:reconcile -w apps/backend` on a `5-10` minute schedule.
- Configure `npm run reservations:expire -w apps/backend` on a `5-10` minute schedule.
- Confirm Paystack live callback and webhook URLs are configured in the Paystack dashboard.
- Create or update the first admin during seeding by setting `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, then running `npm run db:seed -w apps/backend`.
- Run `npm run build:shared`.
- Run `npm run build:backend`.
- Run `npm run build:frontend`.
- Run `npm run lint`.
- If local servers are running, run `npm run test:e2e:auth`.

## Vercel Frontend Routing

- The Vite SPA must include `apps/frontend/vercel.json` with a rewrite from `/(.*)` to `/index.html`.
- This keeps React Router pages such as `/categories/all`, `/orders/track`, and `/payment-return` from returning 404 on refresh or direct visits.

## Admin Bootstrap

- Do not hardcode an admin account in the seed data.
- Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in the backend deployment environment before running `npm run db:seed -w apps/backend`.
- If either seed admin variable is missing, seeding skips admin creation and logs a warning.
- If the user already exists, the seed promotes it to `ADMIN`, verifies it, and updates the password hash from `SEED_ADMIN_PASSWORD`.
- Remove or rotate the one-time `SEED_ADMIN_PASSWORD` value in the deployment secret store after the admin account is confirmed.
- The seed logs the admin email only. It must never print the password.

## Render Backend + Vercel Frontend Cookies

- Production must run with `NODE_ENV=production`.
- Backend auth cookies are always HttpOnly.
- Keep CSRF enabled for cookie-authenticated browser requests, especially when `COOKIE_SAME_SITE=none`.
- Use `COOKIE_SAME_SITE=none` for a Render temporary backend domain plus Vercel frontend domain; this sends `SameSite=None; Secure` cookies in production.
- Use `COOKIE_SAME_SITE=lax` for a same-site custom-domain setup such as `https://yurdeals.com` plus `https://api.yurdeals.com`, after confirming browser cookie behavior.
- `CORS_ORIGIN` must include the exact Vercel frontend origin, and the frontend API client must send credentials.
- `FRONTEND_URL` must be the canonical Vercel app URL used for payment-return redirects.
- If auth works locally but fails in production, first check browser DevTools for blocked cookies caused by an HTTP backend URL, a missing Vercel origin in `CORS_ORIGIN`, incorrect `COOKIE_SAME_SITE`, or an incorrect `NODE_ENV`.

## Final Launch Sanity Checks

- Confirm browser auth works with HttpOnly cookies and no access token persistence in `localStorage`.
- Confirm CSRF token fetch, unsafe request header injection, and one-time retry work in the production browser flow.
- Confirm `/payment-return` redirects to the exact `FRONTEND_URL`.
- Confirm no debug or dev-only auth inspection routes are reachable in production.
- Confirm CORS allows only approved frontend origins.
- Confirm production `.env` values are present in the deployment platform and absent from the repository.
- Confirm database backups are encrypted, access-controlled, and periodically restore-tested.
- Confirm anonymous guest checkout always creates an isolated guest-owned order/address record, even when the submitted guest email or phone matches an existing registered account.
- Confirm guest order-created and payment-confirmed emails use the guest-submitted contact details without attaching the order to a registered account.
- Confirm Paystack live readiness check passes and one controlled low-value live payment updates order/payment/reservation state correctly.
- Confirm public order tracking requires both the checkout phone number and the exact order number.
- Confirm public tracking is rate-limited and returns only sanitized tracking details, never full shipping addresses, full item details, totals, or payment references.
- Confirm both the payment reconciliation and reservation expiry schedulers are active in production.
