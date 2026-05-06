// ============================================
// Rate Limiter Middleware
// ============================================

import rateLimit from 'express-rate-limit';
import { env } from '../config';

function rateLimitMessage(code: string, message: string) {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  skip: (req) => req.path.startsWith(`/api/${env.API_VERSION}/admin`),
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: rateLimitMessage('RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again later.'),
});

export const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: rateLimitMessage(
    'AUTH_RATE_LIMIT_EXCEEDED',
    'Too many authentication attempts. Please try again later.',
  ),
});

export const orderRateLimiter = rateLimit({
  windowMs: env.ORDER_RATE_LIMIT_WINDOW_MS,
  max: env.ORDER_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: rateLimitMessage(
    'ORDER_RATE_LIMIT_EXCEEDED',
    'Too many order attempts. Please try again later.',
  ),
});

export const paymentRateLimiter = rateLimit({
  windowMs: env.PAYMENT_RATE_LIMIT_WINDOW_MS,
  max: env.PAYMENT_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: rateLimitMessage(
    'PAYMENT_RATE_LIMIT_EXCEEDED',
    'Too many payment attempts. Please try again later.',
  ),
});

export const adminRateLimiter = rateLimit({
  windowMs: env.ADMIN_RATE_LIMIT_WINDOW_MS,
  max: env.ADMIN_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: rateLimitMessage(
    'ADMIN_RATE_LIMIT_EXCEEDED',
    'Too many admin dashboard requests. Please try again later.',
  ),
});

export const webhookRateLimiter = rateLimit({
  windowMs: env.WEBHOOK_RATE_LIMIT_WINDOW_MS,
  max: env.WEBHOOK_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: rateLimitMessage(
    'WEBHOOK_RATE_LIMIT_EXCEEDED',
    'Too many webhook requests. Please try again later.',
  ),
});
