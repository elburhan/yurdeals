// ============================================
// Paystack Webhook Alias Route
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { webhookRateLimiter } from '../middleware';
import { handlePaymentWebhook } from '../services/payment.service';
import { handlePaystackTransferWebhook, isPaystackTransferWebhook } from '../services/transfer.service';
import { sendSuccess } from '../utils';
import { AppError } from '../middleware/errorHandler';

const router = Router();

router.post(
  '/',
  webhookRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!Buffer.isBuffer(req.body)) {
        next(new AppError('Webhook body must be raw bytes', 400, 'INVALID_WEBHOOK_BODY'));
        return;
      }

      const normalizedHeaders = normalizeHeaders(req.headers);

      if (isPaystackTransferWebhook(req.body)) {
        const data = await handlePaystackTransferWebhook(req.body, normalizedHeaders);
        sendSuccess(res, 200, data, 'Paystack transfer webhook processed');
        return;
      }

      const data = await handlePaymentWebhook('paystack', req.body, normalizedHeaders);
      sendSuccess(res, 200, data, 'Paystack payment webhook processed');
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
