// ============================================
// Protected Notification Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware';
import { AppError } from '../middleware/errorHandler';
import { listNotifications, markAllNotificationsRead } from '../services/notification.service';
import { sendSuccess } from '../utils';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
      return;
    }

    const data = await listNotifications(req.user.id);
    sendSuccess(res, 200, data, 'Notifications retrieved');
  } catch (error) {
    next(error);
  }
});

router.patch('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
      return;
    }

    const data = await markAllNotificationsRead(req.user.id);
    sendSuccess(res, 200, data, 'Notifications marked as read');
  } catch (error) {
    next(error);
  }
});

export default router;
