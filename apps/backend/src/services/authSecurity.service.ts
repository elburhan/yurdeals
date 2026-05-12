import { logger, normalizeAuthIdentifier } from '../utils';
import { AppError } from '../middleware/errorHandler';

const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCKOUT_MS = 10 * 60 * 1000;

interface LoginFailureRecord {
  count: number;
  firstFailureAt: number;
  lockedUntil: number | null;
}

const loginFailures = new Map<string, LoginFailureRecord>();

export function assertLoginAttemptAllowed(identifier: string, ip: string): void {
  const key = getLoginKey(identifier, ip);
  const record = loginFailures.get(key);

  if (!record) {
    return;
  }

  const now = Date.now();
  if (record.lockedUntil && record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);

    logger.warn('Login temporarily blocked after repeated failures', {
      ip,
      identifierType: normalizeAuthIdentifier(identifier).type,
      retryAfterSeconds,
    });

    throw new AppError(
      'Too many failed login attempts. Please try again later.',
      429,
      'LOGIN_TEMPORARILY_LOCKED',
      true,
      undefined,
      { retryAfterSeconds },
    );
  }

  if (now - record.firstFailureAt > LOGIN_FAILURE_WINDOW_MS) {
    loginFailures.delete(key);
  }
}

export function recordFailedLoginAttempt(identifier: string, ip: string): void {
  const key = getLoginKey(identifier, ip);
  const now = Date.now();
  const existing = loginFailures.get(key);

  if (!existing || now - existing.firstFailureAt > LOGIN_FAILURE_WINDOW_MS) {
    loginFailures.set(key, {
      count: 1,
      firstFailureAt: now,
      lockedUntil: null,
    });
    return;
  }

  const nextCount = existing.count + 1;
  const lockedUntil = nextCount >= LOGIN_MAX_FAILURES ? now + LOGIN_LOCKOUT_MS : null;

  loginFailures.set(key, {
    count: nextCount,
    firstFailureAt: existing.firstFailureAt,
    lockedUntil,
  });

  if (lockedUntil) {
    logger.warn('Login lockout triggered', {
      ip,
      identifierType: normalizeAuthIdentifier(identifier).type,
      failureCount: nextCount,
      retryAfterSeconds: Math.ceil(LOGIN_LOCKOUT_MS / 1000),
    });
  }
}

export function clearFailedLoginAttempts(identifier: string, ip: string): void {
  loginFailures.delete(getLoginKey(identifier, ip));
}

function getLoginKey(identifier: string, ip: string): string {
  const normalized = normalizeAuthIdentifier(identifier);
  return `${ip}:${normalized.type}:${normalized.canonical}`;
}
