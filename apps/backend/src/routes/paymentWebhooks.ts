// ============================================
// Payment Webhook Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { validateParams, webhookRateLimiter } from '../middleware';
import { webhookProviderParamsSchema, WebhookProviderParamsInput } from '../schemas/payment.schema';
import { handlePaymentWebhook } from '../services/payment.service';
import { sendSuccess } from '../utils';
import { AppError } from '../middleware/errorHandler';

const router = Router();

router.post(
  '/:provider',
  webhookRateLimiter,
  validateParams(webhookProviderParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!Buffer.isBuffer(req.body)) {
        next(new AppError('Webhook body must be raw bytes', 400, 'INVALID_WEBHOOK_BODY'));
        return;
      }

      const params = res.locals.validatedParams as WebhookProviderParamsInput;
      const data = await handlePaymentWebhook(
        params.provider,
        req.body,
        normalizeHeaders(req.headers),
      );
      sendSuccess(res, 200, data, 'Webhook processed');
    } catch (error) {
      next(error);
    }
  },
);

function normalizeHeaders(headers: Request['headers']): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      normalized[key.toLowerCase()] = value.join(',');
    } else if (value !== undefined) {
      normalized[key.toLowerCase()] = value;
    }
  }

  return normalized;
}

export default router;
