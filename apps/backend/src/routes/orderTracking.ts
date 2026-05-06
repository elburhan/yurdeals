// ============================================
// Protected Order Tracking Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, validateParams } from '../middleware';
import { AppError } from '../middleware/errorHandler';
import { orderTrackingParamsSchema, OrderTrackingParamsInput } from '../schemas/tracking.schema';
import { getOrderTracking } from '../services/tracking.service';
import { sendSuccess } from '../utils';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get(
  '/',
  validateParams(orderTrackingParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
        return;
      }

      const params = res.locals.validatedParams as OrderTrackingParamsInput;
      const data = await getOrderTracking(req.user.id, params.orderId);
      sendSuccess(res, 200, data, 'Order tracking retrieved');
    } catch (error) {
      next(error);
    }
  },
);

export default router;
