// ============================================
// Rate Limiter Middleware
// ============================================

import rateLimit from 'express-rate-limit';
import { env } from '../config';
import { logger, normalizeAuthIdentifier, normalizeEmail, normalizePhone } from '../utils';
import type { Request } from 'express';

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

export const signupIpRateLimiter = createAuthScopedLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  code: 'SIGNUP_RATE_LIMIT_EXCEEDED',
  message: 'Too many signup attempts. Please try again later.',
  name: 'signup_ip',
});

export const signupIdentifierRateLimiter = createAuthScopedLimiter({
  windowMs: 15 * 60 * 1000,
  max: 3,
  code: 'SIGNUP_IDENTIFIER_RATE_LIMIT_EXCEEDED',
  message: 'Too many signup attempts. Please try again later.',
  name: 'signup_identifier',
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? normalizeEmail(req.body.email) : '';
    const phone = typeof req.body?.phone === 'string' ? normalizePhone(req.body.phone) : '';
    return `signup:${email || phone || req.ip}`;
  },
});

export const loginIpRateLimiter = createAuthScopedLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  code: 'LOGIN_RATE_LIMIT_EXCEEDED',
  message: 'Too many login attempts. Please try again later.',
  name: 'login_ip',
});

export const loginIdentifierRateLimiter = createAuthScopedLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  code: 'LOGIN_IDENTIFIER_RATE_LIMIT_EXCEEDED',
  message: 'Too many login attempts. Please try again later.',
  name: 'login_identifier',
  keyGenerator: (req) => {
    const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier : '';
    const normalized = identifier ? normalizeAuthIdentifier(identifier) : null;
    return `login:${normalized?.type ?? 'unknown'}:${normalized?.canonical ?? req.ip}`;
  },
});

export const verifyOtpIpRateLimiter = createAuthScopedLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  code: 'OTP_VERIFY_RATE_LIMIT_EXCEEDED',
  message: 'Too many verification attempts. Please try again later.',
  name: 'verify_otp_ip',
});

export const verifyOtpIdentifierRateLimiter = createAuthScopedLimiter({
  windowMs: 10 * 60 * 1000,
  max: 8,
  code: 'OTP_VERIFY_IDENTIFIER_RATE_LIMIT_EXCEEDED',
  message: 'Too many verification attempts. Please try again later.',
  name: 'verify_otp_identifier',
  keyGenerator: (req) => {
    const sessionId =
      typeof req.body?.verificationSessionId === 'string' ? req.body.verificationSessionId.trim() : '';
    const channel = typeof req.body?.channel === 'string' ? req.body.channel : 'unknown';
    const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier : '';

    if (sessionId) {
      return `verify-otp:${channel}:session:${sessionId}`;
    }

    if (identifier) {
      const normalized =
        channel === 'EMAIL' ? normalizeEmail(identifier) : normalizePhone(identifier);
      return `verify-otp:${channel}:identifier:${normalized || req.ip}`;
    }

    return `verify-otp:${req.ip}`;
  },
});

export const resendOtpIpRateLimiter = createAuthScopedLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  code: 'OTP_RESEND_RATE_LIMIT_EXCEEDED',
  message: 'Too many resend attempts. Please try again later.',
  name: 'resend_otp_ip',
});

export const resendOtpIdentifierRateLimiter = createAuthScopedLimiter({
  windowMs: 30 * 60 * 1000,
  max: 5,
  code: 'OTP_RESEND_IDENTIFIER_RATE_LIMIT_EXCEEDED',
  message: 'Too many resend attempts. Please try again later.',
  name: 'resend_otp_identifier',
  keyGenerator: (req) => {
    const sessionId =
      typeof req.body?.verificationSessionId === 'string' ? req.body.verificationSessionId.trim() : '';
    const channel = typeof req.body?.channel === 'string' ? req.body.channel : 'unknown';
    const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier : '';

    if (sessionId) {
      return `resend-otp:${channel}:session:${sessionId}`;
    }

    if (identifier) {
      const normalized =
        channel === 'EMAIL' ? normalizeEmail(identifier) : normalizePhone(identifier);
      return `resend-otp:${channel}:identifier:${normalized || req.ip}`;
    }

    return `resend-otp:${req.ip}`;
  },
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

export const trackingLookupRateLimiter = createAuthScopedLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  code: 'TRACKING_RATE_LIMIT_EXCEEDED',
  message: 'Too many tracking lookups. Please wait a few minutes and try again.',
  name: 'tracking_lookup',
  keyGenerator: (req) => {
    const phone = typeof req.query?.phone === 'string' ? req.query.phone.trim() : '';
    const orderNumber =
      typeof req.query?.orderNumber === 'string' ? req.query.orderNumber.trim().toLowerCase() : '';
    return `tracking:${phone || req.ip}:${orderNumber || 'unknown'}`;
  },
});

interface ScopedLimiterOptions {
  windowMs: number;
  max: number;
  code: string;
  message: string;
  name: string;
  keyGenerator?: (req: Request) => string;
}

function createAuthScopedLimiter(options: ScopedLimiterOptions) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: 429,
    keyGenerator: options.keyGenerator,
    handler: (req, res, _next, opt) => {
      logger.warn('Rate limit triggered', {
        limiter: options.name,
        method: req.method,
        path: req.originalUrl || req.url,
        ip: req.ip,
      });

      res.status(opt.statusCode).json(rateLimitMessage(options.code, options.message));
    },
    message: rateLimitMessage(options.code, options.message),
  });
}
