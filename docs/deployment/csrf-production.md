# CSRF Production Guide

YurDeals uses HttpOnly auth cookies for browser sessions. When the backend runs on Render and the frontend runs on Vercel, production may require `COOKIE_SAME_SITE=none` so cookies can be sent cross-site. SameSite=None cookies require CSRF protection for browser state-changing requests.

## Strategy

YurDeals uses a signed double-submit CSRF token pattern:

- Backend issues a readable `csrf_token` cookie.
- Backend returns the same token from `GET /api/v1/auth/csrf`.
- Frontend sends the token in `X-CSRF-Token` on unsafe requests.
- Backend validates that the cookie and header match and that the token signature is valid.
- Tokens are signed with `COOKIE_SECRET`.

This protects cookie-authenticated browser requests without storing auth tokens in localStorage.

## Environment

```env
CSRF_ENABLED=true
COOKIE_SAME_SITE=none
```

`CSRF_ENABLED` defaults to `true` in production and `false` outside production when omitted.

Use `CSRF_ENABLED=false` only for controlled local development or emergency debugging. Do not launch production with CSRF disabled when browser auth cookies are active.

## Backend Behavior

CSRF validation applies to unsafe methods:

- `POST`
- `PUT`
- `PATCH`
- `DELETE`

CSRF validation skips safe/preflight methods:

- `GET`
- `HEAD`
- `OPTIONS`

Paystack webhook routes remain exempt because they are mounted before the JSON parser and before the CSRF middleware:

- `/api/v1/payments/paystack/webhook`
- `/api/v1/webhooks/paystack`
- `/api/v1/payments/webhooks/:provider`

Webhook security still depends on provider signature verification, not browser CSRF tokens.

## Frontend Behavior

The frontend API client:

1. Fetches `GET /auth/csrf` before unsafe requests.
2. Caches the returned token in memory.
3. Sends `X-CSRF-Token` on unsafe requests.
4. Keeps `withCredentials=true`.
5. If a request fails with `CSRF_INVALID`, refreshes the token once and retries.

The token is not an auth token. It must not be stored in localStorage.

## CORS Requirements

The backend must allow:

- credentials,
- production frontend origin,
- `X-CSRF-Token` request header.

For Render + Vercel cross-origin deployments:

- `COOKIE_SAME_SITE=none`
- production HTTPS only,
- `CSRF_ENABLED=true`
- exact frontend origin in `CORS_ORIGIN`.

## Verification Checklist

- `GET /api/v1/auth/csrf` returns `{ csrfToken }` and sets `csrf_token`.
- Unsafe request without `X-CSRF-Token` returns `403` with code `CSRF_INVALID`.
- Unsafe request with matching cookie/header succeeds when the user is authorized and request body is valid.
- `GET` requests are unaffected.
- Paystack signed webhook delivery is unaffected.
- Login, register, OTP verification, guest checkout, payment initiation, admin mutations, and notification read actions work through the frontend.

## Troubleshooting

- If all unsafe frontend requests fail with `CSRF_INVALID`, check that `X-CSRF-Token` is allowed by CORS.
- If token fetch works but retry loops, confirm cookies are not blocked by browser SameSite/Secure rules.
- If auth works locally but not production, inspect browser DevTools for blocked cookies and preflight failures.
- If Paystack webhook fails, do not add CSRF headers to Paystack; verify raw-body routing and Paystack signature instead.
