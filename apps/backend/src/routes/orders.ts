// ============================================
// Protected Order Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import {
  orderRateLimiter,
  requireAuth,
  trackingLookupRateLimiter,
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware';
import { AppError } from '../middleware/errorHandler';
import { getPaginationMeta, sendSuccess } from '../utils';
import {
  createOrderSchema,
  createGuestOrderSchema,
  guestOrderTokenSchema,
  CreateGuestOrderInput,
  CreateOrderInput,
  GuestOrderTokenInput,
  orderParamsSchema,
  OrderParamsInput,
  orderQuerySchema,
  OrderQueryInput,
} from '../schemas/order.schema';
import {
  publicOrderTrackingQuerySchema,
  PublicOrderTrackingQueryInput,
} from '../schemas/tracking.schema';
import {
  cancelUserOrder,
  createOrderFromCart,
  createGuestOrderFromCart,
  getUserOrder,
  listUserOrders,
  markGuestOrderWhatsappCheckout,
  markOrderWhatsappCheckout,
} from '../services/order.service';
import { getPublicOrderTracking } from '../services/tracking.service';

const router = Router();

router.post(
  '/guest',
  orderRateLimiter,
  validateBody(createGuestOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await createGuestOrderFromCart(req.body as CreateGuestOrderInput, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      sendSuccess(res, 201, data, 'Guest order created successfully');
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:orderId/whatsapp/guest',
  validateParams(orderParamsSchema),
  validateBody(guestOrderTokenSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = res.locals.validatedParams as OrderParamsInput;
      const body = req.body as GuestOrderTokenInput;
      const data = await markGuestOrderWhatsappCheckout(params.orderId, body.guest_access_token, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      sendSuccess(res, 200, data, 'Guest order marked for WhatsApp checkout');
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/track',
  trackingLookupRateLimiter,
  validateQuery(publicOrderTrackingQuerySchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const query = res.locals.validatedQuery as PublicOrderTrackingQueryInput;
      const data = await getPublicOrderTracking(query);
      sendSuccess(res, 200, data, 'Order tracking retrieved');
    } catch (error) {
      next(error);
    }
  },
);

router.use(requireAuth);

router.get(
  '/',
  validateQuery(orderQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
        return;
      }

      const query = res.locals.validatedQuery as OrderQueryInput;
      const result = await listUserOrders(req.user.id, query);
      sendSuccess(res, 200, result.data, 'Orders retrieved', getPaginationMeta(query, result.total));
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/',
  orderRateLimiter,
  validateBody(createOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
        return;
      }

      const data = await createOrderFromCart(req.user.id, req.body as CreateOrderInput, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      sendSuccess(res, 201, data, 'Order created successfully');
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/:orderId',
  validateParams(orderParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
        return;
      }

      const params = res.locals.validatedParams as OrderParamsInput;
      const data = await getUserOrder(req.user.id, params.orderId);
      sendSuccess(res, 200, data, 'Order retrieved');
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:orderId/cancel',
  validateParams(orderParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
        return;
      }

      const params = res.locals.validatedParams as OrderParamsInput;
      const data = await cancelUserOrder(req.user.id, params.orderId, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      sendSuccess(res, 200, data, 'Order cancelled');
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:orderId/whatsapp',
  validateParams(orderParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
        return;
      }

      const params = res.locals.validatedParams as OrderParamsInput;
      const data = await markOrderWhatsappCheckout(req.user.id, params.orderId, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      sendSuccess(res, 200, data, 'Order marked for WhatsApp checkout');
    } catch (error) {
      next(error);
    }
  },
);

export default router;
