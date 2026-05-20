# Recommended Deployment Order

This sequence minimizes production risk by bringing dependencies online before customer traffic.

## 1. Generate Secrets

Generate strong values for:

- `JWT_SECRET`
- `COOKIE_SECRET`
- `SEED_ADMIN_PASSWORD`

Why: the backend cannot safely run production auth without stable, private signing secrets.

## 2. Provision PostgreSQL

Create the production Postgres database and capture `DATABASE_URL`.

Why: migrations and backend startup depend on the database.

## 3. Configure Backend Environment

Add backend env vars in Render using `docs/deployment/backend-production-env.example`.

Why: Render needs correct database, CORS, cookie, provider, and email config before deployment.

## 4. Deploy Backend

Deploy the backend service and verify `/api/v1/health`.

Why: Paystack, Vercel, Resend testing, and admin operations all require a reachable API.

## 5. Run Migrations

Run:

```bash
npm run db:migrate:prod -w apps/backend
npm run db:generate -w apps/backend
```

Why: the schema must be ready before seeding or accepting traffic.

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

## 12. Soft Launch

Open to a small group first and monitor:

- Render logs
- Paystack dashboard
- Resend events
- Cloudinary usage
- admin order/payment timelines

Why: a controlled launch lets the team catch operational issues while volume is low.
