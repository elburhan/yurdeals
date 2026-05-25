import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { env, isProduction } from '../config';
import { AppError } from './errorHandler';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_BYTES = 32;
const CSRF_SIGNATURE_BYTES = 32;
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const csrfCookieOptions = {
  httpOnly: false,
  secure: isProduction || env.COOKIE_SAME_SITE === 'none',
  sameSite: env.COOKIE_SAME_SITE,
  path: '/',
};

export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (!env.CSRF_ENABLED || !UNSAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieToken = getCookieToken(req);
  const headerToken = getHeaderToken(req);

  if (!cookieToken || !headerToken || cookieToken !== headerToken || !verifyCsrfToken(cookieToken)) {
    next(new AppError('Invalid or missing CSRF token', 403, 'CSRF_INVALID'));
    return;
  }

  next();
}

export function issueCsrfToken(res: Response): string {
  const token = createCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, {
    ...csrfCookieOptions,
    maxAge: env.JWT_REFRESH_EXPIRES_IN_SECONDS * 1000,
  });
  return token;
}

function createCsrfToken(): string {
  const nonce = crypto.randomBytes(CSRF_TOKEN_BYTES).toString('base64url');
  const signature = signNonce(nonce);
  return `${nonce}.${signature}`;
}

function verifyCsrfToken(token: string): boolean {
  const [nonce, signature] = token.split('.');
  if (!nonce || !signature) {
    return false;
  }

  const expectedSignature = signNonce(nonce);
  return timingSafeEqual(signature, expectedSignature);
}

function signNonce(nonce: string): string {
  return crypto
    .createHmac('sha256', env.COOKIE_SECRET)
    .update(`csrf:${nonce}`)
    .digest('base64url');
}

function getCookieToken(req: Request): string | null {
  const cookies = req.cookies as Record<string, string | undefined>;
  return cookies[CSRF_COOKIE_NAME] ?? null;
}

function getHeaderToken(req: Request): string | null {
  const value = req.headers[CSRF_HEADER_NAME];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== CSRF_SIGNATURE_BYTES || rightBuffer.length !== CSRF_SIGNATURE_BYTES) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
