// ============================================
// Express Application Setup — YurDeals Backend
// ============================================

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import { env, isProduction } from './config';
import { helmetMiddleware, globalRateLimiter, notFoundHandler, errorHandler } from './middleware';
import routes from './routes';
import paymentWebhooksRouter from './routes/paymentWebhooks';
import paystackWebhookRouter from './routes/paystackWebhook';

const app = express();

// ---- Trust proxy (for rate-limiter behind reverse proxy / HTTPS/ngrok) ----
if (isProduction || env.NODE_ENV === 'development') {
  app.set('trust proxy', 1);
}

// ---- Security Headers ----
app.use(helmetMiddleware);

// ---- CORS ----
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
  }),
);

// ---- Rate Limiting (global) ----
app.use(globalRateLimiter);

// ---- Raw Webhook Routes (must run before JSON parsing for signature verification) ----
app.use(
  `/api/${env.API_VERSION}/payments/paystack/webhook`,
  express.raw({ type: 'application/json', limit: '2mb' }),
  paystackWebhookRouter,
);

app.use(
  `/api/${env.API_VERSION}/payments/webhooks`,
  express.raw({ type: 'application/json', limit: '2mb' }),
  paymentWebhooksRouter,
);

// ---- Body Parsing ----
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---- Cookie Parser (secure) ----
app.use(cookieParser(env.COOKIE_SECRET));

// ---- Compression ----
app.use(compression());

// ---- Request Logging ----
app.use(morgan(isProduction ? 'combined' : 'dev'));

// ---- Payment Return Redirect ----
app.get('/payment-return', (req, res) => {
  const frontendOrigin = env.CORS_ORIGIN.split(',')[0]?.trim() || 'http://localhost:5173';
  const redirectUrl = new URL('/payment-return', frontendOrigin);

  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') {
      redirectUrl.searchParams.set(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === 'string') {
          redirectUrl.searchParams.append(key, item);
        }
      });
    }
  }

  res.redirect(302, redirectUrl.toString());
});

// ---- API Routes ----
app.use(`/api/${env.API_VERSION}`, routes);

// ---- 404 Handler ----
app.use(notFoundHandler);

// ---- Global Error Handler ----
app.use(errorHandler);

export default app;
