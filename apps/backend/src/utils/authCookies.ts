// ============================================
// Auth Cookie Helpers
// ============================================

import { Response } from 'express';
import { env, isProduction } from '../config';

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
const hasCrossOriginHttpsClient = allowedOrigins.some((origin) => origin.startsWith('https://'));
const cookieSameSite = isProduction ? ('none' as const) : ('lax' as const);
const cookieSecure = isProduction || (cookieSameSite === 'none' && hasCrossOriginHttpsClient);

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSameSite,
  path: '/',
};

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie('access_token', accessToken, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });

  res.cookie('refresh_token', refreshToken, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
}

export function setAccessTokenCookie(res: Response, accessToken: string): void {
  res.cookie('access_token', accessToken, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie('access_token', AUTH_COOKIE_OPTIONS);
  res.clearCookie('refresh_token', AUTH_COOKIE_OPTIONS);
}
