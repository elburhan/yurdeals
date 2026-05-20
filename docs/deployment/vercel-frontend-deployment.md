# Vercel Frontend Deployment

This guide prepares the Vite React frontend for Vercel. It does not deploy anything.

## Project Settings

- Framework preset: Vite
- Root directory: `apps/frontend`
- Install command: `npm ci`
- Build command:
  - If building from repo root: `npm run build:shared && npm run build:frontend`
  - If Vercel root is `apps/frontend`: `cd ../.. && npm run build:shared && npm run build:frontend`
- Output directory: `dist`
- Node version: `20.x` or newer

Because this is a workspace app, prefer configuring Vercel from the repo root when possible so `@yurdeals/shared` is built consistently. The repo includes root `vercel.json` settings for repo-root deployments and `apps/frontend/vercel.json` for a frontend-root fallback.

## Environment Variables

Use `docs/deployment/frontend-production-env.example` as the placeholder template.

Required:

- `VITE_API_URL=https://api.yourdomain.com/api/v1`
- `VITE_WHATSAPP_BUSINESS_NUMBER=2348000000000`

The frontend must call the backend API domain, not the frontend domain.

## React Router Rewrite

`apps/frontend/vercel.json` contains:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

This prevents direct visits or refreshes on routes like `/categories/all`, `/blog`, `/orders/track`, and `/payment-return` from returning a Vercel 404.

## Domain Setup

Recommended:

- Primary frontend: `https://www.yourdomain.com`
- Apex redirect: `https://yourdomain.com` to `https://www.yourdomain.com`
- Backend API: `https://api.yourdomain.com` or Render URL during soft launch

After final domain selection, update backend:

- `FRONTEND_URL`
- `CORS_ORIGIN`
- Paystack dashboard callback/webhook settings where applicable

## Troubleshooting

- Shared package cannot resolve: confirm Vercel install/build commands run from repo root or explicitly `cd ../..` before building.
- Build output missing: confirm output directory is `apps/frontend/dist` for repo-root projects or `dist` for `apps/frontend` root projects.
- API calls fail with CORS: backend `CORS_ORIGIN` does not match the Vercel URL.
- Login does not persist: backend cookies are blocked; check HTTPS and `COOKIE_SAME_SITE`.
- Refreshing a route 404s: confirm `apps/frontend/vercel.json` is included in the Vercel project.
- Wrong backend target: verify `VITE_API_URL` in Vercel environment variables and redeploy.
