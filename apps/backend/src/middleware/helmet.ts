// ============================================
// Security Middleware — Helmet Configuration
// ============================================

import helmet from 'helmet';
import { isProduction } from '../config';

/**
 * Helmet middleware with strict Content Security Policy.
 * In development, allows unsafe-inline for dev tooling.
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: isProduction,
  crossOriginResourcePolicy: { policy: 'same-site' },
  hsts: isProduction
    ? {
        maxAge: 15552000,
        includeSubDomains: true,
        preload: false,
      }
    : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xContentTypeOptions: true,
  xFrameOptions: { action: 'deny' },
  xXssProtection: true,
});
