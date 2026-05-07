// ============================================
// Auth Routes — /api/v1/auth
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { validateBody } from '../middleware/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { authRateLimiter } from '../middleware/rateLimiter';
import { registerUser, loginUser, getCurrentUser } from '../services/auth.service';
import { registerSchema, loginSchema } from '../schemas/auth.schema';
import { clearAuthCookies, setAuthCookies } from '../utils/authCookies';
import { env } from '../config';
import { verifyAccessToken } from '../utils/jwt';

const router = Router();

// ---- Routes ----

/**
 * POST /api/v1/auth/register
 * Create a new customer account.
 */
router.post(
  '/register',
  authRateLimiter,
  validateBody(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, tokens } = await registerUser(req.body);

      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

      res.status(201).json({
        success: true,
        data: {
          user,
          token: {
            accessToken: tokens.accessToken,
            tokenType: 'Bearer',
            expiresIn: env.JWT_ACCESS_EXPIRES_IN_SECONDS,
          },
        },
        message: 'Account created successfully',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/auth/login
 * Authenticate with email and password.
 */
router.post(
  '/login',
  authRateLimiter,
  validateBody(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, tokens } = await loginUser(req.body);

      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

      res.status(200).json({
        success: true,
        data: {
          user,
          token: {
            accessToken: tokens.accessToken,
            tokenType: 'Bearer',
            expiresIn: env.JWT_ACCESS_EXPIRES_IN_SECONDS,
          },
        },
        message: 'Logged in successfully',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/v1/auth/me
 * Get current authenticated user profile.
 */
router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
      return;
    }

    const user = await getCurrentUser(req.user.id);

    res.status(200).json({
      success: true,
      data: { user },
      message: 'User profile retrieved',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout
 * Clear auth cookies to log the user out.
 */
router.post('/logout', requireAuth, (_req: Request, res: Response) => {
  clearAuthCookies(res);

  res.status(200).json({
    success: true,
    data: null,
    message: 'Logged out successfully',
  });
});

/**
 * GET /api/v1/auth/protected
 * Example protected endpoint for future modules.
 */
router.get('/protected', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      userId: req.user.id,
      role: req.user.role,
    },
    message: 'Protected route access granted',
  });
});

/**
 * GET /api/v1/auth/admin
 * Example admin-only endpoint for RBAC verification.
 */
router.get(
  '/admin',
  requireAuth,
  requireRole(['ADMIN']),
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        userId: req.user.id,
        role: req.user.role,
      },
      message: 'Admin route access granted',
    });
  },
);

router.get('/debug-session', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    return;
  }

  const authorization = req.headers.authorization;
  const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  const accessCookie = (req.cookies as Record<string, string | undefined>)['access_token'];
  const decodedBearer = bearerToken ? verifyAccessToken(bearerToken) : null;
  const decodedCookie = accessCookie ? verifyAccessToken(accessCookie) : null;

  res.status(200).json({
    success: true,
    data: {
      user: req.user,
      authDebug: {
        hasAuthorizationHeader: Boolean(bearerToken),
        hasAccessTokenCookie: Boolean(accessCookie),
        bearerPayload: decodedBearer,
        cookiePayload: decodedCookie,
      },
    },
    message: 'Debug session retrieved',
  });
});

export default router;
