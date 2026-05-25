# Recommended Deployment Order

This sequence minimizes production risk by bringing dependencies online before customer traffic.

## 1. Generate Secrets

Generate strong values for:

- `JWT_SECRET`
- `COOKIE_SECRET`
- `SEED_ADMIN_PASSWORD`

Why: the backend cannot safely run production auth without stable, private signing secrets.

## 2. Provision PostgreSQL and Backups

Create the production Postgres database, capture `DATABASE_URL`, and enable automated backups before running migrations.

Minimum launch requirements:

- automated backups enabled,
- retention documented,
- PITR enabled when supported by the provider plan,
- one manual pre-migration snapshot,
- one restore-to-staging test completed.

Why: migrations and backend startup depend on the database, and orders/payments/inventory data need a tested recovery path before customer traffic.

## 3. Configure Backend Environment

Add backend env vars in Render using `docs/deployment/backend-production-env.example`.

Why: Render needs correct database, CORS, cookie, provider, and email config before deployment.

## 4. Deploy Backend

Deploy the backend service and verify `/api/v1/health`.

Why: Paystack, Vercel, Resend testing, and admin operations all require a reachable API.

## 5. Run Migrations

Run:

```bash
npm run db:migrate:status -w apps/backend
npm run db:migrate:prod -w apps/backend
npm run db:migrate:status -w apps/backend
npm run db:generate -w apps/backend
```

Why: the schema must be ready before seeding or accepting traffic, and migration status should be known before and after deployment.

## 6. Seed Admin

Run:

```bash
npm run db:seed -w apps/backend
```

with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` set.

Why: admin access is required for product, payment, reservation, and support operations.

## 7. Configure and Deploy Frontend

Set frontend env vars in Vercel using `docs/deployment/frontend-production-env.example`, then deploy.

Why: customers need a stable frontend pointing at the production API.

## 8. Configure Paystack

Set dashboard callback and webhook URLs:

- Callback: `https://api.yourdomain.com/payment-return`
- Webhook: `https://api.yourdomain.com/api/v1/payments/paystack/webhook`

Why: payment return and webhook confirmation rely on production backend routes.

## 9. Configure Resend

Verify domain DNS, set `EMAIL_ENABLED=true`, and test emails.

Why: OTP and order/payment notifications are part of the production customer journey.

## 10. Configure Cloudinary

Set Cloudinary credentials and verify admin uploads.

Why: product media must work before public browsing and product detail QA.

## 11. Smoke Test

Run operational smoke tests:

- auth
- product browsing
- admin login
- product creation
- guest checkout
- Paystack payment
- payment return
- email notifications
- order tracking
- image upload

Why: this catches cross-system mistakes before real users hit them.

## 12. Confirm Recovery Readiness

Confirm:

- latest automated backup is visible in the provider dashboard,
- restore-to-staging procedure in `docs/deployment/database-backup-recovery.md` has been tested,
- readonly order/payment/inventory verification queries are ready,
- payment reconciliation and reservation expiry cron behavior is understood during restore incidents.

Why: launch should not depend on an untested backup.

## 13. Soft Launch

Open to a small group first and monitor:

- Render logs
- Paystack dashboard
- Resend events
- Cloudinary usage
- admin order/payment timelines

Why: a controlled launch lets the team catch operational issues while volume is low.
