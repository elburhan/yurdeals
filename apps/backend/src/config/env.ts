// ============================================
// Environment Configuration — YurDeals Backend
// ============================================

import dotenv from 'dotenv';
import path from 'path';

// Load root env first, then backend env so app-specific values win locally.
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  API_VERSION: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_ACCESS_EXPIRES_IN_SECONDS: number;
  JWT_REFRESH_EXPIRES_IN_SECONDS: number;
  COOKIE_SECRET: string;
  COOKIE_SAME_SITE: 'lax' | 'strict' | 'none';
  CSRF_ENABLED: boolean;
  CORS_ORIGIN: string;
  FRONTEND_URL: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  AUTH_RATE_LIMIT_WINDOW_MS: number;
  AUTH_RATE_LIMIT_MAX_REQUESTS: number;
  ORDER_RATE_LIMIT_WINDOW_MS: number;
  ORDER_RATE_LIMIT_MAX_REQUESTS: number;
  PAYMENT_RATE_LIMIT_WINDOW_MS: number;
  PAYMENT_RATE_LIMIT_MAX_REQUESTS: number;
  PAYMENT_RECONCILIATION_THRESHOLD_MINUTES: number;
  PAYMENT_RECONCILIATION_BATCH_SIZE: number;
  ADMIN_RATE_LIMIT_WINDOW_MS: number;
  ADMIN_RATE_LIMIT_MAX_REQUESTS: number;
  WEBHOOK_RATE_LIMIT_WINDOW_MS: number;
  WEBHOOK_RATE_LIMIT_MAX_REQUESTS: number;
  RISK_MEDIUM_ORDER_TOTAL_NGN: number;
  RISK_HIGH_ORDER_TOTAL_NGN: number;
  RISK_EXTREME_ORDER_TOTAL_NGN: number;
  RISK_GUEST_ELEVATED_TOTAL_NGN: number;
  RISK_PREORDER_SPIKE_QTY_THRESHOLD: number;
  RISK_PREORDER_SPIKE_TOTAL_QTY_THRESHOLD: number;
  RISK_REPEATED_ORDER_LOOKBACK_MINUTES: number;
  RISK_REPEATED_ORDER_IP_THRESHOLD: number;
  RISK_PAYMENT_RETRY_ATTEMPTS_THRESHOLD: number;
  RISK_FAILED_PAYMENT_ATTEMPTS_THRESHOLD: number;
  RISK_LOW_SIGNAL_POINTS_FOR_MEDIUM: number;
  RISK_LOW_SIGNAL_POINTS_FOR_HIGH: number;
  RISK_MEDIUM_SIGNAL_POINTS_FOR_HIGH: number;
  PAYSTACK_SECRET_KEY: string;
  PAYSTACK_PUBLIC_KEY: string;
  PAYSTACK_CALLBACK_URL: string;
  FLUTTERWAVE_SECRET_KEY: string;
  FLUTTERWAVE_PUBLIC_KEY: string;
  FLUTTERWAVE_WEBHOOK_SECRET_HASH: string;
  FLUTTERWAVE_CALLBACK_URL: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  EMAIL_REPLY_TO: string;
  EMAIL_ENABLED: boolean;
  SENTRY_DSN: string;
  SENTRY_ENVIRONMENT: string;
  SENTRY_TRACES_SAMPLE_RATE: number;
}

function getEnvVar(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvInt(key: string, fallback: number): number {
  const value = process.env[key];
  if (value === undefined) return fallback;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid integer`);
  }
  return parsed;
}

function getEnvBoolean(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function getEnvRate(key: string, fallback: number): number {
  const value = process.env[key];
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`Environment variable ${key} must be a number between 0 and 1`);
  }

  return parsed;
}

function getCookieSameSite(fallback: EnvConfig['COOKIE_SAME_SITE']): EnvConfig['COOKIE_SAME_SITE'] {
  const value = process.env.COOKIE_SAME_SITE;
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'lax' || normalized === 'strict' || normalized === 'none') {
    return normalized;
  }

  throw new Error('Environment variable COOKIE_SAME_SITE must be one of: lax, strict, none');
}

function getRequiredRuntimeEnvVar(key: string): string {
  const value = process.env[key];
  if (value) {
    return value;
  }

  // Allow empty values in development/test (Phase 2+ features)
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    return '';
  }

  throw new Error(`Missing required environment variable: ${key}`);
}

function getOptionalRuntimeEnvVar(key: string): string {
  return process.env[key]?.trim() ?? '';
}

function getConditionalRuntimeEnvVars(
  keys: string[],
  activationKeys: string[] = keys,
): Record<string, string> {
  const values = Object.fromEntries(keys.map((key) => [key, getOptionalRuntimeEnvVar(key)]));
  const isEnabled = activationKeys.some((key) => (values[key] ?? '').length > 0);

  if (!isEnabled) {
    return Object.fromEntries(keys.map((key) => [key, '']));
  }

  const missingKeys = Object.entries(values)
    .filter(([, value]) => value.length === 0)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    throw new Error(
      `Incomplete optional provider configuration. Set all or none of: ${keys.join(', ')}. Missing: ${missingKeys.join(
        ', ',
      )}`,
    );
  }

  return values;
}

const flutterwaveConfig = getConditionalRuntimeEnvVars([
  'FLUTTERWAVE_SECRET_KEY',
  'FLUTTERWAVE_PUBLIC_KEY',
  'FLUTTERWAVE_WEBHOOK_SECRET_HASH',
  'FLUTTERWAVE_CALLBACK_URL',
], [
  'FLUTTERWAVE_SECRET_KEY',
  'FLUTTERWAVE_PUBLIC_KEY',
  'FLUTTERWAVE_WEBHOOK_SECRET_HASH',
]);

export const env: EnvConfig = {
  NODE_ENV: getEnvVar('NODE_ENV', 'development') as EnvConfig['NODE_ENV'],
  PORT: getEnvInt('PORT', 4000),
  API_VERSION: getEnvVar('API_VERSION', 'v1'),
  DATABASE_URL: getEnvVar('DATABASE_URL'),
  JWT_SECRET: getEnvVar('JWT_SECRET'),
  JWT_ACCESS_EXPIRES_IN_SECONDS: getEnvInt('JWT_ACCESS_EXPIRES_IN_SECONDS', 900),
  JWT_REFRESH_EXPIRES_IN_SECONDS: getEnvInt('JWT_REFRESH_EXPIRES_IN_SECONDS', 604800),
  COOKIE_SECRET: getEnvVar('COOKIE_SECRET'),
  COOKIE_SAME_SITE: getCookieSameSite(process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
  CSRF_ENABLED: getEnvBoolean('CSRF_ENABLED', process.env.NODE_ENV === 'production'),
  CORS_ORIGIN: getEnvVar('CORS_ORIGIN', 'http://localhost:5173'),
  FRONTEND_URL: getEnvVar('FRONTEND_URL', 'http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS: getEnvInt('RATE_LIMIT_WINDOW_MS', 60000),
  RATE_LIMIT_MAX_REQUESTS: getEnvInt('RATE_LIMIT_MAX_REQUESTS', 300),
  AUTH_RATE_LIMIT_WINDOW_MS: getEnvInt('AUTH_RATE_LIMIT_WINDOW_MS', 60000),
  AUTH_RATE_LIMIT_MAX_REQUESTS: getEnvInt('AUTH_RATE_LIMIT_MAX_REQUESTS', 100),
  ORDER_RATE_LIMIT_WINDOW_MS: getEnvInt('ORDER_RATE_LIMIT_WINDOW_MS', 60000),
  ORDER_RATE_LIMIT_MAX_REQUESTS: getEnvInt('ORDER_RATE_LIMIT_MAX_REQUESTS', 60),
  PAYMENT_RATE_LIMIT_WINDOW_MS: getEnvInt('PAYMENT_RATE_LIMIT_WINDOW_MS', 60000),
  PAYMENT_RATE_LIMIT_MAX_REQUESTS: getEnvInt('PAYMENT_RATE_LIMIT_MAX_REQUESTS', 60),
  PAYMENT_RECONCILIATION_THRESHOLD_MINUTES: getEnvInt('PAYMENT_RECONCILIATION_THRESHOLD_MINUTES', 15),
  PAYMENT_RECONCILIATION_BATCH_SIZE: getEnvInt('PAYMENT_RECONCILIATION_BATCH_SIZE', 50),
  ADMIN_RATE_LIMIT_WINDOW_MS: getEnvInt('ADMIN_RATE_LIMIT_WINDOW_MS', 60000),
  ADMIN_RATE_LIMIT_MAX_REQUESTS: getEnvInt('ADMIN_RATE_LIMIT_MAX_REQUESTS', 600),
  WEBHOOK_RATE_LIMIT_WINDOW_MS: getEnvInt('WEBHOOK_RATE_LIMIT_WINDOW_MS', 60000),
  WEBHOOK_RATE_LIMIT_MAX_REQUESTS: getEnvInt('WEBHOOK_RATE_LIMIT_MAX_REQUESTS', 600),
  RISK_MEDIUM_ORDER_TOTAL_NGN: getEnvInt('RISK_MEDIUM_ORDER_TOTAL_NGN', 150000),
  RISK_HIGH_ORDER_TOTAL_NGN: getEnvInt('RISK_HIGH_ORDER_TOTAL_NGN', 350000),
  RISK_EXTREME_ORDER_TOTAL_NGN: getEnvInt('RISK_EXTREME_ORDER_TOTAL_NGN', 1000000),
  RISK_GUEST_ELEVATED_TOTAL_NGN: getEnvInt('RISK_GUEST_ELEVATED_TOTAL_NGN', 150000),
  RISK_PREORDER_SPIKE_QTY_THRESHOLD: getEnvInt('RISK_PREORDER_SPIKE_QTY_THRESHOLD', 4),
  RISK_PREORDER_SPIKE_TOTAL_QTY_THRESHOLD: getEnvInt('RISK_PREORDER_SPIKE_TOTAL_QTY_THRESHOLD', 6),
  RISK_REPEATED_ORDER_LOOKBACK_MINUTES: getEnvInt('RISK_REPEATED_ORDER_LOOKBACK_MINUTES', 15),
  RISK_REPEATED_ORDER_IP_THRESHOLD: getEnvInt('RISK_REPEATED_ORDER_IP_THRESHOLD', 4),
  RISK_PAYMENT_RETRY_ATTEMPTS_THRESHOLD: getEnvInt('RISK_PAYMENT_RETRY_ATTEMPTS_THRESHOLD', 4),
  RISK_FAILED_PAYMENT_ATTEMPTS_THRESHOLD: getEnvInt('RISK_FAILED_PAYMENT_ATTEMPTS_THRESHOLD', 2),
  RISK_LOW_SIGNAL_POINTS_FOR_MEDIUM: getEnvInt('RISK_LOW_SIGNAL_POINTS_FOR_MEDIUM', 2),
  RISK_LOW_SIGNAL_POINTS_FOR_HIGH: getEnvInt('RISK_LOW_SIGNAL_POINTS_FOR_HIGH', 4),
  RISK_MEDIUM_SIGNAL_POINTS_FOR_HIGH: getEnvInt('RISK_MEDIUM_SIGNAL_POINTS_FOR_HIGH', 2),
  PAYSTACK_SECRET_KEY: getRequiredRuntimeEnvVar('PAYSTACK_SECRET_KEY'),
  PAYSTACK_PUBLIC_KEY: getRequiredRuntimeEnvVar('PAYSTACK_PUBLIC_KEY'),
  PAYSTACK_CALLBACK_URL: getRequiredRuntimeEnvVar('PAYSTACK_CALLBACK_URL'),
  FLUTTERWAVE_SECRET_KEY: flutterwaveConfig['FLUTTERWAVE_SECRET_KEY'] ?? '',
  FLUTTERWAVE_PUBLIC_KEY: flutterwaveConfig['FLUTTERWAVE_PUBLIC_KEY'] ?? '',
  FLUTTERWAVE_WEBHOOK_SECRET_HASH: flutterwaveConfig['FLUTTERWAVE_WEBHOOK_SECRET_HASH'] ?? '',
  FLUTTERWAVE_CALLBACK_URL: flutterwaveConfig['FLUTTERWAVE_CALLBACK_URL'] ?? '',
  CLOUDINARY_CLOUD_NAME: getRequiredRuntimeEnvVar('CLOUDINARY_CLOUD_NAME'),
  CLOUDINARY_API_KEY: getRequiredRuntimeEnvVar('CLOUDINARY_API_KEY'),
  CLOUDINARY_API_SECRET: getRequiredRuntimeEnvVar('CLOUDINARY_API_SECRET'),
  RESEND_API_KEY: getRequiredRuntimeEnvVar('RESEND_API_KEY'),
  EMAIL_FROM: getEnvVar('EMAIL_FROM', 'YurDeals <orders@yurdeals.com>'),
  EMAIL_REPLY_TO: getEnvVar('EMAIL_REPLY_TO', 'support@yurdeals.com'),
  EMAIL_ENABLED: getEnvBoolean('EMAIL_ENABLED', false),
  SENTRY_DSN: getOptionalRuntimeEnvVar('SENTRY_DSN'),
  SENTRY_ENVIRONMENT: getEnvVar('SENTRY_ENVIRONMENT', process.env.NODE_ENV ?? 'development'),
  SENTRY_TRACES_SAMPLE_RATE: getEnvRate('SENTRY_TRACES_SAMPLE_RATE', 0),
};

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isSentryEnabled = Boolean(env.SENTRY_DSN);
export const isFlutterwaveEnabled = Boolean(
  env.FLUTTERWAVE_SECRET_KEY &&
    env.FLUTTERWAVE_PUBLIC_KEY &&
    env.FLUTTERWAVE_WEBHOOK_SECRET_HASH &&
    env.FLUTTERWAVE_CALLBACK_URL,
);
