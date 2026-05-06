// ============================================
// Public Category Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { validateParams, validateQuery } from '../middleware';
import {
  categoryParamsSchema,
  CategoryParamsInput,
  categoryQuerySchema,
  CategoryQueryInput,
} from '../schemas/catalog.schema';
import { getCategoryDetail, listCategories } from '../services/catalog.service';
import { sendSuccess } from '../utils/response';

const router = Router();

router.get(
  '/',
  validateQuery(categoryQuerySchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const query = res.locals.validatedQuery as CategoryQueryInput;
      const data = await listCategories(query);
      sendSuccess(res, 200, data, 'Categories retrieved');
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/:slug',
  validateParams(categoryParamsSchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const params = res.locals.validatedParams as CategoryParamsInput;
      const data = await getCategoryDetail(params.slug);
      sendSuccess(res, 200, data, 'Category retrieved');
    } catch (error) {
      next(error);
    }
  },
);

export default router;
