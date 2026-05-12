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
  ADMIN_RATE_LIMIT_WINDOW_MS: number;
  ADMIN_RATE_LIMIT_MAX_REQUESTS: number;
  WEBHOOK_RATE_LIMIT_WINDOW_MS: number;
  WEBHOOK_RATE_LIMIT_MAX_REQUESTS: number;
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

export const env: EnvConfig = {
  NODE_ENV: getEnvVar('NODE_ENV', 'development') as EnvConfig['NODE_ENV'],
  PORT: getEnvInt('PORT', 4000),
  API_VERSION: getEnvVar('API_VERSION', 'v1'),
  DATABASE_URL: getEnvVar('DATABASE_URL'),
  JWT_SECRET: getEnvVar('JWT_SECRET'),
  JWT_ACCESS_EXPIRES_IN_SECONDS: getEnvInt('JWT_ACCESS_EXPIRES_IN_SECONDS', 900),
  JWT_REFRESH_EXPIRES_IN_SECONDS: getEnvInt('JWT_REFRESH_EXPIRES_IN_SECONDS', 604800),
  COOKIE_SECRET: getEnvVar('COOKIE_SECRET'),
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
  ADMIN_RATE_LIMIT_WINDOW_MS: getEnvInt('ADMIN_RATE_LIMIT_WINDOW_MS', 60000),
  ADMIN_RATE_LIMIT_MAX_REQUESTS: getEnvInt('ADMIN_RATE_LIMIT_MAX_REQUESTS', 600),
  WEBHOOK_RATE_LIMIT_WINDOW_MS: getEnvInt('WEBHOOK_RATE_LIMIT_WINDOW_MS', 60000),
  WEBHOOK_RATE_LIMIT_MAX_REQUESTS: getEnvInt('WEBHOOK_RATE_LIMIT_MAX_REQUESTS', 600),
  PAYSTACK_SECRET_KEY: getRequiredRuntimeEnvVar('PAYSTACK_SECRET_KEY'),
  PAYSTACK_PUBLIC_KEY: getRequiredRuntimeEnvVar('PAYSTACK_PUBLIC_KEY'),
  PAYSTACK_CALLBACK_URL: getRequiredRuntimeEnvVar('PAYSTACK_CALLBACK_URL'),
  FLUTTERWAVE_SECRET_KEY: getRequiredRuntimeEnvVar('FLUTTERWAVE_SECRET_KEY'),
  FLUTTERWAVE_PUBLIC_KEY: getRequiredRuntimeEnvVar('FLUTTERWAVE_PUBLIC_KEY'),
  FLUTTERWAVE_WEBHOOK_SECRET_HASH: getRequiredRuntimeEnvVar('FLUTTERWAVE_WEBHOOK_SECRET_HASH'),
  FLUTTERWAVE_CALLBACK_URL: getRequiredRuntimeEnvVar('FLUTTERWAVE_CALLBACK_URL'),
  CLOUDINARY_CLOUD_NAME: getRequiredRuntimeEnvVar('CLOUDINARY_CLOUD_NAME'),
  CLOUDINARY_API_KEY: getRequiredRuntimeEnvVar('CLOUDINARY_API_KEY'),
  CLOUDINARY_API_SECRET: getRequiredRuntimeEnvVar('CLOUDINARY_API_SECRET'),
  RESEND_API_KEY: getRequiredRuntimeEnvVar('RESEND_API_KEY'),
  EMAIL_FROM: getEnvVar('EMAIL_FROM', 'YurDeals <orders@yurdeals.com>'),
  EMAIL_REPLY_TO: getEnvVar('EMAIL_REPLY_TO', 'support@yurdeals.com'),
  EMAIL_ENABLED: getEnvBoolean('EMAIL_ENABLED', false),
};

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
