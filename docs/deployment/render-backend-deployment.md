# Render Backend Deployment

This guide prepares the Express backend for Render. It does not deploy anything.

## Recommended Render Service

- Service type: Web Service
- Runtime: Node
- Root directory: repo root `.`
- Node version: `20.x` or newer
- Build command from repo root if Render supports monorepo root:
  - `npm ci && npm run build:shared && npm run db:generate -w apps/backend && npm run build:backend`
- Build command if Render root directory is `apps/backend`:
  - `npm ci --include=dev && npm run build`
  - Use the repo-root build if possible because the backend depends on `@yurdeals/shared`.
- Start command:
  - `npm run start -w apps/backend` from repo root
  - or `npm run start` when root directory is `apps/backend`
- Health check path:
  - `/api/v1/health`

## Environment Variables

Use `docs/deployment/backend-production-env.example` as the placeholder template.

Important production values:

- `DATABASE_URL` should be a pooled production Postgres URL when your provider offers one, for example `postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public&connection_limit=5&sslmode=require`
- `NODE_ENV=production`
- `FRONTEND_URL=https://www.yourdomain.com`
- `CORS_ORIGIN=https://www.yourdomain.com,https://yourdomain.com`
- `PAYSTACK_CALLBACK_URL=https://api.yourdomain.com/payment-return`
- `COOKIE_SAME_SITE=none` for Render temporary domain plus Vercel frontend domain
- `COOKIE_SAME_SITE=lax` only after moving to a same-site custom domain setup and verifying cookies

Never paste local `.env` values into Render without rotating secrets first.

Flutterwave is optional. Leave all `FLUTTERWAVE_*` vars empty when Paystack is the only enabled provider. If any `FLUTTERWAVE_*` value is configured, the backend requires the full Flutterwave set and starts with Flutterwave enabled.

## Prisma Migration Strategy

Run Prisma Client generation during build and production migrations after the database is provisioned and before customer traffic:

```bash
npm run db:generate -w apps/backend
npm run db:migrate:prod -w apps/backend
```

Do not use destructive reset commands in production.

If your database provider offers separate runtime and migration URLs, keep the pooled URL in `DATABASE_URL` for app traffic and use the provider-recommended direct URL only for migration steps.

## Seed Strategy

After migrations, seed catalog data and optionally create the first admin:

```bash
npm run db:seed -w apps/backend
```

To create or update the first admin during seed, set:

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`

If either variable is missing, the seed skips admin creation and logs a warning. The seed must never print the password.

## Cookie Guidance

For Vercel frontend plus Render backend on different sites, cookies must be:

- `httpOnly: true`
- `secure: true` in production
- `sameSite: "none"` in production

The app supports this with `NODE_ENV=production` and `COOKIE_SAME_SITE=none`.

## Domain Examples

Temporary deployment:

- Frontend: `https://yurdeals.vercel.app`
- Backend: `https://yurdeals-api.onrender.com`
- `COOKIE_SAME_SITE=none`
- `CORS_ORIGIN=https://yurdeals.vercel.app`
- `FRONTEND_URL=https://yurdeals.vercel.app`

Custom domain deployment:

- Frontend: `https://www.yourdomain.com`
- Backend: `https://api.yourdomain.com`
- Start with `COOKIE_SAME_SITE=none`; consider `lax` only after browser testing confirms same-site behavior.

## Troubleshooting

- Shared build fails: confirm Render root is repo root and `npm ci` installs workspaces.
- Prisma client mismatch: rerun `npm run db:generate -w apps/backend`, then rebuild backend.
- Prisma migrate fails: stop deployment, inspect migration error, and do not start new traffic until schema state is understood.
- CORS error: confirm `CORS_ORIGIN` exactly matches the browser origin.
- Login works locally but not production: inspect blocked cookies in browser DevTools; check HTTPS, `NODE_ENV`, and `COOKIE_SAME_SITE`.
- Payment return redirects to the wrong site: check `FRONTEND_URL`.
- Paystack callback fails: check `PAYSTACK_CALLBACK_URL` points to backend `/payment-return`.
- Prisma cannot connect: verify `DATABASE_URL`, SSL mode, database firewall, provider connection limits, and whether the app is using the pooled runtime URL rather than an over-aggressive direct connection string.
