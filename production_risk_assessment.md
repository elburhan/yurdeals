# YurDeals — Production Failure Risk Assessment

> **Auditor Perspective:** Senior SRE + E-commerce Architect, 10+ years in African/emerging market launches.
> **Date:** 2026-05-18 | **Codebase Audit:** Complete (backend, frontend, infra, schema, payments, security)

---

## 🔴 TOP 10 MOST DANGEROUS RISKS (Priority Order)

### 1. No Automated Database Backups or Disaster Recovery Plan
| | |
|---|---|
| **Likelihood** | **HIGH** |
| **Impact** | **CRITICAL** |
| **Why here** | Render Starter plan. No backup strategy visible. A single `prisma migrate deploy` gone wrong, an accidental `DELETE`, or a Render infrastructure issue wipes all orders, payments, and user data. In a preorder model, you hold customer money for weeks — losing records means you can't prove who paid what. |
| **Fix** | Enable Render managed PostgreSQL daily backups (or move to a managed DB with point-in-time recovery like Supabase/Neon). Add a nightly `pg_dump` cron to S3/R2. Test restore procedure before launch. Document RTO/RPO targets. |

---

### 2. Rate Limiter Uses In-Memory Store — Resets on Every Deploy
| | |
|---|---|
| **Likelihood** | **HIGH** |
| **Impact** | **HIGH** |
| **Why here** | `express-rate-limit` defaults to `MemoryStore`. Every Render redeploy (auto-deploy on push) resets all rate limit counters to zero. Attackers can trigger deploys or simply wait. Auth rate limits (login brute-force, signup spam, OTP brute-force) become ineffective. Nigeria is a high-fraud market — this is exploitable day one. |
| **Fix** | Add `rate-limit-redis` or `rate-limit-postgresql` store. Use Render's Redis add-on or Upstash. This is a **launch blocker**. |

---

### 3. No Persistent Session / Refresh Token Revocation
| | |
|---|---|
| **Likelihood** | **MEDIUM** |
| **Impact** | **CRITICAL** |
| **Why here** | Refresh tokens are stateless JWTs with 7-day expiry. There is no server-side session table or token revocation list. If a user's account is compromised, you cannot invalidate their refresh token. An attacker who steals a refresh token has 7 days of access. `authSecurity.service.ts` login lockout also uses in-memory maps — resets on deploy. |
| **Fix** | Add a `sessions` table or Redis-backed token store. Implement token revocation on password change and logout. Store refresh token hash in DB, validate on use. |

---

### 4. Webhook Endpoint Publicly Discoverable + No IP Allowlisting
| | |
|---|---|
| **Likelihood** | **MEDIUM** |
| **Impact** | **CRITICAL** |
| **Why here** | Three separate webhook routes are mounted (`/payments/paystack/webhook`, `/webhooks/paystack`, `/payments/webhooks`). HMAC signature verification is solid, but the duplicate routes increase attack surface. No IP allowlisting for Paystack's known webhook IPs. A sophisticated attacker with a valid signature from a compromised test key could hit production. |
| **Fix** | Consolidate to one webhook endpoint. Add Paystack IP allowlist middleware (Paystack publishes their IPs). Log and alert on signature failures. |

---

### 5. No External Monitoring, Alerting, or APM
| | |
|---|---|
| **Likelihood** | **HIGH** |
| **Impact** | **HIGH** |
| **Why here** | Logger writes to `console.*` only. No Sentry, no Datadog, no uptime monitoring, no PagerDuty. Render logs are ephemeral. You will not know when: the server crashes at 2am, Paystack webhooks start failing, database connections pool exhausts, or a payment gets stuck in PENDING forever. In a preorder model with money held, silent failures = chargebacks + lost trust. |
| **Fix** | Add Sentry for error tracking (free tier sufficient), BetterUptime/UptimeRobot for health endpoint monitoring, and a Slack/Discord webhook for critical payment events. This is a **launch blocker**. |

---

### 6. Payment Reconciliation Has No Automated Schedule
| | |
|---|---|
| **Likelihood** | **HIGH** |
| **Impact** | **HIGH** |
| **Why here** | `paymentReconciliation.service.ts` exists and is well-written, but it only runs via `npm run payments:reconcile` — a manual CLI script. No cron job, no scheduled task. In Nigeria, Paystack webhooks can be delayed by hours or fail silently. Without automated reconciliation, payments will get stuck as PENDING, customers will pay but see "unpaid" orders, and you'll get WhatsApp complaints flooding in. |
| **Fix** | Add a cron endpoint (protected by a secret header) called by Render Cron Jobs or an external cron service (cron-job.org) every 15 minutes. Also schedule `reservations:expire` the same way. |

---

### 7. No FX Rate Locking / Price Volatility Protection
| | |
|---|---|
| **Likelihood** | **HIGH** |
| **Impact** | **HIGH** |
| **Why here** | Products have `fxRateSnapshot` and `fxAdjustmentPercent` fields, but there's no automated FX rate update mechanism. The Naira is extremely volatile (NGN/CNY can swing 5-15% in a week). Preorders are placed weeks before procurement. If you price at ₦850/CNY and the rate moves to ₦950/CNY before you buy from China, you absorb the loss on every order. With preorder batches, this could be tens of thousands in losses. |
| **Fix** | Build an admin FX rate update flow that recalculates preorder prices. Add a `priceLockedAt` timestamp. Consider adding an FX buffer of 5-10% to preorder prices. Alert admin when rates move >3% from snapshot. |

---

### 8. Guest Checkout Creates Phantom Users — Data Integrity Risk
| | |
|---|---|
| **Likelihood** | **MEDIUM** |
| **Impact** | **HIGH** |
| **Why here** | Guest orders create a real `User` record with a `phone_XXXXX@phone.yurdeals.local` email. These phantom users accumulate in the database, can't receive real emails, and create ambiguity in admin dashboards. If a guest later registers with their real email, they have two accounts with no order history link. The `.local` email domain is correctly filtered from Paystack/email delivery, but the user record itself creates operational confusion. |
| **Fix** | Add a `isGuest` flag to the User model. Build a guest-to-registered account merge flow. Add admin filtering to exclude ghost users from user counts/reports. |

---

### 9. Single-Instance Render Starter Plan — Zero Redundancy
| | |
|---|---|
| **Likelihood** | **MEDIUM** |
| **Impact** | **HIGH** |
| **Why here** | `render.yaml` specifies `plan: starter`. This means: single instance, no auto-scaling, cold starts after inactivity (Render spins down free/starter services), and zero redundancy. A single OOM error, a memory leak in the payment flow, or a Render region outage takes the entire platform offline. Customers in Nigeria already distrust online shopping — any downtime during a payment flow means a lost customer forever. |
| **Fix** | Upgrade to at least Render Standard plan for always-on. Consider adding a second region or a CDN (Cloudflare) in front. Set Render health check to `/api/v1/health` (already configured — good). |

---

### 10. No Email Delivery in Production (`EMAIL_ENABLED=false`)
| | |
|---|---|
| **Likelihood** | **HIGH** |
| **Impact** | **HIGH** |
| **Why here** | `render.yaml` has `EMAIL_ENABLED: false`. Order confirmations, payment receipts, OTP codes — none will be delivered. For a preorder model where customers wait weeks, email is the primary trust-building channel. Without it, customers will assume they've been scammed. WhatsApp support will be overwhelmed. |
| **Fix** | Set `EMAIL_ENABLED=true` in Render env vars. Verify Resend API key is set. Verify domain DNS (SPF/DKIM) for `yurdeals.com` to avoid spam folders. Send test emails before launch. **Launch blocker**. |

---

## FULL RISK CATALOG BY CATEGORY

---

## A. Infrastructure & Deployment

| # | Risk | Likelihood | Impact | Specific Cause | Mitigation |
|---|---|---|---|---|---|
| A1 | **Render cold starts** lose first customers | High | Medium | Starter plan spins down after inactivity. First request after idle takes 10-30s. Nigerian users on slow 3G will abandon. | Upgrade plan or add a keep-alive ping every 5 min. |
| A2 | **Deploy-time downtime** during payment flows | Medium | High | `preDeployCommand` runs migrations synchronously. Long migrations lock tables. Users mid-checkout get 500s. | Use zero-downtime migration patterns. Add a maintenance mode toggle. |
| A3 | **No staging environment** | High | High | Only one Render service defined. All changes go straight to production. A bad migration or broken route hits real customers. | Add a `yurdeals-backend-staging` service in `render.yaml`. |
| A4 | **10MB JSON body limit** is too generous | Low | Medium | `express.json({ limit: '10mb' })` allows large payloads that could OOM the single-instance server. | Reduce to 1MB for API, keep 2MB only for webhook routes. |
| A5 | **No CDN for frontend** | Medium | Medium | Vercel handles this well, but if CORS or cookie issues arise between Vercel frontend and Render backend on different domains, auth breaks. | Test cross-origin cookie flow end-to-end with production domains before launch. |

---

## B. Database & Data Integrity

| # | Risk | Likelihood | Impact | Specific Cause | Mitigation |
|---|---|---|---|---|---|
| B1 | **No connection pooling config** | Medium | High | `database.ts` creates PrismaClient with no `connection_limit`. Default is 10 for Prisma. Under load, connections exhaust. | Add `connection_limit=5&pool_timeout=10` to DATABASE_URL. Consider PgBouncer. |
| B2 | **Decimal precision drift** | Low | High | Prices use `Decimal(12,2)` but JS `Number` conversions happen in payment service (`Number(order.total)`). Floating-point rounding on large NGN amounts (₦999,999.99) could cause kobo mismatches with Paystack. | Use `Decimal.toNumber()` carefully or keep as string until final kobo conversion. Add reconciliation amount tolerance. |
| B3 | **No soft-delete for users** (AGENTS.md says required) | Medium | Medium | Users have `isActive` flag but `onDelete: Cascade` on addresses, carts, wishlists. Deactivating a user doesn't cascade. Deleting one does — losing order history references. | Remove cascade deletes on User relations. Implement true soft-delete. |
| B4 | **Audit log grows unbounded** | Medium | Low | Every payment event, webhook, risk evaluation, order action writes to `audit_logs` and `payment_events`. No TTL, no archival. After months, tables become multi-GB, slowing queries. | Add a monthly archival job. Partition by date. Add `createdAt` index (already exists on payment_events). |
| B5 | **No unique index on Order.orderNumber generation** race | Low | High | If order number generation isn't truly unique under concurrent requests, duplicate order numbers could cause confusion. | Verify order number generation uses DB sequence or CUID. Add a retry on unique constraint violation. |

---

## C. Payment & Financial Risks

| # | Risk | Likelihood | Impact | Specific Cause | Mitigation |
|---|---|---|---|---|---|
| C1 | **Double-charge on webhook + verify race** | Low | Critical | Both `verifyPaymentReturn` (callback redirect) and `handlePaymentWebhook` can run concurrently for the same payment. If both try to confirm inventory reservations simultaneously, double-decrement is possible. | The `processWebhookEvent` uses `duplicate` detection — verify it uses DB-level locking (SELECT FOR UPDATE) not just application-level checks. |
| C2 | **No refund flow implemented** | High | Critical | `PaymentStatus.REFUNDED` exists in enum but no refund API endpoint or Paystack refund integration. When a preorder campaign is cancelled, there's no automated way to return money. Manual Paystack dashboard refunds don't update your DB. | Build a refund service before handling real money. Integrate Paystack's `/refund` API. |
| C3 | **Inventory reservation expiry has no cron** | High | High | `reservations:expire` is a manual CLI script. Expired reservations that aren't cleaned up mean phantom stock decrements — products appear sold out when they're not. | Schedule every 10 minutes via cron. |
| C4 | **Paystack test vs live key confusion** | Medium | Critical | `.env.example` has empty Paystack keys. No validation that keys match the expected environment (test keys start with `sk_test_`, live with `sk_live_`). Deploying with test keys means payments silently succeed in sandbox but never charge real cards. | Add env validation: in production, assert keys start with `sk_live_` and `pk_live_`. |
| C5 | **No payment amount ceiling** | Medium | High | No maximum order total enforced. A fraudster could create a ₦10M order, pay with a stolen card, then request delivery before the chargeback hits. | Add `RISK_EXTREME_ORDER_TOTAL_NGN` as a hard block (not just a flag). Currently it only flags — doesn't prevent. |

---

## D. Scalability & Performance

| # | Risk | Likelihood | Impact | Specific Cause | Mitigation |
|---|---|---|---|---|---|
| D1 | **N+1 queries in product listings** | Medium | Medium | Repository layer uses nested `include` patterns. Product list with images, variants, campaigns can generate many queries per page load. | Add query logging in staging. Use Prisma's `relationLoadStrategy: 'join'` where available. |
| D2 | **No response caching** | High | Medium | Every catalog browse, category list, and blog page hits the database. Nigerian users on metered data will experience slow loads. | Add `Cache-Control` headers for public catalog endpoints. Consider Redis caching for hot paths. |
| D3 | **Full-text search without dedicated engine** | Medium | Low | Using Prisma's `fullTextSearch` preview feature on PostgreSQL. Works for small catalogs but degrades with >1000 products. | Acceptable for launch. Plan migration to Meilisearch/Typesense when catalog grows. |
| D4 | **Synchronous file I/O in logger** | Medium | Medium | `fs.appendFileSync` in `writeToDailyLogFile` blocks the event loop on every log write when `LOG_TO_FILE=true`. Under load, this serializes all request handling. | Switch to async `fs.appendFile` or use a write stream. Or rely solely on stdout (Render captures it). |

---

## E. Security & Fraud

| # | Risk | Likelihood | Impact | Specific Cause | Mitigation |
|---|---|---|---|---|---|
| E1 | **Guest checkout fraud** | High | Critical | Guest checkout requires only name, email, phone, and address — no account verification. Fraudsters can use stolen cards with fake details. The fraud risk service flags but doesn't block guest orders above threshold — it only sets `holdForManualReview`. | Add hard blocks for guests above ₦150K. Require phone OTP verification for guest checkout. Add device fingerprinting. |
| E2 | **No CSRF protection** | Medium | High | `COOKIE_SAME_SITE: none` in production (render.yaml). Cross-origin cookies with `SameSite=none` without CSRF tokens mean any malicious site can make authenticated requests on behalf of logged-in users. | Add CSRF token middleware (e.g., `csurf` or custom double-submit cookie pattern). Or use `SameSite=lax` if frontend and backend share a domain. |
| E3 | **Account enumeration via registration** | Medium | Medium | Registration returns `409 ACCOUNT_TAKEN` with message "An account with this email or phone already exists". Attackers can enumerate which phone numbers have accounts. | Return generic "Registration failed" message. Send email/SMS to existing account instead. |
| E4 | **No request body size limit per route** | Low | Medium | Global 10MB limit applies to all routes. An attacker could POST 10MB to `/api/v1/auth/login` repeatedly. | Add per-route body size limits. Auth routes should accept max 1KB. |
| E5 | **Disposable email list is too small** | High | Medium | Only 11 domains in `DISPOSABLE_EMAIL_DOMAINS`. There are 50,000+ disposable email domains. | Use a maintained npm package like `disposable-email-domains` or an API like `kickbox.com`. |
| E6 | **Admin routes skip global rate limiter** | Medium | High | `globalRateLimiter` has `skip: (req) => req.path.startsWith('/api/v1/admin')`. If admin auth is compromised, there's no rate limit on admin actions. | Apply `adminRateLimiter` explicitly (already exists and is used — verify all admin routes use it). |

---

## F. User Experience & Conversion

| # | Risk | Likelihood | Impact | Specific Cause | Mitigation |
|---|---|---|---|---|---|
| F1 | **Payment redirect UX on mobile** | High | High | Paystack's `authorization_url` redirects user to Paystack's hosted page. On slow Nigerian 3G, this redirect chain (your site → Paystack → bank OTP → Paystack → your callback → your frontend) can take 30-60 seconds. Users will close the browser thinking it's broken. | Add a "Processing payment, please wait..." interstitial. Use Paystack Inline (popup) instead of redirect for better mobile UX. |
| F2 | **No order status page for guests** | Medium | High | Guest order access requires the `guestAccessToken` from the original checkout response. If the user closes the browser or clears history, they lose access to their order forever. They can't check status, can't see tracking. | Send order status link via SMS (not just email). Add a "Track by order number + phone" public lookup. |
| F3 | **Preorder trust deficit** | High | High | Nigerian consumers are deeply skeptical of paying upfront for items that don't exist yet. No escrow, no money-back guarantee mechanism, no estimated delivery countdown on the frontend. | Add prominent trust badges, refund policy, estimated delivery dates, and a progress bar showing preorder campaign status. |
| F4 | **No WhatsApp integration** | Medium | Medium | WhatsApp is the primary communication channel in Nigeria. No WhatsApp Business API integration for order updates, support, or checkout assistance. | Add WhatsApp click-to-chat on order confirmation. Consider WhatsApp Business API for order notifications. |

---

## G. Operational & Support

| # | Risk | Likelihood | Impact | Specific Cause | Mitigation |
|---|---|---|---|---|---|
| G1 | **No admin notification for high-risk orders** | High | High | `holdForManualReview` is set but no push notification/email goes to admin. Orders sit in review queue unseen for days. | Add email/Slack alert to admin when `holdForManualReview` is set. |
| G2 | **No customer support channel** | High | Medium | No ticketing system, no live chat, no support email workflow. Nigerian customers will flood WhatsApp/Instagram with order issues. | Set up a shared inbox (Freshdesk free tier) or at minimum a dedicated support email with auto-responders. |
| G3 | **No order lifecycle documentation** | Medium | Medium | Complex state machine (PENDING → PAID → PROCESSING → INSPECTION → SHIPPED → IN_TRANSIT → DELIVERED) with no visual documentation. Staff won't know which transitions are valid. | Create an order state diagram. Add admin UI tooltips explaining each status. |

---

## H. Legal, Compliance & Regulatory (Nigeria)

| # | Risk | Likelihood | Impact | Specific Cause | Mitigation |
|---|---|---|---|---|---|
| H1 | **No NDPR/NDPA privacy policy** | High | High | Nigeria Data Protection Regulation (now NDPA 2023) requires a privacy policy, data processing consent, and a Data Protection Officer for commercial data processors. No privacy policy page exists. | Draft and publish a privacy policy. Add consent checkbox at registration. Appoint a DPO (can be you initially). |
| H2 | **No Terms of Service / refund policy** | High | High | Consumer Protection Council (CPC) requires clear refund/return policies. Preorder model especially needs explicit terms about cancellation, FX risk, and delivery timelines. | Draft ToS covering: preorder terms, refund conditions, delivery estimates, FX disclaimers. |
| H3 | **CBN e-commerce regulations** | Medium | Medium | Central Bank of Nigeria regulations on online payments require proper business registration, CAC certificate, and compliance with payment processing guidelines. | Ensure business is CAC-registered. Verify Paystack business verification is complete (not just test mode). |
| H4 | **Import duty / customs liability undisclosed** | High | Medium | China-to-Nigeria imports attract customs duties (5-35% depending on category). If prices don't include duties, customers get hit with unexpected charges at delivery. | Clearly state whether prices include customs duties. Build duty estimation into pricing. |

---

## I. Third-Party Dependencies

| # | Risk | Likelihood | Impact | Specific Cause | Mitigation |
|---|---|---|---|---|---|
| I1 | **Paystack downtime** | Medium | Critical | Paystack has had multiple multi-hour outages in the past. When Paystack is down, zero payments can be processed. No fallback. Flutterwave is configured but `isFlutterwaveEnabled` defaults to disabled. | Enable Flutterwave as a fallback. Add a gateway health check. Add bank transfer as manual fallback. |
| I2 | **Cloudinary single point of failure** | Medium | High | All product images hosted on Cloudinary. If Cloudinary is down or rate-limits you, the entire catalog shows broken images. | Cache image URLs. Consider a CDN proxy (Cloudflare) in front of Cloudinary. Have a fallback placeholder image. |
| I3 | **Resend email deliverability** | Medium | Medium | Resend is relatively new. Nigerian email providers (Yahoo, Gmail) may flag emails from new sending domains. OTP emails landing in spam = users can't verify accounts. | Set up SPF, DKIM, DMARC for `yurdeals.com`. Send a warm-up batch before launch. Monitor bounce rates. |
| I4 | **No dependency vulnerability scanning** | High | Medium | No `npm audit` in CI/CD. Express 4.19 and dependencies may have known CVEs. | Add `npm audit --production` to build pipeline. Set up Dependabot or Snyk. |

---

## J. Monitoring & Observability Gaps

| # | Risk | Likelihood | Impact | Specific Cause | Mitigation |
|---|---|---|---|---|---|
| J1 | **No structured log aggregation** | High | High | Logs go to `console.*`. Render retains logs for a limited time. No search, no alerting, no dashboards. Debugging a payment issue from 3 days ago is impossible. | Add Logtail, Papertrail, or Axiom (all have free tiers that work with Render). |
| J2 | **No payment-specific dashboard** | High | High | No way to see: total payments today, failed payment rate, average order value, reconciliation status. You're flying blind with real money. | Build an admin dashboard widget showing payment stats. Or use Paystack's dashboard + custom alerts. |
| J3 | **Health check doesn't cover critical deps** | Medium | Medium | `/api/v1/health` only checks database. Doesn't check Paystack API reachability, Cloudinary, or Resend. | Add dependency health checks (with caching to avoid rate limits). |
| J4 | **No performance metrics** | High | Medium | No response time tracking, no p95/p99 latency, no request volume metrics. You won't know if the site is slow until customers complain. | Add `response-time` middleware logging. Consider a lightweight APM. |

---

## K. Team/Process Risks

| # | Risk | Likelihood | Impact | Specific Cause | Mitigation |
|---|---|---|---|---|---|
| K1 | **Solo developer / single point of failure** | High | Critical | If you're incapacitated, no one can fix a production payment bug, deploy a hotfix, or access Render/Paystack dashboards. | Document all access credentials in a secure vault (1Password/Bitwarden). Write a runbook for common ops tasks. Share access with a trusted backup person. |
| K2 | **No incident response plan** | High | High | When (not if) something breaks at 2am on a Friday, there's no documented procedure for: who to contact, how to rollback, how to pause payments, how to communicate with affected customers. | Write a 1-page incident response runbook. Include Render rollback steps, Paystack dashboard pause, and customer communication templates. |
| K3 | **No automated tests** | High | High | No test files visible in the codebase beyond Playwright config. Payment logic, order creation, fraud detection — all untested. A refactor could silently break payment webhook processing. | Add critical-path tests: payment webhook handler, order creation transaction, fraud risk evaluation. Even 10 tests covering money flows is better than zero. |

---

## 📊 LAUNCH READINESS SCORE

# 5.5 / 10

> **Verdict: NOT READY for real money.** The codebase is architecturally sound — well-structured, good separation of concerns, proper Paystack signature verification, solid fraud risk framework, and good use of Prisma transactions. But the operational infrastructure (monitoring, backups, cron jobs, rate limiter persistence, email delivery) has critical gaps that will cause real financial losses and customer trust damage within the first week.

---

## 🚨 TOP 5 MUST-FIX BEFORE GOING LIVE

| Priority | Item | Effort | Why It's Blocking |
|---|---|---|---|
| **1** | **Enable email delivery** — Set `EMAIL_ENABLED=true`, configure Resend API key, verify domain DNS (SPF/DKIM) | 2 hours | Without emails, no OTPs, no order confirmations, no payment receipts. Customers will think they've been scammed. |
| **2** | **Add persistent rate limiter store** (Redis/PostgreSQL) | 3 hours | In-memory rate limits reset on every deploy. Login brute-force, OTP brute-force, and signup spam are wide open. |
| **3** | **Set up monitoring + alerting** — Sentry for errors, UptimeRobot for health, Slack webhook for payment events | 3 hours | You will not know when things break. Payment failures will go unnoticed for hours/days. |
| **4** | **Schedule payment reconciliation + reservation expiry crons** | 2 hours | Payments stuck in PENDING forever. Inventory showing sold-out when it's not. Both services exist but aren't automated. |
| **5** | **Validate Paystack live keys + test full payment flow end-to-end** on production domain | 2 hours | Callback URL, webhook URL, CORS origin, cookie domain — any mismatch between dev and prod config will silently break payments. |

> **Total estimated effort for launch-critical fixes: ~12 hours of focused work.**

### Honorable Mentions (Fix Within First Week)
- Database backup strategy
- CSRF protection (or switch `SameSite` to `lax` with shared domain)
- Privacy policy + Terms of Service pages
- Admin alerts for high-risk orders
- Refund flow (before any preorder campaign ends)
