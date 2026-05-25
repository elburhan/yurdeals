# Go-Live Day Runbook

Follow this chronologically. Record timestamps and outcomes.

## 1. Pre-Launch Checks

Expected successful outcomes:

- Production secrets are in Render/Vercel only.
- Database backup exists.
- Paystack, Resend, and Cloudinary dashboards are accessible.
- `apps/frontend/vercel.json` rewrite is present.

Warning signs:

- Missing provider credentials.
- Unrotated exposed secrets.
- No database backup.

Escalation:

- Pause launch until secrets and backup are confirmed.

## 2. Backend Deployment

Actions:

- Deploy backend on Render.
- Confirm build completes.
- Confirm runtime starts.

Expected:

- Server logs show database connected.
- No missing env var errors.

Warning signs:

- Prisma client errors.
- Incomplete Flutterwave env vars when only part of the optional provider config is set.
- CORS or cookie misconfiguration.

## 3. Migration Execution

Actions:

```bash
npm run db:generate -w apps/backend
npm run db:migrate:prod -w apps/backend
```

Expected:

- Migrations apply cleanly.
- Re-running migrate deploy reports no pending migrations.

Warning signs:

- Migration failure.
- Database connection timeout.
- Prisma schema mismatch.

## 4. Seed Admin

Actions:

```bash
npm run db:seed -w apps/backend
```

Expected:

- Catalog seed succeeds.
- Admin seed succeeds if `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are set.

Warning signs:

- Seed fails due enum/schema mismatch.
- Admin variables missing when first admin is needed.

## 5. Frontend Deployment

Actions:

- Deploy frontend on Vercel.
- Confirm `VITE_API_URL`.
- Confirm production domain.

Expected:

- Home page loads.
- Direct route refresh works.
- API calls reach backend.

Warning signs:

- Vercel 404 on client routes.
- API calls still point to localhost.

## 6. Provider Verification

Paystack:

- Confirm callback URL.
- Confirm webhook URL.
- Run `npm run paystack:readiness:check -w apps/backend -- --live`.
- Confirm live secret/public key modes match in Render.
- Confirm webhook signature verification is not bypassed.

Resend:

- Confirm domain verified.
- Confirm `EMAIL_ENABLED=true`.

Cloudinary:

- Confirm credentials.
- Confirm upload endpoint works.

## 7. Smoke Testing

Run:

- Auth signup/login/logout.
- OTP email.
- Product browse.
- Cart and guest checkout.
- Payment initialization.
- Order tracking.
- Admin product image upload.
- Admin order/payment detail.

Expected:

- No console-blocking errors.
- No CORS failures.
- No cookie persistence failures.

## 8. Monitoring

Watch:

- Render logs.
- Vercel deployment/runtime indicators.
- Paystack events.
- Resend email events.
- Cloudinary usage.
- Admin order/payment timelines.

Warning signs:

- Payment pending forever.
- Duplicate payment emails.
- Failed uploads.
- Inventory reservation errors.

## 9. First Live Payment

Actions:

- Use a controlled low-value order.
- Complete Paystack live payment.
- Return to frontend.
- Confirm webhook/callback processing.
- Confirm Paystack dashboard shows webhook delivery.
- Confirm admin payment timeline shows one successful payment transition.
- Confirm duplicate webhook delivery would be idempotent by checking event IDs/timeline if Paystack retries.

Expected:

- Payment `SUCCESS`.
- Order confirmed.
- Reservation confirmed.
- Payment-confirmed email sent once.
- Admin timeline shows events.

Escalation:

- If payment succeeds in Paystack but remains pending in YurDeals, inspect admin payment timeline and backend logs, then run payment reconciliation before asking the customer to retry.

## 10. Post-Launch Observation Period

Observe for at least 60 minutes after soft launch.

Expected:

- Auth stable.
- Product browsing stable.
- Payments and emails stable.
- Support WhatsApp reachable.

Warning signs:

- Repeated CORS/cookie issues.
- Payment status mismatches.
- Email delivery failures.
- Database connection pressure.

Escalation:

- Pause marketing traffic.
- Keep support informed.
- Roll back only the affected layer using `docs/deployment/rollback-plan.md`.
