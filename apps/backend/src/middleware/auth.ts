// ============================================
// Auth Middleware — requireAuth & requireRole
// ============================================

import { Request, Response, NextFunction } from 'express';
import { UserRoleType } from '@yurdeals/shared';
import { verifyAccessToken, verifyRefreshToken, signAccessToken, JwtPayload } from '../utils/jwt';
import { prisma } from '../config';
import { AppError } from './errorHandler';
import { setAccessTokenCookie } from '../utils/authCookies';

/** Prisma select for safe user fields (never includes passwordHash) */
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  avatar: true,
  isVerified: true,
  emailVerified: true,
  phoneVerified: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export { SAFE_USER_SELECT };

/**
 * Middleware: Require a valid access token.
 * Supports HttpOnly cookie (`access_token`) and Authorization header (`Bearer <token>`).
 * If access token expired but refresh token valid, auto-rotates access token.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const accessToken =
    (req.cookies as Record<string, string | undefined>)['access_token'] ?? extractBearerToken(req);

  if (accessToken) {
    const payload = verifyAccessToken(accessToken);
    if (payload) {
      loadUser(payload, req, next);
      return;
    }
  }

  // Try refresh token rotation
  const refreshToken = (req.cookies as Record<string, string | undefined>)['refresh_token'];
  if (refreshToken) {
    const refreshPayload = verifyRefreshToken(refreshToken);
    if (refreshPayload) {
      // Issue new access token via cookie
      const newAccessToken = signAccessToken({
        userId: refreshPayload.userId,
        role: refreshPayload.role,
      });

      setAccessTokenCookie(res, newAccessToken);
      loadUser(refreshPayload, req, next);
      return;
    }
  }

  next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
}

/**
 * Middleware factory: Require the user to have one of the specified roles.
 * Must be used AFTER `requireAuth`.
 */
export function requireRole(roles: UserRoleType[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
      return;
    }

    next();
  };
}

// ---- Helpers ----

function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return undefined;
}

async function loadUser(payload: JwtPayload, req: Request, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: SAFE_USER_SELECT,
    });

    if (!user || !user.isActive) {
      next(new AppError('Account is inactive or not found', 401, 'UNAUTHORIZED'));
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
    };

    next();
  } catch (error) {
    next(error);
  }
}
