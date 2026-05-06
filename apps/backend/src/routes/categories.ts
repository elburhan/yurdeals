// ============================================
// Public Category Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { validateQuery } from '../middleware';
import { categoryQuerySchema, CategoryQueryInput } from '../schemas/catalog.schema';
import { listCategories } from '../services/catalog.service';
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

export default router;
