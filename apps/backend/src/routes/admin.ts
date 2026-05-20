// ============================================
// Admin Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import {
  adminRateLimiter,
  requireAuth,
  requireRole,
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware';
import {
  adminCreateProductSchema,
  adminOrderParamsSchema,
  AdminOrderParamsInput,
  adminOrderQuerySchema,
  AdminOrderQueryInput,
  adminProductParamsSchema,
  AdminProductParamsInput,
  adminProductQuerySchema,
  AdminProductQueryInput,
  adminShipmentQuerySchema,
  AdminShipmentQueryInput,
  adminUpdateOrderRiskReviewSchema,
  AdminUpdateOrderRiskReviewInput,
  adminUpdateOrderStatusSchema,
  AdminUpdateOrderStatusInput,
  adminUpdateProductSchema,
  AdminCreateProductInput,
  AdminUpdateProductInput,
} from '../schemas/admin.schema';
import {
  adminBlogPostParamsSchema,
  AdminBlogPostParamsInput,
  adminBlogPostQuerySchema,
  AdminBlogPostQueryInput,
  adminCreateBlogPostSchema,
  AdminCreateBlogPostInput,
  adminUpdateBlogPostSchema,
  AdminUpdateBlogPostInput,
} from '../schemas/blog.schema';
import {
  createAdminProduct,
  deleteAdminProduct,
  getAdminOrder,
  getAdminOverview,
  listAdminOrders,
  listAdminProducts,
  listAdminShipments,
  updateAdminOrderRiskReview,
  updateAdminOrderStatus,
  updateAdminProduct,
} from '../services/admin.service';
import { reconcilePendingPaystackPayments } from '../services/paymentReconciliation.service';
import {
  archiveAdminBlogPost,
  createAdminBlogPost,
  getAdminBlogPost,
  listAdminBlogPosts,
  updateAdminBlogPost,
} from '../services/blog.service';
import { getPaginationMeta, sendSuccess } from '../utils';
import { uploadProductImage } from '../lib/cloudinary';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req: Express.Request, file: Express.Multer.File, callback: FileFilterCallback) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new AppError('Only image files are allowed', 422, 'INVALID_UPLOAD_FILE'));
      return;
    }

    callback(null, true);
  },
});

router.use(requireAuth, requireRole(['ADMIN']), adminRateLimiter);

router.post(
  '/uploads/product-image',
  productImageUpload.single('image'),
  async (req: Request & { file?: Express.Multer.File }, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError('Product image file is required', 422, 'PRODUCT_IMAGE_REQUIRED');
      }

      const data = await uploadProductImage(req.file.buffer);
      sendSuccess(res, 201, data, 'Product image uploaded');
    } catch (error) {
      next(error);
    }
  },
);

router.get('/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getAdminOverview();
    sendSuccess(res, 200, data, 'Admin overview retrieved');
  } catch (error) {
    next(error);
  }
});

router.post('/payments/reconcile', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reconcilePendingPaystackPayments();
    sendSuccess(res, 200, data, 'Payment reconciliation completed');
  } catch (error) {
    next(error);
  }
});

router.get(
  '/blog-posts',
  validateQuery(adminBlogPostQuerySchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const query = res.locals.validatedQuery as AdminBlogPostQueryInput;
      const data = await listAdminBlogPosts(query);
      sendSuccess(res, 200, data, 'Admin blog posts retrieved');
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/blog-posts',
  validateBody(adminCreateBlogPostSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await createAdminBlogPost(req.body as AdminCreateBlogPostInput, {
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      sendSuccess(res, 201, data, 'Blog post created');
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/blog-posts/:postId',
  validateParams(adminBlogPostParamsSchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const params = res.locals.validatedParams as AdminBlogPostParamsInput;
      const data = await getAdminBlogPost(params.postId);
      sendSuccess(res, 200, data, 'Admin blog post retrieved');
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  '/blog-posts/:postId',
  validateParams(adminBlogPostParamsSchema),
  validateBody(adminUpdateBlogPostSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = res.locals.validatedParams as AdminBlogPostParamsInput;
      const data = await updateAdminBlogPost(params.postId, req.body as AdminUpdateBlogPostInput, {
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      sendSuccess(res, 200, data, 'Blog post updated');
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/blog-posts/:postId',
  validateParams(adminBlogPostParamsSchema),
  validateBody(adminUpdateBlogPostSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = res.locals.validatedParams as AdminBlogPostParamsInput;
      const data = await updateAdminBlogPost(params.postId, req.body as AdminUpdateBlogPostInput, {
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      sendSuccess(res, 200, data, 'Blog post updated');
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  '/blog-posts/:postId',
  validateParams(adminBlogPostParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = res.locals.validatedParams as AdminBlogPostParamsInput;
      const data = await archiveAdminBlogPost(params.postId, {
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      sendSuccess(res, 200, data, 'Blog post archived');
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/products',
  validateQuery(adminProductQuerySchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const query = res.locals.validatedQuery as AdminProductQueryInput;
      const result = await listAdminProducts(query);
      sendSuccess(
        res,
        200,
        result.data,
        'Admin products retrieved',
        getPaginationMeta(query, result.total),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/products',
  validateBody(adminCreateProductSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await createAdminProduct(req.body as AdminCreateProductInput, {
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      sendSuccess(res, 201, data, 'Product created');
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  '/products/:productId',
  validateParams(adminProductParamsSchema),
  validateBody(adminUpdateProductSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = res.locals.validatedParams as AdminProductParamsInput;
      const data = await updateAdminProduct(params.productId, req.body as AdminUpdateProductInput, {
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      sendSuccess(res, 200, data, 'Product updated');
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  '/products/:productId',
  validateParams(adminProductParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = res.locals.validatedParams as AdminProductParamsInput;
      const data = await deleteAdminProduct(params.productId, {
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      sendSuccess(res, 200, data, 'Product deleted from storefront');
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/orders',
  validateQuery(adminOrderQuerySchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const query = res.locals.validatedQuery as AdminOrderQueryInput;
      const result = await listAdminOrders(query);
      sendSuccess(
        res,
        200,
        result.data,
        'Admin orders retrieved',
        getPaginationMeta(query, result.total),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/orders/:orderId',
  validateParams(adminOrderParamsSchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const params = res.locals.validatedParams as AdminOrderParamsInput;
      const data = await getAdminOrder(params.orderId);
      sendSuccess(res, 200, data, 'Admin order retrieved');
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/orders/:orderId/risk-review',
  validateParams(adminOrderParamsSchema),
  validateBody(adminUpdateOrderRiskReviewSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = res.locals.validatedParams as AdminOrderParamsInput;
      const body = req.body as AdminUpdateOrderRiskReviewInput;
      const data = await updateAdminOrderRiskReview(params.orderId, body, {
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      sendSuccess(res, 200, data, 'Order risk review updated');
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/orders/:orderId/status',
  validateParams(adminOrderParamsSchema),
  validateBody(adminUpdateOrderStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = res.locals.validatedParams as AdminOrderParamsInput;
      const body = req.body as AdminUpdateOrderStatusInput;
      const data = await updateAdminOrderStatus(params.orderId, body.status, {
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      sendSuccess(res, 200, data, 'Order status updated');
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/shipments',
  validateQuery(adminShipmentQuerySchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const query = res.locals.validatedQuery as AdminShipmentQueryInput;
      const result = await listAdminShipments(query);
      sendSuccess(
        res,
        200,
        result.data,
        'Admin shipments retrieved',
        getPaginationMeta(query, result.total),
      );
    } catch (error) {
      next(error);
    }
  },
);

export default router;
