# PostgreSQL and Prisma Production Guide

This guide covers production database setup for YurDeals. It avoids destructive commands.

## Recommended Providers

- Render PostgreSQL: simple if backend is also on Render.
- Neon: strong serverless Postgres option with branching.
- Supabase: managed Postgres with dashboard tooling.

Choose a provider with automated backups, SSL support, and enough connection capacity for the backend.

## DATABASE_URL

Obtain the provider connection string and set it as:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public&connection_limit=5&sslmode=require"
```

For a long-running Node backend on Render or similar infrastructure, prefer a pooled production URL when your provider offers one. This reduces the risk of too many open PostgreSQL connections during deploys, restarts, or traffic spikes.

Examples by provider:

- Render PostgreSQL: use the provider's pooling/proxy option if enabled, otherwise keep `connection_limit` conservative.
- Neon: prefer the pooled connection string for runtime traffic and keep the direct connection string available for maintenance tasks if Neon documents that split for your plan.
- Supabase: prefer the Supavisor pooled URL for runtime traffic and keep the direct connection string available for migrations if needed.
- PgBouncer: if your platform provides PgBouncer or a transaction pooler, use that URL for the app runtime.

## Pooling Guidance

- Recommended app-runtime baseline: `connection_limit=5`
- Increase only after observing actual load and provider limits.
- Keep SSL enabled in production when your provider requires it.
- Do not log `DATABASE_URL` or paste live URLs into docs, tickets, or screenshots.

## Migrations vs Runtime URLs

If your provider gives you both a pooled runtime URL and a direct URL, use them intentionally:

- App runtime: pooled URL in `DATABASE_URL`
- Migrations: direct URL when your provider recommends running schema migrations outside the transaction pooler

YurDeals does not require Prisma Accelerate for the current architecture. A standard pooled Postgres URL is enough for this Node/Express backend. Revisit Accelerate only if you later move heavy database traffic into highly parallel serverless or edge execution patterns.

## Production Sequence

From the repo root:

```bash
npm ci
npm run build:shared
npm run db:generate -w apps/backend
npm run db:migrate:prod -w apps/backend
npm run db:seed -w apps/backend
```

Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` before seeding if this is the first production admin.

## Admin User Creation

The seed script can create or update the first admin:

- `SEED_ADMIN_EMAIL=admin@yourdomain.com`
- `SEED_ADMIN_PASSWORD=REPLACE_WITH_ONE_TIME_STRONG_PASSWORD`

After verifying admin login, rotate or remove the one-time seed password from the deployment secret store.

## Rollback Considerations

- Prefer forward-only corrective migrations.
- Keep a backup snapshot before every production migration.
- Do not run `prisma migrate reset` or database reset commands in production.
- If a deploy fails after migrations, roll forward with a fix or restore from a provider snapshot only after assessing data loss.

## Backup Recommendations

- Enable automated daily backups.
- Keep at least 7 days of retention before launch; increase after traffic grows.
- Take a manual snapshot before first launch and before major schema migrations.
- Test restore in a non-production database before trusting the backup process.

## Production Migration Checklist

- Confirm `DATABASE_URL` points to production.
- Confirm a backup exists.
- Run `npm run db:migrate:prod -w apps/backend`.
- Run `npm run db:generate -w apps/backend` if the generated client is not already built in the deployment image.
- Run `npm run db:seed -w apps/backend`.
- Verify `/api/v1/health`.
- Verify admin login.
