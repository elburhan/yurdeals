# YurDeals — Cross-Border Marketplace

> Nigerian cross-border e-commerce platform supporting public browsing, authenticated purchases, preorder/local stock, and end-to-end China-to-Nigeria tracking.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js + Express + TypeScript |
| **ORM** | Prisma (PostgreSQL) |
| **Frontend** | React 18 + Vite + TypeScript |
| **Styling** | Tailwind CSS (mobile-first) |
| **Monorepo** | npm workspaces |
| **Security** | Helmet, CORS, rate limiting |

---

## Prerequisites

- **Node.js** ≥ 20.0.0
- **npm** ≥ 10.0.0
- **PostgreSQL** ≥ 15

---

## Getting Started

### 1. Clone & Install

```bash
git clone <repository-url>
cd yurdeals.com
npm install
```

### 2. Environment Setup

```bash
# Copy backend environment template
cp apps/backend/.env.example apps/backend/.env

# Copy frontend/root environment template if needed
cp .env.example .env

# Edit with your actual values
# At minimum, update DATABASE_URL, JWT_SECRET, COOKIE_SECRET
```

Frontend Vite variables are loaded from the project root `.env` file. For WhatsApp checkout, add this line to `./.env` and restart the frontend dev server:

```env
VITE_WHATSAPP_BUSINESS_NUMBER="2348000000000"
```

Use your real WhatsApp business number in E.164 format without the `+`, spaces, or dashes.

### 3. Database Setup

```bash
# Create the database
createdb yurdeals

# Run migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate
```

### 4. Build Shared Package

```bash
npm run build:shared
```

### 5. Start Development Servers

```bash
# Terminal 1 — Backend (port 4000)
npm run dev:backend

# Terminal 2 — Frontend (port 5173)
npm run dev:frontend
```

### 6. Verify

- **Frontend**: http://localhost:5173
- **Backend Health**: http://localhost:4000/api/v1/health
- **Prisma Studio**: `npm run db:studio`

---

## Paystack Test Webhooks with ngrok

Use this setup when testing Paystack callbacks and webhooks locally.

1. Start the backend:

```bash
npm run dev:backend
```

2. Start the frontend:

```bash
npm run dev:frontend
```

3. Expose the backend with ngrok:

```bash
ngrok http 4000
```

Copy the HTTPS URL, for example `https://abc123.ngrok-free.app`.

4. In your Paystack Test dashboard, set:

```text
Callback URL: https://abc123.ngrok-free.app/payment-return
Webhook URL:  https://abc123.ngrok-free.app/api/v1/payments/paystack/webhook
```

5. In `apps/backend/.env`, set `PAYSTACK_CALLBACK_URL` to the same callback URL:

```env
PAYSTACK_CALLBACK_URL="https://abc123.ngrok-free.app/payment-return"
```

Restart the backend after changing env values.

The backend `/payment-return` route redirects the browser to the frontend `/payment-return`
page while preserving Paystack query parameters. Webhooks remain the source of truth for
confirming payment status.

---

## Project Structure

```
yurdeals.com/
├── apps/
│   ├── backend/       # Express API server
│   └── frontend/      # React SPA
├── packages/
│   └── shared/        # Shared types & constants
├── AGENTS.md          # Development rules
└── README.md          # This file
```

---

## Available Scripts

| Command | Description |
|---------|------------|
| `npm run dev:backend` | Start backend dev server |
| `npm run dev:frontend` | Start frontend dev server |
| `npm run build` | Build all packages |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed database |

---

## Development Rules

See [AGENTS.md](./AGENTS.md) for the complete development rulebook.

---

## License

Private — All rights reserved.
