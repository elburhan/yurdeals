// ============================================
// Auth Service — Business Logic Layer
// ============================================

import bcrypt from 'bcryptjs';
import { UserRole } from '@yurdeals/shared';
import { prisma } from '../config';
import { AppError } from '../middleware/errorHandler';
import { signAccessToken, signRefreshToken, JwtPayload } from '../utils/jwt';
import { SAFE_USER_SELECT } from '../middleware/auth';
import { logger } from '../utils';
import { LoginInput, RegisterInput } from '../schemas/auth.schema';

const BCRYPT_COST = 12;

/** Shape returned to the client for authenticated user */
interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  avatar: string | null;
  isVerified: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Register a new customer account.
 */
export async function registerUser(
  input: RegisterInput,
): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  const normalizedPhone = normalizePhone(input.phone);
  if (!normalizedPhone) {
    throw new AppError('Phone number is required', 422, 'PHONE_REQUIRED');
  }
  const email = input.email ?? createInternalPhoneEmail(normalizedPhone);
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
        ...(input.email ? [{ email: input.email }] : []),
      ],
    },
    select: { id: true, email: true, phone: true },
  });

  if (existingUser) {
    throw new AppError('An account with this email or phone already exists', 409, 'ACCOUNT_TAKEN');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const { firstName, lastName } = splitFullName(input.name);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      phone: normalizedPhone ?? null,
      role: UserRole.CUSTOMER,
    },
    select: SAFE_USER_SELECT,
  });

  logger.info('User registered', {
    userId: user.id,
    email: user.email,
    hasPhone: Boolean(user.phone),
  });

  // Generate tokens
  const tokenPayload: JwtPayload = { userId: user.id, role: user.role };
  const tokens: AuthTokens = {
    accessToken: signAccessToken(tokenPayload),
    refreshToken: signRefreshToken(tokenPayload),
  };

  return { user, tokens };
}

/**
 * Login with email/phone and password.
 */
export async function loginUser(
  input: LoginInput,
): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  // Find user — we MUST select passwordHash here for comparison, but never return it
  const identifier = input.identifier.trim();
  const user = await prisma.user.findFirst({
    where: identifier.includes('@')
      ? { email: identifier.toLowerCase() }
      : { phone: normalizePhone(identifier) },
    select: {
      ...SAFE_USER_SELECT,
      passwordHash: true,
    },
  });

  if (!user) {
    throw new AppError('Invalid email/phone or password', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new AppError('Account has been deactivated', 403, 'ACCOUNT_DEACTIVATED');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError('Invalid email/phone or password', 401, 'INVALID_CREDENTIALS');
  }

  // Update last login timestamp
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  logger.info('User logged in', { userId: user.id, email: user.email });

  // Generate tokens
  const tokenPayload: JwtPayload = { userId: user.id, role: user.role };
  const tokens: AuthTokens = {
    accessToken: signAccessToken(tokenPayload),
    refreshToken: signRefreshToken(tokenPayload),
  };

  // Strip passwordHash before returning
  const { passwordHash: _hash, ...safeUser } = user;

  return { user: safeUser, tokens };
}

/**
 * Get current user profile (already authenticated).
 */
export async function getCurrentUser(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: SAFE_USER_SELECT,
  });

  if (!user || !user.isActive) {
    throw new AppError('User not found or inactive', 404, 'USER_NOT_FOUND');
  }

  return user;
}

function splitFullName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] ?? name.trim();
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName;

  return { firstName, lastName };
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

function createInternalPhoneEmail(phone?: string): string {
  const normalized = phone?.replace(/[^\d]/g, '');
  if (!normalized) {
    throw new AppError('Email or phone is required', 422, 'CONTACT_REQUIRED');
  }

  return `phone_${normalized}@phone.yurdeals.local`;
}
