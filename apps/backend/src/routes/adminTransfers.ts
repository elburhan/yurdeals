import { Router, Request, Response, NextFunction } from 'express';
import { adminRateLimiter, requireAuth, requireRole, validateBody, validateParams } from '../middleware';
import { sendSuccess } from '../utils';
import {
  createTransferRecipientSchema,
  CreateTransferRecipientInput,
  initiateTransferSchema,
  InitiateTransferSchemaInput,
  transferParamsSchema,
  TransferParamsInput,
} from '../schemas/transfer.schema';
import {
  createTransferRecipient,
  fetchSupplierTransfer,
  initiateSupplierTransfer,
} from '../services/transfer.service';

const router = Router();

router.use(requireAuth, requireRole(['ADMIN']), adminRateLimiter);

router.post(
  '/recipients',
  validateBody(createTransferRecipientSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await createTransferRecipient(req.body as CreateTransferRecipientInput, {
        userId: req.user?.id,
      });
      sendSuccess(res, 201, data, 'Transfer recipient created');
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/',
  validateBody(initiateTransferSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await initiateSupplierTransfer(req.body as InitiateTransferSchemaInput, {
        userId: req.user?.id,
      });
      sendSuccess(res, 201, data, 'Transfer initiated');
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/:referenceOrId',
  validateParams(transferParamsSchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const params = res.locals.validatedParams as TransferParamsInput;
      const data = await fetchSupplierTransfer(params.referenceOrId);
      sendSuccess(res, 200, data, 'Transfer retrieved');
    } catch (error) {
      next(error);
    }
  },
);

export default router;
