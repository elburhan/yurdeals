# Production Commands

These commands are for deployment preparation and verification. Do not run destructive reset commands against production.

## Local Pre-Deploy Verification

From the repository root:

```bash
npm ci
npm run build:shared
npm run build:backend
npm run build:frontend
npm run lint
```

Optional local QA when local backend/frontend test servers are available:

```bash
npm run test:e2e
npm run test:e2e:auth
```

Prisma validation/generation:

```bash
npm run db:generate -w apps/backend
npx prisma validate --schema apps/backend/prisma/schema.prisma
```

## Database Setup

Production migration sequence:

```bash
npm run db:generate -w apps/backend
npm run db:migrate:prod -w apps/backend
```

Seed catalog data and optional admin:

```bash
npm run db:seed -w apps/backend
```

Set these only for the first production admin seed:

```bash
SEED_ADMIN_EMAIL="admin@yourdomain.com"
SEED_ADMIN_PASSWORD="REPLACE_WITH_ONE_TIME_STRONG_PASSWORD"
```

## Backend Deployment Verification

Health check:

```bash
curl -i https://api.yourdomain.com/api/v1/health
```

Expected:

- HTTP `200`
- `success: true`
- `database: "connected"`

Migration verification:

```bash
npm run db:migrate:prod -w apps/backend
```

Expected: Prisma reports no pending migrations after the first successful deploy.

Logs inspection:

- Check Render deploy logs for TypeScript/build errors.
- Check Render build logs for `npm run build:shared`, `npm run db:generate -w apps/backend`, and `npm run build:backend`.
- Check runtime logs for database connection success.
- Check runtime logs for payment provider configuration: Paystack enabled and Flutterwave enabled/disabled as intended.
- Check runtime logs for missing env var failures.
- Check request logs for health checks and API smoke tests.

Payment reconciliation runner:

```bash
npm run payments:reconcile -w apps/backend
```

Recommended scheduling: every 5-10 minutes after Paystack live keys and webhooks are configured.
The runner is safe to repeat because it reuses idempotent Paystack verification and guarded payment
status transitions.

## Deployment Failure Recovery

- Shared build fails: rerun `npm run build:shared` locally and confirm workspace install ran from repo root.
- Prisma migrate fails: stop the deployment, inspect the migration error, and do not run reset commands.
- Prisma client mismatch occurs: run `npm run db:generate -w apps/backend`, rebuild, and redeploy.
- Backend boots without required env vars: Render should show a missing env error; add the variable and restart.
- Vercel cannot resolve `@yurdeals/shared`: use repo-root Vercel config or build with `cd ../.. && npm run build:shared && npm run build:frontend`.
- Render health check fails: inspect runtime logs, database connectivity, and `/api/v1/health` response.

## Frontend Deployment Verification

API connectivity:

```bash
curl -i https://api.yourdomain.com/api/v1/health
```

Browser routing checks:

- Open `https://www.yourdomain.com/`.
- Open `https://www.yourdomain.com/categories/all` directly.
- Refresh `https://www.yourdomain.com/orders/track`.
- Refresh `https://www.yourdomain.com/payment-return`.

Expected: Vercel serves the SPA instead of a 404.

## Post-Launch Smoke Tests

- Register/login/logout.
- OTP email delivery.
- Browse products and category pages.
- Add product to cart.
- Guest checkout.
- Paystack payment initialization.
- Paystack payment return.
- Admin order/payment timeline.
- Payment reconciliation runner against older pending test payments.
- Inventory reservation confirmation.
- Order tracking by order number and phone.
- Cloudinary product image upload.
- Mobile UI scan on 360px and 414px widths.
