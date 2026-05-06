// ============================================
// Staff Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole, validateBody, validateParams, validateQuery } from '../middleware';
import {
  staffLastMileQuerySchema,
  StaffLastMileQueryInput,
  staffShipmentParamsSchema,
  StaffShipmentParamsInput,
  staffShipmentStatusSchema,
  StaffShipmentStatusInput,
} from '../schemas/staff.schema';
import { listStaffLastMileShipments, updateStaffLastMileStatus } from '../services/staff.service';
import { getPaginationMeta, sendSuccess } from '../utils';

const router = Router();

router.use(requireAuth, requireRole(['STAFF']));

router.get(
  '/shipments/last-mile',
  validateQuery(staffLastMileQuerySchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const query = res.locals.validatedQuery as StaffLastMileQueryInput;
      const result = await listStaffLastMileShipments(query);
      sendSuccess(
        res,
        200,
        result.data,
        'Last-mile shipments retrieved',
        getPaginationMeta(query, result.total),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/shipments/last-mile/:shipmentId/status',
  validateParams(staffShipmentParamsSchema),
  validateBody(staffShipmentStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = res.locals.validatedParams as StaffShipmentParamsInput;
      const shipment = await updateStaffLastMileStatus(
        params.shipmentId,
        req.body as StaffShipmentStatusInput,
        {
          userId: req.user?.id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      );
      sendSuccess(res, 200, { shipment }, 'Last-mile shipment updated');
    } catch (error) {
      next(error);
    }
  },
);

export default router;
