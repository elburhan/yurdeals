// ============================================
// JWT Utility — Sign & Verify Tokens
// ============================================

import jwt, { SignOptions } from 'jsonwebtoken';
import { UserRoleType } from '@yurdeals/shared';
import { env } from '../config';

/** Payload stored inside JWT tokens */
export interface JwtPayload {
  userId: string;
  role: UserRoleType;
  iat?: number;
  exp?: number;
}

const ACCESS_TOKEN_ISSUER = 'yurdeals-api';
const ACCESS_TOKEN_AUDIENCE = 'yurdeals-users';
const REFRESH_TOKEN_ISSUER = 'yurdeals-auth';
const REFRESH_TOKEN_AUDIENCE = 'yurdeals-refresh';

/**
 * Sign an access token (short-lived, 15 minutes).
 */
export function signAccessToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN_SECONDS,
    issuer: ACCESS_TOKEN_ISSUER,
    audience: ACCESS_TOKEN_AUDIENCE,
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

/**
 * Sign a refresh token (long-lived, 7 days).
 */
export function signRefreshToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN_SECONDS,
    issuer: REFRESH_TOKEN_ISSUER,
    audience: REFRESH_TOKEN_AUDIENCE,
  };
  return jwt.sign(payload, env.COOKIE_SECRET, options);
}

/**
 * Verify and decode an access token.
 * Returns the decoded payload or null if invalid/expired.
 */
export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
    }) as JwtPayload;
    return isValidJwtPayload(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Verify and decode a refresh token.
 * Returns the decoded payload or null if invalid/expired.
 */
export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.COOKIE_SECRET, {
      issuer: REFRESH_TOKEN_ISSUER,
      audience: REFRESH_TOKEN_AUDIENCE,
    }) as JwtPayload;
    return isValidJwtPayload(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function isValidJwtPayload(payload: unknown): payload is JwtPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Partial<JwtPayload>;
  return (
    typeof candidate.userId === 'string' &&
    candidate.userId.length > 0 &&
    typeof candidate.role === 'string' &&
    candidate.role.length > 0
  );
}
