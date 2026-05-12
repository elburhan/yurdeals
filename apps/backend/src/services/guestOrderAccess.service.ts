// ============================================
// Guest Order Access Service
// ============================================

import crypto from 'crypto';
import { prisma, env } from '../config';
import { AppError } from '../middleware/errorHandler';

const GUEST_ACCESS_TOKEN_BYTES = 24;
const GUEST_ACCESS_TOKEN_TTL_DAYS = 30;
const GUEST_ACCESS_TOKEN_HASH_PREFIX = 'hmac-sha256:';
const LEGACY_GUEST_ACCESS_TOKEN_PREFIX = '[guestAccessToken:';

export function generateGuestAccessToken(): string {
  return crypto.randomBytes(GUEST_ACCESS_TOKEN_BYTES).toString('hex');
}

export function hashGuestAccessToken(token: string): string {
  const digest = crypto.createHmac('sha256', env.COOKIE_SECRET).update(token).digest('hex');
  return `${GUEST_ACCESS_TOKEN_HASH_PREFIX}${digest}`;
}

export function getGuestAccessTokenExpiry(now = new Date()): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + GUEST_ACCESS_TOKEN_TTL_DAYS);
  return expiresAt;
}

export async function verifyGuestOrderAccess(orderId: string, token: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      guestAccessTokenHash: true,
      guestAccessTokenExpiresAt: true,
      notes: true,
    },
  });

  if (!order) {
    throwGuestAccessDenied();
  }

  if (order.guestAccessTokenHash) {
    if (isExpired(order.guestAccessTokenExpiresAt) || !tokenMatchesHash(token, order.guestAccessTokenHash)) {
      throwGuestAccessDenied();
    }
    return;
  }

  // TODO: Remove this legacy fallback after old note-token guest orders have aged out.
  if (order.notes?.includes(createLegacyGuestTokenTag(token))) {
    return;
  }

  throwGuestAccessDenied();
}

function tokenMatchesHash(token: string, expectedHash: string): boolean {
  const candidateHash = hashGuestAccessToken(token);
  const candidate = Buffer.from(candidateHash);
  const expected = Buffer.from(expectedHash);

  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function isExpired(expiresAt: Date | null): boolean {
  return Boolean(expiresAt && expiresAt.getTime() <= Date.now());
}

function createLegacyGuestTokenTag(token: string): string {
  return `${LEGACY_GUEST_ACCESS_TOKEN_PREFIX}${token}]`;
}

function throwGuestAccessDenied(): never {
  throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
}
