// ============================================
// Centralized Error Handler Middleware
// ============================================

import { Request, Response, NextFunction } from 'express';
import { isProduction } from '../config';
import { logger } from '../utils';

/**
 * Custom application error with HTTP status code.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * 404 handler — catches unmatched routes.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

/**
 * Global error handler — formats and sends error responses.
 * Never exposes stack traces in production.
 */
export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';

  // Log all errors
  logger.error(err.message, {
    code,
    statusCode,
    stack: isDev() ? err.stack : undefined,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: isProduction && statusCode === 500 ? 'An unexpected error occurred' : err.message,
      ...(isDev() && { stack: err.stack }),
    },
  });
}

function isDev(): boolean {
  return !isProduction;
}
