// ============================================
// Public Home Catalog Route
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { getHomeCatalog } from '../services/catalog.service';
import { sendSuccess } from '../utils/response';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getHomeCatalog();
    sendSuccess(res, 200, data, 'Home catalog retrieved');
  } catch (error) {
    next(error);
  }
});

export default router;
