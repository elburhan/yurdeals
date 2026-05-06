// ============================================
// Standard API Response Helpers
// ============================================

import { Response } from 'express';
import { PaginationMeta } from '@yurdeals/shared';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
  message: string;
  meta?: PaginationMeta;
}

export function sendSuccess<T>(
  res: Response,
  statusCode: number,
  data: T,
  message: string,
  meta?: PaginationMeta,
): void {
  const body: SuccessEnvelope<T> = {
    success: true,
    data,
    message,
  };

  if (meta) {
    body.meta = meta;
  }

  res.status(statusCode).json(body);
}
