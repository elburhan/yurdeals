# Production Rollback Plan

Rollback should be calm, explicit, and scoped. Do not roll back database changes blindly.

## Backend Rollback

- Use Render deploy history to redeploy the previous known-good backend build.
- Confirm the previous build is compatible with the current database schema.
- Verify `/api/v1/health` after rollback.
- Watch logs for Prisma schema/client mismatch errors.

## Frontend Rollback

- Use Vercel deployment history to promote the previous known-good frontend deployment.
- Confirm `VITE_API_URL` still points to the intended backend.
- Re-test routing and login after rollback.

## Database Migration Caution

- Do not run destructive reset commands.
- Do not manually delete tables/columns during an incident.
- Prefer forward-fix migrations.
- Restore from backup only after confirming acceptable data loss and business impact.

## Provider Rollback

Paystack:

- Revert dashboard callback/webhook URLs only if they were changed incorrectly.
- Do not switch live/test keys casually during real customer transactions.

Resend:

- If email causes incidents, set `EMAIL_ENABLED=false` and redeploy/restart backend.

Cloudinary:

- If upload fails, keep existing images serving and pause new product uploads.

## Environment Rollback

- Revert env vars to the previous known-good values in Render/Vercel.
- Restart backend after Render env changes.
- Redeploy frontend after Vercel env changes.
- Never paste secrets into logs or incident chat.

## Emergency Disable Procedures

- Disable emails: `EMAIL_ENABLED=false`.
- Pause new product publishing from admin.
- Temporarily hide test/untrusted products by disabling them in admin.
- If payments are failing, stop marketing traffic and use WhatsApp support updates while investigating.

## What Not To Roll Back Blindly

- Database migrations.
- Payment status records.
- Inventory reservations.
- Webhook event data.
- User/order data.
- Provider dashboard live/test mode.
