# AGENTS.md — YurDeals Development Rules

> **This file is the single source of truth for all development conventions, rules, and standards for the YurDeals project.**

---

## 🏗️ AI Workflow Rules

### Plan Mode

- **Always enter Plan Mode** before implementing anything non-trivial.
- Present architecture decisions, affected files, and potential risks.
- Wait for approval before writing code.
- For small fixes (typos, single-line changes), proceed directly.

### Execution

- Implement **one logical unit at a time** (one route, one component, one migration).
- Run tests/linters after each unit before proceeding.
- Commit messages follow Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.

---

## ✅ DO

- Use TypeScript `strict` mode everywhere.
- Validate **all** external inputs (request bodies, query params, URL params) with Zod schemas.
- Use Prisma for all database operations — never raw SQL unless absolutely necessary.
- Return standardized API response envelopes (`{ success, data, message, meta }` or `{ success, error }`).
- Use environment variables for **all** secrets and configuration.
- Use `cuid()` for primary keys (Prisma default).
- Handle errors with the centralized `AppError` class.
- Use `httpOnly`, `secure`, `sameSite` for all cookies.
- Rate-limit authentication endpoints aggressively.
- Log structured messages with the `logger` utility.
- Write mobile-first CSS (Tailwind `sm:`, `md:`, `lg:` breakpoints).
- Keep components small, focused, and reusable.
- Use semantic HTML elements (`<main>`, `<nav>`, `<section>`, `<article>`).
- Add proper `aria-*` attributes for accessibility.
- Use `React.lazy()` and `Suspense` for route-level code splitting.

## 🚫 DO NOT

- **Never** use `any` type — use `unknown` + type guards if needed.
- **Never** commit `.env` files or secrets to version control.
- **Never** expose stack traces in production error responses.
- **Never** use `eval()`, `Function()`, or dynamic code execution.
- **Never** trust client-side data without server-side validation.
- **Never** use `innerHTML` or `dangerouslySetInnerHTML` without sanitization.
- **Never** store passwords in plain text — always hash with bcrypt (cost ≥ 12).
- **Never** use `SELECT *` in Prisma queries — always specify `select` or `include`.
- **Never** use synchronous file I/O in request handlers.
- **Never** hardcode URLs, ports, or configuration values.
- **Never** disable TypeScript strict mode or ESLint rules without team approval.
- **Never** push directly to `main` — use feature branches + PR.

---

## 🔒 Security Rules

### Authentication & Authorization

- JWT tokens stored in `httpOnly` cookies (not localStorage).
- Implement role-based access control (CUSTOMER, STAFF, ADMIN).
- Auth middleware must verify JWT + check user `isActive` status.
- Refresh tokens with rotation on every use.

### Input Validation

- All request inputs validated with Zod schemas **before** reaching business logic.
- Sanitize user-generated content (product reviews, messages).
- Parameterize all database queries (Prisma does this by default).

### Headers & Transport

- Helmet enabled with strict CSP on all responses.
- CORS restricted to configured origins only.
- HTTPS required in production (trust proxy + secure cookies).
- `X-Content-Type-Options: nosniff` (Helmet default).
- `X-Frame-Options: DENY` (Helmet default).

### Rate Limiting

- Global: 100 requests per 15 minutes.
- Auth routes: 10 requests per 15 minutes.
- Password reset: 3 requests per hour.

### Data Protection

- Passwords hashed with bcrypt (min cost 12).
- PII encrypted at rest where feasible.
- Audit log all admin actions.
- Soft-delete users — never hard-delete.

---

## 🏛️ Architecture Standards

### Backend

```
apps/backend/src/
├── config/        # Environment, database, app config
├── middleware/     # Express middleware (auth, error, validation)
├── routes/        # Route definitions (thin controllers)
├── services/      # Business logic layer
├── utils/         # Helper functions, logger
└── server.ts      # Entry point
```

- **Routes** are thin — delegate to **services** for business logic.
- **Services** interact with Prisma — routes never call Prisma directly.
- **Middleware** handles cross-cutting concerns (auth, validation, errors).

### Frontend

```
apps/frontend/src/
├── components/    # Reusable UI components
├── pages/         # Route-level page components
├── hooks/         # Custom React hooks
├── lib/           # API client, utilities
├── styles/        # Global CSS, Tailwind layers
└── App.tsx        # Root component
```

- Pages compose components — keep pages thin.
- Use custom hooks for data fetching and state management.
- API calls go through the centralized `api` client.

### Shared Package

```
packages/shared/src/
├── types/         # TypeScript interfaces
├── constants/     # Enums, status codes
└── index.ts       # Barrel export
```

---

## 📐 Coding Standards

### TypeScript

- Strict mode enabled (`strict: true` in tsconfig).
- Prefer `interface` over `type` for object shapes.
- Use `const` assertions for literal types.
- Use discriminated unions for complex state.
- Explicit return types on exported functions.

### Naming Conventions

| Element            | Convention  | Example                      |
| ------------------ | ----------- | ---------------------------- |
| Files (components) | PascalCase  | `ProductCard.tsx`            |
| Files (utilities)  | camelCase   | `formatPrice.ts`             |
| Files (routes)     | camelCase   | `health.ts`                  |
| Variables          | camelCase   | `userId`                     |
| Constants          | UPPER_SNAKE | `MAX_RETRIES`                |
| Types/Interfaces   | PascalCase  | `OrderStatus`                |
| Database tables    | snake_case  | `order_items`                |
| API endpoints      | kebab-case  | `/api/v1/preorder-campaigns` |
| CSS classes        | kebab-case  | `.product-card`              |

### Git

- Branch naming: `feat/`, `fix/`, `chore/`, `docs/` + short description.
- One logical change per commit.
- PR required for all changes to `main`.
- Squash-merge PRs.

---

## ✅ Definition of Done (Template)

A feature/task is **DONE** when:

- [ ] Code compiles with zero TypeScript errors.
- [ ] All inputs validated with Zod schemas.
- [ ] API responses use standard envelope format.
- [ ] Error cases handled with `AppError`.
- [ ] Security headers present on responses.
- [ ] No `any` types in new code.
- [ ] No secrets or credentials in code.
- [ ] ESLint passes with zero warnings.
- [ ] Prettier formatting applied.
- [ ] Mobile-first responsive design verified.
- [ ] Accessibility basics checked (keyboard nav, aria labels).
- [ ] Tested locally with both frontend + backend running.
- [ ] Documented if public API or complex logic.

---

## 📦 Environment Variables

All environment variables must be:

1. Documented in `.env.example` with descriptive comments.
2. Loaded via `config/env.ts` with type validation.
3. **Never** imported directly from `process.env` outside of `config/`.
4. **Never** committed with real values.

---

_Last updated: Phase 1 — Foundation_

---

## Auth Conventions

- Auth endpoints live under `/api/v1/auth` and must use the strict auth rate limiter.
- Browser sessions use `access_token` and `refresh_token` HttpOnly cookies. Do not store JWTs in `localStorage` or `sessionStorage`.
- Access tokens are short-lived. Refresh-token rotation is prepared in middleware; add persisted sessions or a revocation table before implementing multi-device logout.
- API clients may use `Authorization: Bearer <token>` for access-token requests, but browser flows should prefer cookies with `credentials: include`.
- Register accepts `email`, `password`, `name`, and optional `phone`; the backend maps `name` to the existing `firstName` and `lastName` fields.
- User reads must always use a safe Prisma `select` that excludes `passwordHash`.
- Protected routes must use `requireAuth`; role-gated routes must chain `requireRole(['ADMIN'])` or `requireRole(['STAFF', 'ADMIN'])`.
- Logout clears auth cookies. Do not rely on client-side state clearing alone.

---

## Catalog Conventions

- Public catalog routes must not require auth, but all query params and route params must be validated with Zod.
- Catalog routes stay thin and must call services; services call repositories; repositories are the only catalog layer that may call Prisma.
- Product and category queries must filter `isActive: true` and use explicit Prisma `select` payloads.
- Product list responses should stay lightweight and paginated; product detail responses may include images, variants, and active preorder campaigns.
- Product search must sanitize user input before passing it to Prisma filters.
- `available_in_nigeria=true` currently means active LOCAL products with at least one active variant where stock is greater than zero.

---

## Cart Conventions

- Cart routes live under `/api/v1/cart` and must always be protected by `requireAuth`.
- Cart persistence is server-side only; do not store durable cart data in browser storage.
- Cart writes must go through `CartRepository` and use Prisma transactions for add, update, and remove flows.
- Cart items store `priceSnapshot` and `currency` at add time. Increasing an existing line keeps the original price snapshot.
- This phase supports optional `variant_id`; only one cart line per product is allowed, so adding the same product with a different variant should be rejected.
- LOCAL products with active variants require a selected variant so stock can be checked server-side.
- PREORDER products may be added without local stock checks, but product and category must still be active.

---

## Checkout Conventions

- Address and order routes must always be protected by `requireAuth` and validate inputs with Zod.
- Users may only read, update, delete, or select addresses they own.
- Setting a default address must clear other defaults for that user in the same transaction.
- Order creation must run in a single Prisma transaction: verify address ownership, load cart, validate active products and quantities, create order/items, then clear cart items.
- Orders created from cart use cart `priceSnapshot` values for order item prices and start with existing `OrderStatus.PENDING`.
- Do not decrement inventory during order creation until payment/fulfillment reservation rules are defined.

---

## Payment Conventions

- Protected payment endpoints live under `/api/v1/orders/:orderId/payments`; webhook endpoints live under `/api/v1/payments/webhooks/:provider` and must remain public but signature-protected.
- Webhook routes must receive raw request bodies before JSON parsing so provider signatures can be verified against the exact payload.
- Paystack signatures use `x-paystack-signature` with HMAC SHA512 and `PAYSTACK_SECRET_KEY`.
- Flutterwave signatures use `flutterwave-signature` with HMAC SHA256 and `FLUTTERWAVE_WEBHOOK_SECRET_HASH`; transaction details must be verified before confirming payment.
- Never log gateway secrets, card details, or full sensitive provider payloads.
- Webhook payment status updates must be idempotent and transactional. Successful payments set `Payment.status = SUCCESS`, `paidAt = now`, and `Order.status = CONFIRMED`.
- Failed payments set `Payment.status = FAILED` and leave the order `PENDING`.

---

## Tracking, Notifications, and Operations Conventions

- Tracking routes live under `/api/v1/orders/:orderId/tracking` and must enforce order ownership.
- Notification reads live under `/api/v1/notifications` and must only return the authenticated user's notifications.
- Notification creation must be idempotent with an `eventKey` stored in notification JSON data.
- Shipment events must be idempotent by checking the existing `(shipmentId, status)` pair before creating a new `ShipmentEvent`.
- Admin routes live under `/api/v1/admin` and must chain `requireAuth` with `requireRole(['ADMIN'])`.
- Staff routes live under `/api/v1/staff` and must chain `requireAuth` with `requireRole(['STAFF'])`.
- Until migrations are allowed, logistics operations must use only the existing `Shipment` and `ShipmentEvent` models. Do not simulate `ShipmentMaster` with `Shipment.carrier` or `AuditLog`.
- Staff delivery failure is logged as a `ShipmentEvent` status (`DELIVERY_FAILED`), while the persisted `Shipment.status` must remain one of the existing Prisma `ShipmentStatus` enum values.
