# Sentry Production Guide

This guide covers backend-only Sentry setup for YurDeals production error monitoring.

## Scope

Sentry is integrated for the backend API and maintenance scripts only. Frontend Sentry is intentionally left for a separate phase.

## Required Dashboard Setup

1. Create or open a Sentry organization.
2. Create a Node.js backend project for YurDeals.
3. Copy the backend project DSN.
4. Store the DSN in Render as `SENTRY_DSN`.
5. Set `SENTRY_ENVIRONMENT=production` in Render.
6. Set `SENTRY_TRACES_SAMPLE_RATE=0.05` in Render for low-volume production tracing.
7. Redeploy or restart the backend.
8. Confirm new backend errors appear in the Sentry Issues view.
9. Configure alert routing for new issues, regressions, and high-frequency errors.

Do not commit the DSN to the repository. Treat it as deployment configuration even though it is not equivalent to a payment or auth secret.

## Environment Variables

```env
SENTRY_DSN=""
SENTRY_ENVIRONMENT="production"
SENTRY_TRACES_SAMPLE_RATE=0.05
```

Sentry is disabled when `SENTRY_DSN` is empty. `SENTRY_TRACES_SAMPLE_RATE` must be a number from `0` to `1`.

## Backend Capture Points

- Express errors are observed after routes and before the existing custom API error response middleware.
- Startup failures are captured and flushed before process exit.
- Uncaught exceptions are observed through a monitor hook without replacing Node's default exception behavior.
- The Sentry Node SDK default integrations cover unhandled promise rejections when Sentry is enabled.
- Payment reconciliation and reservation expiry script failures are captured and flushed before the scripts exit non-zero.

The existing API response envelope and logging behavior remain unchanged.

## Sanitization

The backend keeps `sendDefaultPii=false` and applies a final `beforeSend` scrubber. The scrubber redacts sensitive keys and common token patterns, including:

- passwords and passcodes,
- OTP and verification codes,
- access, refresh, guest, and bearer tokens,
- authorization and cookie headers,
- API keys and provider secrets,
- Paystack and Flutterwave secret-like fields,
- card, CVV, CVC, PAN, access code, and authorization code fields,
- raw body, raw payload, provider payload, and payload fields.

Continue avoiding raw provider payloads in application logs and custom Sentry context.

## Safe Verification

Do not add a public production test-error route.

For staging or local verification only:

1. Set `SENTRY_DSN` to a staging Sentry project DSN.
2. Set `SENTRY_ENVIRONMENT=staging` or `development`.
3. Temporarily trigger an error from a controlled local/staging-only code path.
4. Confirm the event appears in Sentry.
5. Remove the temporary trigger before production deploy.

For maintenance scripts, use a staging database and intentionally invalid provider configuration only in staging if you need to confirm cron failure capture.

## Launch Checklist

- `SENTRY_DSN` is set in Render only.
- `SENTRY_ENVIRONMENT=production`.
- `SENTRY_TRACES_SAMPLE_RATE=0.05`.
- Alerts route to the on-call or launch owner.
- Test errors have been verified in staging, not through a public production route.
- Captured events are checked for accidental secrets or raw payment provider payloads.
