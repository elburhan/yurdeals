# Secret Generation Guide

Do not commit generated secrets. Store production secrets only in Render, Vercel, or the relevant provider dashboard.

## JWT_SECRET

Purpose: signs access and refresh tokens.

Generate a long random value:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Store in Render backend env:

- `JWT_SECRET`

Rotate if exposed. Rotating invalidates existing sessions.

## COOKIE_SECRET

Purpose: signs cookies and guest access HMAC material.

Generate a different long random value:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Store in Render backend env:

- `COOKIE_SECRET`

Do not reuse `JWT_SECRET`.

## Admin Password

Use a password manager to generate a long unique password for:

- `SEED_ADMIN_PASSWORD`

Store only temporarily in Render env for the seed run. Remove or rotate it after confirming admin login.

## Provider Secrets

Render backend env:

- Database: `DATABASE_URL`
- Paystack: `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`
- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- Resend: `RESEND_API_KEY`
- Auth/session: `JWT_SECRET`, `COOKIE_SECRET`

Vercel frontend env:

- `VITE_API_URL`
- `VITE_WHATSAPP_BUSINESS_NUMBER`

Local-only env:

- Development database URLs
- Test provider keys
- Local ngrok URLs

## Rotation Recommendations

- Rotate immediately if a secret was pasted into chat, screenshots, logs, or committed history.
- Rotate Paystack and Cloudinary credentials in the provider dashboard first, then update Render env.
- Rotate Resend API keys if any delivery logs or credentials were exposed.
- After rotating Render env vars, redeploy/restart backend.
- After rotating Vercel env vars, redeploy frontend.
