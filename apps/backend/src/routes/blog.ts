// ============================================
// Public Blog Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { validateParams, validateQuery } from '../middleware';
import {
  blogParamsSchema,
  BlogParamsInput,
  blogQuerySchema,
  BlogQueryInput,
  FeaturedBlogQueryInput,
  featuredBlogQuerySchema,
} from '../schemas/blog.schema';
import {
  getBlogCategories,
  getFeaturedBlogPosts,
  getPublishedBlogPost,
  listPublishedBlogPosts,
} from '../services/blog.service';
import { sendSuccess } from '../utils/response';

const router = Router();

router.get(
  '/',
  validateQuery(blogQuerySchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const query = res.locals.validatedQuery as BlogQueryInput;
      const result = await listPublishedBlogPosts(query);
      sendSuccess(res, 200, result.data, 'Blog posts retrieved', result.meta);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/featured',
  validateQuery(featuredBlogQuerySchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const query = res.locals.validatedQuery as FeaturedBlogQueryInput;
      const data = await getFeaturedBlogPosts(query);
      sendSuccess(res, 200, data, 'Featured blog posts retrieved');
    } catch (error) {
      next(error);
    }
  },
);

router.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getBlogCategories();
    sendSuccess(res, 200, data, 'Blog categories retrieved');
  } catch (error) {
    next(error);
  }
});

router.get(
  '/:slug',
  validateParams(blogParamsSchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const params = res.locals.validatedParams as BlogParamsInput;
      const data = await getPublishedBlogPost(params.slug);
      sendSuccess(res, 200, data, 'Blog post retrieved');
    } catch (error) {
      next(error);
    }
  },
);

export default router;
