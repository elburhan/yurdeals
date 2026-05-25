// ============================================
// Express Application Setup — YurDeals Backend
// ============================================

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { env, isProduction } from './config';
import {
  helmetMiddleware,
  globalRateLimiter,
  notFoundHandler,
  errorHandler,
  requestLogger,
  csrfProtection,
} from './middleware';
import routes from './routes';
import paymentWebhooksRouter from './routes/paymentWebhooks';
import paystackWebhookRouter from './routes/paystackWebhook';
import { verifyPaymentReturn } from './services/payment.service';
import { setupSentryExpressErrorHandler } from './observability/sentry';

const app = express();
const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);

// ---- Trust proxy (for rate-limiter behind reverse proxy / HTTPS/ngrok) ----
if (isProduction || env.NODE_ENV === 'development') {
  app.set('trust proxy', 1);
}

// ---- Request Correlation / Structured Logging ----
app.use(requestLogger);

// ---- Security Headers ----
app.use(helmetMiddleware);

// ---- CORS ----
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'ngrok-skip-browser-warning'],
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
  `/api/${env.API_VERSION}/webhooks/paystack`,
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

// ---- CSRF Protection (webhook raw-body routes are mounted above this point) ----
app.use(csrfProtection);

// ---- Payment Return Redirect ----
app.get('/payment-return', async (req, res, next) => {
  try {
    // Paystack redirect/callback is not treated as proof of success.
    // We verify the reference server-side before sending the browser back to the frontend.
    await verifyPaymentReturn({
      orderId: typeof req.query.orderId === 'string' ? req.query.orderId : undefined,
      paymentId: typeof req.query.paymentId === 'string' ? req.query.paymentId : undefined,
      reference: typeof req.query.reference === 'string' ? req.query.reference : undefined,
    });

    const redirectUrl = new URL('/payment-return', env.FRONTEND_URL);
    const secretReturnParams = new Set(['guestAccessToken']);

    for (const [key, value] of Object.entries(req.query)) {
      if (secretReturnParams.has(key)) {
        continue;
      }

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
  } catch (error) {
    next(error);
  }
});

// ---- API Routes ----
app.use(`/api/${env.API_VERSION}`, routes);

// ---- 404 Handler ----
app.use(notFoundHandler);

// ---- Sentry Error Capture (observes before API response formatting) ----
setupSentryExpressErrorHandler(app);

// ---- Global Error Handler ----
app.use(errorHandler);

export default app;
