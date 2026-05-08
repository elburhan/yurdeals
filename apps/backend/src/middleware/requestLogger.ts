// ============================================
// Request Logger Middleware with Correlation IDs
// ============================================

import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../utils';

const CORRELATION_ID_HEADER = 'X-Request-ID';

declare module 'express-serve-static-core' {
  interface Request {
    correlationId?: string;
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const correlationId = getOrCreateCorrelationId(req);
  const startedAt = process.hrtime.bigint();

  req.correlationId = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);

  res.on('finish', () => {
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const path = req.originalUrl || req.url;
    const routeType = classifyRoute(path);
    const meta = {
      correlationId,
      method: req.method,
      path,
      statusCode: res.statusCode,
      latencyMs: Number(latencyMs.toFixed(2)),
      userId: req.user?.id ?? null,
      ip: getRequestIp(req),
      userAgent: getHeaderValue(req.headers['user-agent']),
      referer: getHeaderValue(req.headers.referer),
      routeType,
    };

    if (res.statusCode >= 500) {
      logger.error('request_completed', meta);
      return;
    }

    if (res.statusCode >= 400) {
      logger.warn('request_completed', meta);
      return;
    }

    logger.info('request_completed', meta);
  });

  next();
}

export function getCorrelationId(req: Request): string | undefined {
  return req.correlationId;
}

function getOrCreateCorrelationId(req: Request): string {
  const existing = req.header(CORRELATION_ID_HEADER) ?? req.header('X-Correlation-ID');
  return existing?.trim() || randomUUID();
}

function getRequestIp(req: Request): string {
  if (typeof req.ip === 'string' && req.ip.length > 0) {
    return req.ip;
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return req.socket.remoteAddress ?? 'unknown';
}

function classifyRoute(path: string): 'webhook' | 'payment' | 'api' {
  if (path.includes('/webhooks') || path.includes('/paystack/webhook')) {
    return 'webhook';
  }

  if (path.includes('/payments')) {
    return 'payment';
  }

  return 'api';
}

function getHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0] ?? null;
  }

  return null;
}
