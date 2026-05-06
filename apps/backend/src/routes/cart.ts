// ============================================
// Protected Cart Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, validateBody, validateParams } from '../middleware';
import {
  addCartItemSchema,
  cartItemParamsSchema,
  CartItemParamsInput,
  updateCartItemSchema,
  AddCartItemInput,
  UpdateCartItemInput,
} from '../schemas/cart.schema';
import { addCartItem, getCart, removeCartItem, updateCartItem } from '../services/cart.service';
import { AppError } from '../middleware/errorHandler';
import { sendSuccess } from '../utils';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
      return;
    }

    const data = await getCart(req.user.id);
    sendSuccess(res, 200, data, 'Cart retrieved');
  } catch (error) {
    next(error);
  }
});

router.post(
  '/items',
  validateBody(addCartItemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
        return;
      }

      const data = await addCartItem(req.user.id, req.body as AddCartItemInput);
      sendSuccess(res, 201, data, 'Item added to cart');
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  '/items/:cartItemId',
  validateParams(cartItemParamsSchema),
  validateBody(updateCartItemSchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const request = _req;
      if (!request.user) {
        next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
        return;
      }

      const params = res.locals.validatedParams as CartItemParamsInput;
      const body = request.body as UpdateCartItemInput;
      const data = await updateCartItem(request.user.id, params.cartItemId, body);
      sendSuccess(res, 200, data, 'Cart item updated');
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  '/items/:cartItemId',
  validateParams(cartItemParamsSchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const request = _req;
      if (!request.user) {
        next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
        return;
      }

      const params = res.locals.validatedParams as CartItemParamsInput;
      const data = await removeCartItem(request.user.id, params.cartItemId);
      sendSuccess(res, 200, data, 'Cart item removed');
    } catch (error) {
      next(error);
    }
  },
);

export default router;
