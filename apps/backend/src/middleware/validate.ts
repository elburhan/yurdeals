// ============================================
// Zod Validation Middleware
// ============================================

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from './errorHandler';

/**
 * Creates Express middleware that validates `req.body` against a Zod schema.
 * On failure, returns a 422 with field-level validation errors.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      handleValidationError(error, next);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.locals.validatedQuery = schema.parse(req.query);
      next();
    } catch (error) {
      handleValidationError(error, next);
    }
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.locals.validatedParams = schema.parse(req.params);
      next();
    } catch (error) {
      handleValidationError(error, next);
    }
  };
}

function handleValidationError(error: unknown, next: NextFunction): void {
  if (error instanceof ZodError) {
    const details = error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    next(new AppError('Invalid input data', 422, 'VALIDATION_ERROR', true, details));
    return;
  }

  next(error);
}
