// ============================================
// Public Product Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { validateParams, validateQuery } from '../middleware';
import {
  productParamsSchema,
  ProductParamsInput,
  productQuerySchema,
  ProductQueryInput,
} from '../schemas/catalog.schema';
import { getProductDetail, listProducts } from '../services/catalog.service';
import { sendSuccess } from '../utils/response';

const router = Router();

router.get(
  '/',
  validateQuery(productQuerySchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const query = res.locals.validatedQuery as ProductQueryInput;
      const result = await listProducts(query);
      sendSuccess(res, 200, result.data, 'Products retrieved', result.meta);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/:id',
  validateParams(productParamsSchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const params = res.locals.validatedParams as ProductParamsInput;
      const data = await getProductDetail(params.id);
      sendSuccess(res, 200, data, 'Product retrieved');
    } catch (error) {
      next(error);
    }
  },
);

export default router;
