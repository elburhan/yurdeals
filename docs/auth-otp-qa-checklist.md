# Auth + OTP QA Checklist

This checklist covers the current Yurdeals auth flow:

- signup
- OTP verification
- OTP resend
- login
- auth hardening behavior

It is intentionally lightweight and manual-first so we can catch regressions before layering on a full automated test suite.

## Current test posture

- There is no active backend auth test framework wired into package scripts today.
- Playwright is installed at the repo root, but there are no committed auth-specific browser tests or test scripts for this flow.
- OTP codes are hashed in the database and cannot be recovered from Prisma/Postgres directly.
- In development only, the backend now exposes a helper endpoint to inspect the latest OTP held in in-memory notification capture:
  - `GET /api/v1/auth/dev/latest-otp`
- This helper is disabled outside `NODE_ENV=development`.

## Environment assumptions

- Backend running locally:
  - `npm run dev:backend`
- Frontend running locally:
  - `npm run dev:frontend`
- Development mode:
  - `NODE_ENV=development`
- Playwright browsers installed locally:
  - `npx playwright install`

## Dev-only OTP inspection helper

Use this only for local/dev QA. It is not available in production.

### Lookup by verification session

```bash
curl "http://localhost:4000/api/v1/auth/dev/latest-otp?verificationSessionId=YOUR_SESSION_ID"
```

### Lookup by identifier + channel

```bash
curl "http://localhost:4000/api/v1/auth/dev/latest-otp?identifier=you@example.com&channel=EMAIL"
```

```bash
curl "http://localhost:4000/api/v1/auth/dev/latest-otp?identifier=%2B2348012345678&channel=PHONE"
```

Expected response:

```json
{
  "success": true,
  "data": {
    "verification": {
      "verificationSessionId": "session-id",
      "channel": "EMAIL",
      "code": "123456",
      "expiresInSeconds": 600,
      "createdAt": "2026-05-09T12:00:00.000Z",
      "verificationTarget": "yo***@example.com"
    }
  },
  "message": "[DEV ONLY] Latest verification code retrieved"
}
```

## API smoke examples

### Register

```bash
curl -X POST "http://localhost:4000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ada Nwosu",
    "email": "ada@example.com",
    "phone": "+2348012345678",
    "password": "StrongPass1"
  }'
```

### Verify OTP

```bash
curl -X POST "http://localhost:4000/api/v1/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d '{
    "verificationSessionId": "YOUR_SESSION_ID",
    "channel": "EMAIL",
    "otp": "123456"
  }'
```

### Resend OTP

```bash
curl -X POST "http://localhost:4000/api/v1/auth/resend-otp" \
  -H "Content-Type: application/json" \
  -d '{
    "verificationSessionId": "YOUR_SESSION_ID",
    "channel": "EMAIL"
  }'
```

### Login

```bash
curl -X POST "http://localhost:4000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "ada@example.com",
    "password": "StrongPass1"
  }'
```

## Frontend flow checklist

### Signup → verify route

- Open `/register`
- Create a new account with email + phone + password + confirm password
- Confirm successful signup lands on `/verify-otp`
- Confirm the verification page shows the masked target
- Refresh the page
- Confirm the verification context survives refresh
- Confirm resend countdown survives refresh

### Verify success redirect behavior

- Submit the correct OTP
- If backend returns token:
  - confirm redirect to `/dashboard`
- If backend only confirms verification:
  - confirm redirect to `/login`
  - confirm the success banner appears:
    - `Account verified successfully. Please sign in to continue.`
- Refresh `/login`
- Confirm the banner is gone after refresh

## Manual test scenarios

### Signup

- Email signup succeeds with valid email, phone, and strong password
- Phone-first signup succeeds when email is omitted
- Password mismatch blocks submit on frontend
- Duplicate account returns safe backend error
- Malformed email is rejected
- Malformed phone is rejected
- Weak password is rejected
- Unexpected extra payload fields are rejected
- Repeated signup attempts hit rate limit

### OTP verification

- Correct OTP verifies successfully
- Wrong OTP shows failure
- Expired OTP fails
- Reused OTP fails after success
- Too many wrong OTP attempts eventually block and invalidate the code
- Old OTP fails after resend
- Missing verification context on frontend redirects back to signup
- Verify with malformed OTP format fails validation

### Resend OTP

- Resend before cooldown is blocked
- Resend after cooldown succeeds
- Max resend limit is enforced
- Frontend countdown disables resend button during cooldown
- Refresh during cooldown preserves countdown state
- Resend with invalid session fails safely

### Login

- Verified user can log in with email
- Verified user can log in with phone
- Wrong password returns generic failure
- Repeated failed logins trigger temporary lockout
- Old phone variants still resolve if account was created under a different phone format

### Security and abuse checks

- No OTP is stored in plaintext in the database
- No password is logged
- No plaintext OTP appears in normal logs
- Development-only OTP helper returns 404 outside development
- Rate limits trigger on repeated signup/login/verify/resend abuse
- Strict schemas reject unknown fields
- Login does not reveal whether an account exists

## Operational log checks

During abuse testing, verify logs contain useful entries like:

- repeated OTP verification failures
- resend cooldown enforcement
- resend limit reached
- login lockout triggered
- route-level rate limit triggered

And verify logs do not contain:

- plaintext password values
- plaintext OTP values

## Suggested future automated tests

There is now one lightweight Playwright smoke test for the happy path:

```bash
npm run test:e2e:auth
```

It expects:

- frontend running at `http://localhost:5173`
- backend running at `http://localhost:4000`
- development mode enabled so the dev OTP helper route is available

Environment overrides are supported:

```bash
PLAYWRIGHT_FRONTEND_URL=http://localhost:5173 PLAYWRIGHT_BACKEND_URL=http://localhost:4000/api/v1 npm run test:e2e:auth
```

The test covers:

- open `/register`
- create a unique user
- confirm redirect to `/verify-otp`
- retrieve OTP from `GET /api/v1/auth/dev/latest-otp`
- submit OTP
- confirm redirect to `/dashboard` or `/login` with success banner

No automated backend auth unit tests were added in this pass because the repo does not currently have a configured backend auth test runner or test scripts.

Recommended next tests when a test harness is introduced:

- OTP creation stores only hash and metadata
- correct OTP verifies successfully
- wrong OTP increments attempts
- expired OTP is rejected
- consumed OTP cannot be reused
- resend invalidates prior OTP
- login lockout triggers after repeated failures
- auth schemas reject unexpected fields
