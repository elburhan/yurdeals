// ============================================
// Protected Order Payment Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { paymentRateLimiter, requireAuth, validateBody, validateParams, validateQuery } from '../middleware';
import { AppError } from '../middleware/errorHandler';
import { sendSuccess } from '../utils';
import {
  initiatePaymentSchema,
  initiateGuestPaymentSchema,
  guestPaymentStatusQuerySchema,
  GuestPaymentStatusQueryInput,
  InitiateGuestPaymentInput,
  InitiatePaymentInput,
  orderPaymentParamsSchema,
  OrderPaymentParamsInput,
  paymentStatusParamsSchema,
  PaymentStatusParamsInput,
} from '../schemas/payment.schema';
import {
  getGuestPaymentStatus,
  getPaymentStatus,
  initiateGuestPayment,
  initiatePayment,
  verifyGuestPayment,
  verifyPayment,
} from '../services/payment.service';

const router = Router({ mergeParams: true });

router.post(
  '/guest',
  paymentRateLimiter,
  validateParams(orderPaymentParamsSchema),
  validateBody(initiateGuestPaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = res.locals.validatedParams as OrderPaymentParamsInput;
      const data = await initiateGuestPayment(params.orderId, req.body as InitiateGuestPaymentInput);
      sendSuccess(res, 201, data, 'Guest payment initiated');
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/:paymentId/guest',
  validateParams(paymentStatusParamsSchema),
  validateQuery(guestPaymentStatusQuerySchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const params = res.locals.validatedParams as PaymentStatusParamsInput;
      const query = res.locals.validatedQuery as GuestPaymentStatusQueryInput;
      const guestAccessToken = query.guest_access_token;
      const data = await getGuestPaymentStatus(params.orderId, params.paymentId, guestAccessToken);
      sendSuccess(res, 200, data, 'Guest payment status retrieved');
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:paymentId/guest/verify',
  validateParams(paymentStatusParamsSchema),
  validateQuery(guestPaymentStatusQuerySchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const params = res.locals.validatedParams as PaymentStatusParamsInput;
      const query = res.locals.validatedQuery as GuestPaymentStatusQueryInput;
      const guestAccessToken = query.guest_access_token;
      const data = await verifyGuestPayment(params.orderId, params.paymentId, guestAccessToken);
      sendSuccess(res, 200, data, 'Guest payment verified');
    } catch (error) {
      next(error);
    }
  },
);

router.use(requireAuth);

router.post(
  '/',
  paymentRateLimiter,
  validateParams(orderPaymentParamsSchema),
  validateBody(initiatePaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
        return;
      }

      const params = res.locals.validatedParams as OrderPaymentParamsInput;
      const data = await initiatePayment(
        req.user.id,
        params.orderId,
        req.body as InitiatePaymentInput,
      );
      sendSuccess(res, 201, data, 'Payment initiated');
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/:paymentId',
  validateParams(paymentStatusParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
        return;
      }

      const params = res.locals.validatedParams as PaymentStatusParamsInput;
      const data = await getPaymentStatus(req.user.id, params.orderId, params.paymentId);
      sendSuccess(res, 200, data, 'Payment status retrieved');
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:paymentId/verify',
  validateParams(paymentStatusParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
        return;
      }

      const params = res.locals.validatedParams as PaymentStatusParamsInput;
      // Manual verify stays available as a safe fallback even if the user returns
      // before the webhook arrives. The backend still verifies directly with Paystack.
      const data = await verifyPayment(req.user.id, params.orderId, params.paymentId);
      sendSuccess(res, 200, data, 'Payment verified');
    } catch (error) {
      next(error);
    }
  },
);

export default router;
