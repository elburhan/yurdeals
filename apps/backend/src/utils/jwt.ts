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
}

/**
 * Sign an access token (short-lived, 15 minutes).
 */
export function signAccessToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN_SECONDS,
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

/**
 * Sign a refresh token (long-lived, 7 days).
 */
export function signRefreshToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN_SECONDS,
  };
  return jwt.sign(payload, env.COOKIE_SECRET, options);
}

/**
 * Verify and decode an access token.
 * Returns the decoded payload or null if invalid/expired.
 */
export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    return decoded;
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
    const decoded = jwt.verify(token, env.COOKIE_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}
