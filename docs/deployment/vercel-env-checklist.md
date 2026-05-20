# Vercel Environment Setup Checklist

Use `docs/deployment/frontend-production-env.example` as the source template.

| Variable | Where to obtain it | Required | Production example format | Redeploy needed |
| --- | --- | --- | --- | --- |
| `VITE_API_URL` | Render/backend API domain | Yes | `https://api.yourdomain.com/api/v1` | Yes |
| `VITE_WHATSAPP_BUSINESS_NUMBER` | Business WhatsApp account | Yes | `2348000000000` | Yes |

## Domain Settings

- Add the production domain in Vercel.
- Prefer `https://www.yourdomain.com` as canonical.
- Redirect apex `https://yourdomain.com` to `https://www.yourdomain.com` if using both.
- Add all final frontend origins to backend `CORS_ORIGIN`.
- Set backend `FRONTEND_URL` to the canonical Vercel frontend URL.

## Verification

- Confirm DNS is valid in Vercel.
- Confirm the app loads at the production domain.
- Confirm direct route refresh works for `/categories/all`.
- Confirm API calls hit `VITE_API_URL`, not localhost.
- Redeploy after every Vercel env var change.

## Troubleshooting

- Frontend loads but API fails: check `VITE_API_URL` and backend `CORS_ORIGIN`.
- Login does not persist: check backend cookie settings and HTTPS.
- Direct route refresh fails: confirm `apps/frontend/vercel.json` is included.
