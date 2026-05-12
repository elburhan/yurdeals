// ============================================
// Auth Service — Business Logic Layer
// ============================================

import bcrypt from 'bcryptjs';
import { OtpChannel } from '@prisma/client';
import { UserRole } from '@yurdeals/shared';
import { prisma } from '../config';
import { AppError } from '../middleware/errorHandler';
import { signAccessToken, signRefreshToken, JwtPayload } from '../utils/jwt';
import { SAFE_USER_SELECT } from '../middleware/auth';
import { logger, normalizeAuthIdentifier, normalizeEmail, normalizePhone } from '../utils';
import { LoginInput, RegisterInput, ResendOtpInput, VerifyOtpInput } from '../schemas/auth.schema';
import {
  createSignupOtpChallenge,
  resendOtpChallenge,
  verifyOtpChallenge,
  VerificationChallenge,
} from './otp.service';
import {
  assertLoginAttemptAllowed,
  clearFailedLoginAttempts,
  recordFailedLoginAttempt,
} from './authSecurity.service';

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
  emailVerified: boolean;
  phoneVerified: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

interface PendingVerificationResult {
  user: AuthUser;
  verificationRequired: true;
  verification: VerificationChallenge;
}

/**
 * Register a new customer account.
 */
export async function registerUser(
  input: RegisterInput,
): Promise<PendingVerificationResult> {
  const normalizedPhone = normalizePhone(input.phone);
  if (!normalizedPhone) {
    throw new AppError('Phone number is required', 422, 'PHONE_REQUIRED');
  }
  const normalizedEmail = input.email ? normalizeEmail(input.email) : undefined;
  const email = normalizedEmail ?? createInternalPhoneEmail(normalizedPhone);
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
        ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
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
      emailVerified: false,
      phoneVerified: false,
      isVerified: false,
    },
    select: SAFE_USER_SELECT,
  });

  const channel = getPrimarySignupChannel(input);
  const verification = await createSignupOtpChallenge(
    {
      id: user.id,
      email: user.email,
      phone: user.phone,
    },
    channel,
  );

  logger.info('User registered', {
    userId: user.id,
    email: user.email,
    hasPhone: Boolean(user.phone),
    verificationChannel: channel,
  });

  return {
    user,
    verificationRequired: true,
    verification,
  };
}

/**
 * Login with email/phone and password.
 */
export async function loginUser(
  input: LoginInput,
  context?: { ip?: string },
): Promise<AuthResult> {
  const ip = context?.ip ?? 'unknown';
  assertLoginAttemptAllowed(input.identifier, ip);

  // Find user — we MUST select passwordHash here for comparison, but never return it
  const identifier = normalizeAuthIdentifier(input.identifier);
  const user = await prisma.user.findFirst({
    where:
      identifier.type === 'email'
        ? { email: identifier.canonical }
        : {
            OR: identifier.variants.map((phone) => ({ phone })),
          },
    select: {
      ...SAFE_USER_SELECT,
      passwordHash: true,
    },
  });

  if (!user) {
    recordFailedLoginAttempt(input.identifier, ip);
    await delayFailedAuthResponse();
    throw new AppError('Invalid email/phone or password', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new AppError('Account has been deactivated', 403, 'ACCOUNT_DEACTIVATED');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

  if (!isPasswordValid) {
    recordFailedLoginAttempt(input.identifier, ip);
    await delayFailedAuthResponse();
    throw new AppError('Invalid email/phone or password', 401, 'INVALID_CREDENTIALS');
  }

  clearFailedLoginAttempts(input.identifier, ip);

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

export async function verifyUserOtp(input: VerifyOtpInput): Promise<AuthResult> {
  const { userId } = await verifyOtpChallenge({
    verificationSessionId: input.verificationSessionId,
    identifier: input.identifier,
    channel: input.channel,
    otp: input.otp,
  });

  const user = await getCurrentUser(userId);
  const tokens = createTokensForUser(user.id, user.role);

  return { user, tokens };
}

export async function resendUserOtp(input: ResendOtpInput): Promise<VerificationChallenge> {
  const result = await resendOtpChallenge({
    verificationSessionId: input.verificationSessionId,
    identifier: input.identifier,
    channel: input.channel,
  });

  return {
    verificationSessionId: result.verificationSessionId,
    verificationTarget: result.verificationTarget,
    channel: result.channel,
    expiresInSeconds: result.expiresInSeconds,
  };
}

function splitFullName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] ?? name.trim();
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName;

  return { firstName, lastName };
}

function getPrimarySignupChannel(input: RegisterInput): OtpChannel {
  return input.email ? OtpChannel.EMAIL : OtpChannel.PHONE;
}

function createTokensForUser(userId: string, role: string): AuthTokens {
  const tokenPayload: JwtPayload = { userId, role: role as JwtPayload['role'] };
  return {
    accessToken: signAccessToken(tokenPayload),
    refreshToken: signRefreshToken(tokenPayload),
  };
}

function createInternalPhoneEmail(phone?: string): string {
  const normalized = phone?.replace(/[^\d]/g, '');
  if (!normalized) {
    throw new AppError('Email or phone is required', 422, 'CONTACT_REQUIRED');
  }

  return `phone_${normalized}@phone.yurdeals.local`;
}

async function delayFailedAuthResponse(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 300));
}
