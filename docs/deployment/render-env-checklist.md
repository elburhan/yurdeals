# Render Environment Setup Checklist

Use `docs/deployment/backend-production-env.example` as the source template.

| Variable | Where to obtain it | Required | Production example format | Restart needed |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | PostgreSQL provider pooled runtime URL | Yes | `postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public&connection_limit=5&sslmode=require` | Yes |
| `NODE_ENV` | Fixed value | Yes | `production` | Yes |
| `PORT` | Render or app default | Yes | `4000` | Yes |
| `API_VERSION` | App config | Yes | `v1` | Yes |
| `FRONTEND_URL` | Vercel frontend domain | Yes | `https://www.yourdomain.com` | Yes |
| `CORS_ORIGIN` | Approved frontend origins | Yes | `https://www.yourdomain.com,https://yourdomain.com` | Yes |
| `JWT_SECRET` | Generated secret | Yes | 64+ random chars | Yes |
| `JWT_ACCESS_EXPIRES_IN_SECONDS` | App policy | Yes | `900` | Yes |
| `JWT_REFRESH_EXPIRES_IN_SECONDS` | App policy | Yes | `604800` | Yes |
| `COOKIE_SECRET` | Generated secret | Yes | 64+ random chars | Yes |
| `COOKIE_SAME_SITE` | Domain architecture | Yes | `none` for Render+Vercel, `lax` for same-site custom domains | Yes |
| `RATE_LIMIT_WINDOW_MS` | App policy | Yes | `60000` | Yes |
| `RATE_LIMIT_MAX_REQUESTS` | App policy | Yes | `300` | Yes |
| `AUTH_RATE_LIMIT_WINDOW_MS` | App policy | Yes | `60000` | Yes |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | App policy | Yes | `100` | Yes |
| `ORDER_RATE_LIMIT_WINDOW_MS` | App policy | Yes | `60000` | Yes |
| `ORDER_RATE_LIMIT_MAX_REQUESTS` | App policy | Yes | `60` | Yes |
| `PAYMENT_RATE_LIMIT_WINDOW_MS` | App policy | Yes | `60000` | Yes |
| `PAYMENT_RATE_LIMIT_MAX_REQUESTS` | App policy | Yes | `60` | Yes |
| `ADMIN_RATE_LIMIT_WINDOW_MS` | App policy | Yes | `60000` | Yes |
| `ADMIN_RATE_LIMIT_MAX_REQUESTS` | App policy | Yes | `600` | Yes |
| `WEBHOOK_RATE_LIMIT_WINDOW_MS` | App policy | Yes | `60000` | Yes |
| `WEBHOOK_RATE_LIMIT_MAX_REQUESTS` | App policy | Yes | `600` | Yes |
| `PAYSTACK_SECRET_KEY` | Paystack dashboard | Yes | `sk_live_...` | Yes |
| `PAYSTACK_PUBLIC_KEY` | Paystack dashboard | Yes | `pk_live_...` | Yes |
| `PAYSTACK_CALLBACK_URL` | Backend domain | Yes | `https://api.yourdomain.com/payment-return` | Yes |
| `FLUTTERWAVE_SECRET_KEY` | Flutterwave dashboard if enabled | Optional | leave empty unless enabling Flutterwave | Yes |
| `FLUTTERWAVE_PUBLIC_KEY` | Flutterwave dashboard if enabled | Optional | leave empty unless enabling Flutterwave | Yes |
| `FLUTTERWAVE_WEBHOOK_SECRET_HASH` | Flutterwave dashboard if enabled | Optional | leave empty unless enabling Flutterwave | Yes |
| `FLUTTERWAVE_CALLBACK_URL` | Backend domain if enabled | Optional | leave empty unless enabling Flutterwave | Yes |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary dashboard | Yes | `your_cloud_name` | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary dashboard | Yes | numeric/string key | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary dashboard | Yes | secret value | Yes |
| `EMAIL_ENABLED` | Launch decision | Yes | `true` after Resend verified | Yes |
| `RESEND_API_KEY` | Resend dashboard | Yes if email enabled | `re_...` | Yes |
| `EMAIL_FROM` | Verified sender | Yes | `YurDeals <orders@yourdomain.com>` | Yes |
| `EMAIL_REPLY_TO` | Support inbox | Yes | `support@yourdomain.com` | Yes |
| `SEED_ADMIN_EMAIL` | Admin bootstrap decision | Optional | `admin@yourdomain.com` | No runtime dependency after seed |
| `SEED_ADMIN_PASSWORD` | Password manager | Optional | one-time strong password | No runtime dependency after seed |

## Flutterwave Optionality

Flutterwave remains supported but is disabled when all `FLUTTERWAVE_*` vars are empty. If any Flutterwave env var is set, all four must be set or backend startup fails with a clear configuration error.

## Database Pooling Note

- Prefer the pooled runtime URL from Render, Neon, Supabase, or PgBouncer when available.
- Keep the connection limit conservative at first, such as `connection_limit=5`.
- If your provider also gives a direct non-pooled URL, reserve that for migrations or maintenance only when the provider recommends it.
