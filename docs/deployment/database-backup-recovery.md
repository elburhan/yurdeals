# Database Backup and Disaster Recovery

This guide defines YurDeals production database backup and recovery readiness for PostgreSQL and Prisma.

Orders, payments, inventory reservations, payment events, shipment events, users, addresses, and audit logs are business-critical. Prisma migrations are schema history, not data backups.

## Non-Negotiable Rules

- Never test restores against the live production database.
- Never rely on Prisma migrations as backups.
- Never run `prisma migrate reset`, `prisma db push --force-reset`, `DROP DATABASE`, `TRUNCATE`, or ad hoc delete scripts against production.
- Keep backups encrypted at rest and in transit.
- Restrict backup download/restore permissions to trusted operators.
- Verify backups periodically by restoring into staging or an isolated recovery database.
- Take a fresh provider snapshot before every production migration and before high-risk admin data operations.

## Provider Backups

Use a managed Postgres provider with automated backups before launch.

Recommended baseline:

- Automated backups: enabled.
- Backup frequency: at least daily before launch; increase to hourly or PITR when order volume grows.
- Retention: at least 7 days before launch; target 30 days after live payment volume begins.
- Point-in-time recovery: enabled when the provider plan supports it.
- Manual snapshots: before production migrations, bulk imports, pricing changes, and launch-day traffic opening.

Provider notes:

- Render PostgreSQL: confirm automated backups and retention for the selected plan. Take manual snapshots before migrations if available.
- Neon: use branching/PITR where available. Prefer direct database URLs for migration and restore operations when Neon recommends that split.
- Supabase: confirm daily backups/PITR by plan. Use direct connection strings for restore/migration tasks where Supabase recommends them.

## DATABASE_URL Handling

- Store production `DATABASE_URL` only in Render or the provider secret store.
- Do not paste live database URLs into docs, tickets, screenshots, or logs.
- App runtime can use a pooled URL when the provider offers one.
- Migration, dump, and restore commands may require a direct URL instead of a transaction pooler URL.
- Keep direct production database credentials more restricted than pooled runtime credentials when the provider supports separate credentials.

Example runtime shape:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public&connection_limit=5&sslmode=require"
```

## Backup Frequency and Retention

Pre-launch minimum:

- Daily automated backups.
- 7 days retention.
- One manual snapshot before first production migration.
- One restore test into staging before launch.

Post-launch target:

- PITR enabled.
- 30 days retention.
- Manual snapshot before every schema migration.
- Monthly restore verification.
- Restore drill after any major payment, inventory, or order-flow change.

## Operational Backup Commands

These commands are examples only. Do not run them against production unless you are the assigned operator and have confirmed the target URL.

Logical backup with `pg_dump`:

```bash
pg_dump "$DIRECT_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="yurdeals-prod-$(date +%Y%m%d-%H%M%S).dump"
```

Schema-only backup:

```bash
pg_dump "$DIRECT_DATABASE_URL" \
  --schema-only \
  --no-owner \
  --no-acl \
  --file="yurdeals-prod-schema-$(date +%Y%m%d-%H%M%S).sql"
```

Restore into a non-production database:

```bash
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname "$STAGING_RESTORE_DATABASE_URL" \
  "yurdeals-prod-YYYYMMDD-HHMMSS.dump"
```

Important: `--clean` drops objects in the restore target. Use it only against a disposable staging or recovery database.

## Prisma Migration Verification

Readonly migration status:

```bash
npm run db:migrate:status -w apps/backend
```

Production migration deployment:

```bash
npm run db:migrate:prod -w apps/backend
```

After a restore to staging:

```bash
npm run db:migrate:status -w apps/backend
npx prisma validate --schema apps/backend/prisma/schema.prisma
npm run build:backend
```

Expected:

- Prisma reports no unexpected drift.
- Pending migrations are understood and intentional.
- Backend builds against the restored schema.

## Restore-To-Staging Workflow

1. Create a new staging or isolated recovery Postgres database.
2. Use a backup snapshot or `pg_restore` into that database.
3. Point a staging backend environment at the restored database.
4. Run `npm run db:migrate:status -w apps/backend`.
5. Run readonly verification queries.
6. Start the backend in staging.
7. Verify health, admin login, order lookup, payment timeline, inventory reservations, and order tracking.
8. Destroy the temporary restore database after the drill if it contains production PII.

Never connect the production backend or production frontend to a restored drill database.

## Safe Readonly Verification Queries

Run these only through a readonly database role when possible.

Recent order/payment consistency:

```sql
SELECT
  o.order_number,
  o.status AS order_status,
  p.status AS payment_status,
  p.provider,
  p.reference,
  p.paid_at
FROM orders o
LEFT JOIN payments p ON p.order_id = o.id
ORDER BY o.created_at DESC
LIMIT 20;
```

Paid payments without paid order timestamp:

```sql
SELECT p.id, p.order_id, p.reference, p.status, o.order_number, o.paid_at
FROM payments p
JOIN orders o ON o.id = p.order_id
WHERE p.status = 'SUCCESS' AND o.paid_at IS NULL
ORDER BY p.paid_at DESC
LIMIT 50;
```

Active reservations older than their expiry:

```sql
SELECT id, order_id, order_item_id, expires_at
FROM inventory_reservations
WHERE status = 'ACTIVE' AND expires_at <= now()
ORDER BY expires_at ASC
LIMIT 50;
```

Payment events for a restored payment:

```sql
SELECT payment_id, provider, event_type, status, received_at
FROM payment_events
ORDER BY received_at DESC
LIMIT 50;
```

Admin accounts:

```sql
SELECT id, email, role, is_active, email_verified, created_at
FROM users
WHERE role = 'ADMIN'
ORDER BY created_at ASC;
```

Do not select password hashes, raw event payloads, guest access token hashes, or full PII unless required for an incident and approved by the incident owner.

## Order, Payment, and Inventory Integrity

During recovery, preserve these relationships:

- `orders` are the source of customer order state.
- `payments` and `payment_events` are needed to reconcile Paystack/Flutterwave truth with YurDeals state.
- `order_items` hold price snapshots and must remain aligned with order totals.
- `inventory_reservations` protect stock/preorder availability and should not be manually deleted.
- `shipments` and `shipment_events` preserve customer tracking history.
- `audit_logs` preserve admin accountability.

After restoring from an older backup:

1. Compare Paystack dashboard transactions after the restore point.
2. Run payment reconciliation against the restored production database only after the production recovery decision is approved.
3. Review orders created after the backup timestamp; they may need manual reconstruction from payment provider records and support logs.
4. Pause reservation expiry cron jobs until payment/order state is reviewed if the restore point is stale.

## Failed Deploy Recovery

If a deploy fails before migrations:

1. Roll back the application deployment.
2. No database restore should be needed.
3. Fix the build/config issue and redeploy.

If a deploy fails during migrations:

1. Stop the deployment.
2. Check `npm run db:migrate:status -w apps/backend`.
3. Inspect the failed migration logs.
4. Prefer a forward corrective migration.
5. Restore from the pre-migration snapshot only if the migration caused irreversible data damage and the data-loss window is accepted.

If a deploy succeeds but app behavior is wrong:

1. Disable traffic or roll back the app first.
2. Do not roll back the database automatically.
3. Assess whether schema and app are backward compatible.
4. Use a forward fix whenever possible.

## Migration Rollback Philosophy

YurDeals uses forward-only recovery by default.

- Do not edit migrations after they have run in production.
- Do not run destructive rollback SQL casually.
- Prefer additive corrections: new columns, new indexes, backfills, and compatibility code.
- Restore from backup only for severe data corruption or accidental destructive operations.

## Expand-And-Contract Strategy

Use expand-and-contract for risky schema changes:

1. Expand: add nullable columns, new tables, or new indexes without removing old fields.
2. Deploy app code that writes both old and new shapes if needed.
3. Backfill data with an audited, restartable script.
4. Verify reads from the new shape in staging and production monitoring.
5. Contract later: remove old fields only after a separate deploy and backup.

For orders, payments, inventory, and audit logs, avoid destructive schema changes during launch windows.

## Accidental Admin Deletion Recovery

Users are expected to be soft-managed with `isActive` where possible. If an admin is accidentally disabled:

1. Confirm the actor and timestamp from `audit_logs`.
2. Re-enable the admin only through an approved admin operation or a reviewed one-off SQL update.
3. Rotate the admin password if account compromise is suspected.
4. Record the recovery action in the incident timeline.

If an admin row is hard-deleted:

1. Do not restore the full production database just for one admin unless broader data damage occurred.
2. Restore the latest backup to staging.
3. Inspect the deleted admin record and related audit history.
4. Recreate or promote an admin in production using the approved seed/admin process.
5. Preserve evidence from the staging restore for incident review.

## Backup Verification Checklist

- Automated backups are enabled.
- Retention meets the launch target.
- PITR is enabled or a documented plan explains why it is unavailable.
- A manual pre-launch snapshot exists.
- A restore to staging has been completed successfully.
- `npm run db:migrate:status -w apps/backend` succeeds against the restored database.
- Readonly integrity queries return expected results.
- Backend health check passes against the restored staging database.
- Admin login works in staging after restore.
- Order/payment timeline is inspectable in staging.
- Payment reconciliation and reservation expiry are paused during restore validation unless explicitly being tested.
- Backup access is limited to trusted operators.
- Backup files are encrypted and not stored on personal machines longer than needed.

## Incident Notes

During a database incident, record:

- incident start time,
- last known good backup,
- suspected data-loss window,
- provider dashboard backup/PITR state,
- migrations applied before the incident,
- payment provider transactions during the incident window,
- operator commands run,
- final recovery decision and approver.
