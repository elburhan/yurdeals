// ============================================
// Auth Routes — /api/v1/auth
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { validateBody, validateQuery } from '../middleware/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import {
  loginIdentifierRateLimiter,
  loginIpRateLimiter,
  resendOtpIdentifierRateLimiter,
  resendOtpIpRateLimiter,
  signupIdentifierRateLimiter,
  signupIpRateLimiter,
  verifyOtpIdentifierRateLimiter,
  verifyOtpIpRateLimiter,
} from '../middleware/rateLimiter';
import {
  registerUser,
  loginUser,
  getCurrentUser,
  resendUserOtp,
  verifyUserOtp,
} from '../services/auth.service';
import {
  devOtpLookupQuerySchema,
  registerSchema,
  loginSchema,
  resendOtpSchema,
  verifyOtpSchema,
} from '../schemas/auth.schema';
import { clearAuthCookies, setAuthCookies } from '../utils/authCookies';
import { env, isDevelopment } from '../config';
import { getLatestDevVerificationCode } from '../services/notification.service';

const router = Router();

// ---- Routes ----

/**
 * POST /api/v1/auth/register
 * Create a new customer account.
 */
router.post(
  '/register',
  signupIpRateLimiter,
  validateBody(registerSchema),
  signupIdentifierRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, verification } = await registerUser(req.body);

      res.status(201).json({
        success: true,
        data: {
          user,
          verificationRequired: true,
          verification: {
            verificationSessionId: verification.verificationSessionId,
            verificationTarget: verification.verificationTarget,
            channel: verification.channel,
            expiresInSeconds: verification.expiresInSeconds,
          },
        },
        message: 'Account created. Verify your OTP to complete signup.',
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
  loginIpRateLimiter,
  validateBody(loginSchema),
  loginIdentifierRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, tokens } = await loginUser(req.body, { ip: req.ip });

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

router.post(
  '/verify-otp',
  verifyOtpIpRateLimiter,
  validateBody(verifyOtpSchema),
  verifyOtpIdentifierRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, tokens } = await verifyUserOtp(req.body);

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
        message: 'Verification successful',
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/resend-otp',
  resendOtpIpRateLimiter,
  validateBody(resendOtpSchema),
  resendOtpIdentifierRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const verification = await resendUserOtp(req.body);

      res.status(200).json({
        success: true,
        data: {
          verification: {
            verificationSessionId: verification.verificationSessionId,
            verificationTarget: verification.verificationTarget,
            channel: verification.channel,
            expiresInSeconds: verification.expiresInSeconds,
          },
        },
        message: 'A new verification code has been sent if the session is still valid.',
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/dev/latest-otp',
  validateQuery(devOtpLookupQuerySchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isDevelopment) {
        next(new AppError('Route not found', 404, 'NOT_FOUND'));
        return;
      }

      const verification = getLatestDevVerificationCode(res.locals.validatedQuery);

      if (!verification) {
        next(new AppError('Verification code not found', 404, 'OTP_NOT_FOUND'));
        return;
      }

      res.status(200).json({
        success: true,
        data: { verification },
        message: '[DEV ONLY] Latest verification code retrieved',
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

export default router;
