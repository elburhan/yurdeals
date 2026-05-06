// ============================================
// Protected Address Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, validateBody, validateParams } from '../middleware';
import { AppError } from '../middleware/errorHandler';
import { sendSuccess } from '../utils';
import {
  addressParamsSchema,
  AddressParamsInput,
  createAddressSchema,
  CreateAddressInput,
  updateAddressSchema,
  UpdateAddressInput,
} from '../schemas/address.schema';
import {
  createAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from '../services/address.service';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const data = await listAddresses(userId);
    sendSuccess(res, 200, data, 'Addresses retrieved');
  } catch (error) {
    next(error);
  }
});

router.post(
  '/',
  validateBody(createAddressSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const data = await createAddress(userId, req.body as CreateAddressInput);
      sendSuccess(res, 201, data, 'Address created');
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  '/:addressId',
  validateParams(addressParamsSchema),
  validateBody(updateAddressSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const params = res.locals.validatedParams as AddressParamsInput;
      const data = await updateAddress(userId, params.addressId, req.body as UpdateAddressInput);
      sendSuccess(res, 200, data, 'Address updated');
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  '/:addressId',
  validateParams(addressParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const params = res.locals.validatedParams as AddressParamsInput;
      const data = await deleteAddress(userId, params.addressId);
      sendSuccess(res, 200, data, 'Address deleted');
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:addressId/default',
  validateParams(addressParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const params = res.locals.validatedParams as AddressParamsInput;
      const data = await setDefaultAddress(userId, params.addressId);
      sendSuccess(res, 200, data, 'Default address updated');
    } catch (error) {
      next(error);
    }
  },
);

function getUserId(req: Request): string {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }

  return req.user.id;
}

export default router;
