import type { Express } from 'express';
import * as Sentry from '@sentry/node';
import type { ErrorEvent, EventHint } from '@sentry/node';
import { env, isSentryEnabled } from '../config';
import { logger } from '../utils';

const SENTRY_FLUSH_TIMEOUT_MS = 2000;
const REDACTED = '[Filtered]';
let hasInitializedSentry = false;

const SENSITIVE_KEY_PATTERN =
  /password|passcode|otp|verification[_-]?code|token|secret|authorization|cookie|set-cookie|api[_-]?key|paystack[_-]?.*key|flutterwave[_-]?.*secret|card|cvv|cvc|pan|access[_-]?code|authorization[_-]?code|provider[_-]?payload|raw[_-]?payload|raw[_-]?body|payload/i;

export function initSentry(): void {
  if (hasInitializedSentry) {
    return;
  }

  if (!isSentryEnabled) {
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    sendDefaultPii: false,
    beforeSend: sanitizeSentryEvent,
  });

  logger.info('Sentry backend monitoring enabled', {
    environment: env.SENTRY_ENVIRONMENT,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  });
  hasInitializedSentry = true;
}

export function setupSentryExpressErrorHandler(app: Express): void {
  if (!isSentryEnabled) {
    return;
  }

  Sentry.setupExpressErrorHandler(app);
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!isSentryEnabled) {
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('yurdeals', sanitizeUnknown(context) as Record<string, unknown>);
    }

    Sentry.captureException(error);
  });
}

export async function captureAndFlushException(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  captureException(error, context);

  if (!isSentryEnabled) {
    return;
  }

  await Sentry.flush(SENTRY_FLUSH_TIMEOUT_MS);
}

export function installSentryProcessMonitors(): void {
  if (!isSentryEnabled) {
    return;
  }

  process.on('uncaughtExceptionMonitor', (error) => {
    captureException(error, { source: 'uncaughtExceptionMonitor' });
  });
}

function sanitizeSentryEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent {
  const sanitizedEvent = sanitizeUnknown(event) as ErrorEvent;

  if (sanitizedEvent.request) {
    sanitizedEvent.request.headers = sanitizeUnknown(sanitizedEvent.request.headers) as Record<
      string,
      string
    >;

    if (typeof sanitizedEvent.request.query_string === 'string') {
      sanitizedEvent.request.query_string = sanitizeQueryString(sanitizedEvent.request.query_string);
    }

    if ('data' in sanitizedEvent.request) {
      sanitizedEvent.request.data = sanitizeUnknown(sanitizedEvent.request.data);
    }
  }

  return sanitizedEvent;
}

function sanitizeUnknown(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return '[Truncated]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknown(item, depth + 1));
  }

  if (!value || typeof value !== 'object') {
    return sanitizeString(value);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
    sanitized[key] = isSensitiveKey(key) ? REDACTED : sanitizeUnknown(childValue, depth + 1);
  }

  return sanitized;
}

function sanitizeString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
    .replace(/(access_token|refresh_token|guestAccessToken|api_key|secret)=([^&\s]+)/gi, `$1=${REDACTED}`);
}

function sanitizeQueryString(queryString: string): string {
  const params = new URLSearchParams(queryString.startsWith('?') ? queryString.slice(1) : queryString);
  for (const key of Array.from(params.keys())) {
    if (isSensitiveKey(key)) {
      params.set(key, REDACTED);
    }
  }

  return params.toString();
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

initSentry();
