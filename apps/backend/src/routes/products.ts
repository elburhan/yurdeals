// ============================================
// Public Product Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { validateParams, validateQuery } from '../middleware';
import {
  productCollectionQuerySchema,
  ProductCollectionQueryInput,
  productParamsSchema,
  ProductParamsInput,
  productQuerySchema,
  ProductQueryInput,
} from '../schemas/catalog.schema';
import {
  getFeaturedProducts,
  getProductDetail,
  getTrendingProducts,
  listProducts,
} from '../services/catalog.service';
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
  '/trending',
  validateQuery(productCollectionQuerySchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const query = res.locals.validatedQuery as ProductCollectionQueryInput;
      const data = await getTrendingProducts(query);
      sendSuccess(res, 200, data, 'Trending products retrieved');
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/featured',
  validateQuery(productCollectionQuerySchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const query = res.locals.validatedQuery as ProductCollectionQueryInput;
      const data = await getFeaturedProducts(query);
      sendSuccess(res, 200, data, 'Featured products retrieved');
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/:slug',
  validateParams(productParamsSchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const params = res.locals.validatedParams as ProductParamsInput;
      const data = await getProductDetail(params.slug);
      sendSuccess(res, 200, data, 'Product retrieved');
    } catch (error) {
      next(error);
    }
  },
);

export default router;
