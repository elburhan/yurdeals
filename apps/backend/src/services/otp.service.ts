import crypto from 'crypto';
import { OtpChannel, User } from '@prisma/client';
import { env, prisma } from '../config';
import { AppError } from '../middleware/errorHandler';
import { sendVerificationCodeNotification } from './notification.service';
import { expandPhoneLookupVariants, logger, normalizeEmail, normalizePhone } from '../utils';

const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_RESENDS = 3;
const OTP_RESEND_WINDOW_MINUTES = 30;

export interface VerificationChallenge {
  verificationSessionId: string;
  verificationTarget: string;
  channel: OtpChannel;
  expiresInSeconds: number;
}

interface VerificationLocator {
  verificationSessionId?: string;
  identifier?: string;
  channel: OtpChannel;
}

interface VerifyOtpInput extends VerificationLocator {
  otp: string;
}

interface ResendOtpResult extends VerificationChallenge {
  retryAfterSeconds: number | null;
}

export async function createSignupOtpChallenge(
  user: Pick<User, 'id' | 'email' | 'phone'>,
  channel: OtpChannel,
): Promise<VerificationChallenge> {
  const target = getUserVerificationTarget(user, channel);
  const verificationSessionId = crypto.randomUUID();
  const otp = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.otpCode.updateMany({
      where: {
        userId: user.id,
        channel,
        consumedAt: null,
        invalidatedAt: null,
      },
      data: {
        invalidatedAt: new Date(),
      },
    });

    await tx.otpCode.create({
      data: {
        userId: user.id,
        verificationSessionId,
        channel,
        target,
        codeHash: hashOtpCode(channel, target, otp),
        expiresAt,
      },
    });
  });

  // We only persist a hash in the database; the raw OTP is handed to the
  // notification abstraction and must never be logged in plaintext.
  await sendVerificationCodeNotification({
    channel,
    target,
    code: otp,
    expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
    verificationSessionId,
  });

  logger.info('Signup OTP created', {
    userId: user.id,
    channel,
    verificationSessionId,
    verificationTarget: maskVerificationTarget(target, channel),
  });

  return {
    verificationSessionId,
    verificationTarget: maskVerificationTarget(target, channel),
    channel,
    expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
  };
}

export async function verifyOtpChallenge(
  input: VerifyOtpInput,
): Promise<{ userId: string; channel: OtpChannel }> {
  const record = await findPendingOtp(input);

  if (!record) {
    logger.warn('OTP verification failed for missing or unusable challenge', {
      channel: input.channel,
      hasVerificationSessionId: Boolean(input.verificationSessionId),
    });
    throw new AppError('Invalid or expired verification code', 400, 'OTP_INVALID');
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    await invalidateOtpRecord(record.id);
    logger.warn('Expired OTP verification attempt blocked', {
      userId: record.userId,
      channel: record.channel,
      verificationSessionId: record.verificationSessionId,
    });
    throw new AppError('Verification code has expired', 400, 'OTP_EXPIRED');
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await invalidateOtpRecord(record.id);
    logger.warn('OTP verification blocked after max attempts', {
      userId: record.userId,
      channel: record.channel,
      verificationSessionId: record.verificationSessionId,
      attempts: record.attempts,
    });
    throw new AppError('Too many invalid attempts. Request a new verification code.', 429, 'OTP_ATTEMPTS_EXCEEDED');
  }

  const inputTarget = normalizeIdentifierForChannel(input.identifier ?? record.target, input.channel);
  const isMatch = timingSafeEqualHash(
    record.codeHash,
    hashOtpCode(record.channel, inputTarget, input.otp),
  );

  if (!isMatch) {
    const nextAttempts = record.attempts + 1;
    await prisma.otpCode.update({
      where: { id: record.id },
      data: {
        attempts: { increment: 1 },
        ...(nextAttempts >= OTP_MAX_ATTEMPTS ? { invalidatedAt: new Date() } : {}),
      },
    });

    logger.warn('OTP verification failed', {
      userId: record.userId,
      channel: record.channel,
      verificationSessionId: record.verificationSessionId,
      attempts: nextAttempts,
    });

    throw new AppError('Invalid or expired verification code', 400, 'OTP_INVALID');
  }

  await prisma.$transaction(async (tx) => {
    await tx.otpCode.update({
      where: { id: record.id },
      data: {
        consumedAt: new Date(),
      },
    });

    const verificationUpdate =
      record.channel === OtpChannel.EMAIL
        ? { emailVerified: true, isVerified: true }
        : { phoneVerified: true, isVerified: true };

    await tx.user.update({
      where: { id: record.userId },
      data: verificationUpdate,
    });
  });

  logger.info('OTP verified successfully', {
    userId: record.userId,
    channel: record.channel,
    verificationSessionId: record.verificationSessionId,
  });

  return { userId: record.userId, channel: record.channel };
}

export async function resendOtpChallenge(input: VerificationLocator): Promise<ResendOtpResult> {
  const record = await findLatestOtpByLocator(input);

  if (!record || record.channel !== input.channel) {
    logger.warn('OTP resend blocked for invalid session lookup', {
      channel: input.channel,
      hasVerificationSessionId: Boolean(input.verificationSessionId),
    });
    throw new AppError('Unable to resend verification code', 400, 'OTP_SESSION_NOT_FOUND');
  }

  if (record.consumedAt) {
    logger.warn('OTP resend blocked because challenge is already consumed', {
      userId: record.userId,
      channel: record.channel,
      verificationSessionId: record.verificationSessionId,
    });
    throw new AppError('Verification has already been completed', 409, 'OTP_ALREADY_CONSUMED');
  }

  if (record.invalidatedAt) {
    logger.warn('OTP resend blocked for invalidated challenge', {
      userId: record.userId,
      channel: record.channel,
      verificationSessionId: record.verificationSessionId,
    });
    throw new AppError('Request a new verification session', 409, 'OTP_INVALIDATED');
  }

  const secondsSinceLastSend = Math.floor((Date.now() - record.lastSentAt.getTime()) / 1000);
  if (secondsSinceLastSend < OTP_RESEND_COOLDOWN_SECONDS) {
    const retryAfterSeconds = OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLastSend;
    logger.warn('OTP resend cooldown enforced', {
      userId: record.userId,
      channel: record.channel,
      verificationSessionId: record.verificationSessionId,
      retryAfterSeconds,
    });
    throw new AppError(
      'Please wait before requesting another code',
      429,
      'OTP_RESEND_COOLDOWN',
      true,
      undefined,
      { retryAfterSeconds },
    );
  }

  const withinResendWindow =
    Date.now() - record.createdAt.getTime() <= OTP_RESEND_WINDOW_MINUTES * 60 * 1000;
  const nextResendCount = withinResendWindow ? record.resendCount + 1 : 1;
  if (nextResendCount > OTP_MAX_RESENDS) {
    logger.warn('OTP resend limit reached', {
      userId: record.userId,
      channel: record.channel,
      verificationSessionId: record.verificationSessionId,
      resendCount: nextResendCount,
    });
    throw new AppError(
      'Maximum resend limit reached. Start signup again to receive a new code.',
      429,
      'OTP_RESEND_LIMIT_REACHED',
    );
  }

  const otp = generateOtpCode();
  const verificationSessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.otpCode.update({
      where: { id: record.id },
      data: {
        invalidatedAt: new Date(),
      },
    });

    await tx.otpCode.create({
      data: {
        userId: record.userId,
        verificationSessionId,
        channel: record.channel,
        target: record.target,
        codeHash: hashOtpCode(record.channel, record.target, otp),
        expiresAt,
        resendCount: nextResendCount,
      },
    });
  });

  await sendVerificationCodeNotification({
    channel: record.channel,
    target: record.target,
    code: otp,
    expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
    verificationSessionId,
  });

  logger.info('OTP resent', {
    userId: record.userId,
    channel: record.channel,
    verificationSessionId,
    verificationTarget: maskVerificationTarget(record.target, record.channel),
    resendCount: nextResendCount,
  });

  return {
    verificationSessionId,
    verificationTarget: maskVerificationTarget(record.target, record.channel),
    channel: record.channel,
    expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
    retryAfterSeconds: null,
  };
}

function generateOtpCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function hashOtpCode(channel: OtpChannel, target: string, otp: string): string {
  // Bind the OTP hash to both channel and target so reused numeric codes do not
  // validate across different verification targets.
  return crypto
    .createHmac('sha256', getOtpSecret())
    .update(`${channel}:${target}:${otp}`)
    .digest('hex');
}

function timingSafeEqualHash(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getOtpSecret(): string {
  return env.COOKIE_SECRET || env.JWT_SECRET;
}

function getUserVerificationTarget(user: Pick<User, 'email' | 'phone'>, channel: OtpChannel): string {
  if (channel === OtpChannel.EMAIL) {
    return normalizeIdentifierForChannel(user.email, channel);
  }

  if (!user.phone) {
    throw new AppError('Phone number is required for verification', 422, 'PHONE_REQUIRED');
  }

  return normalizeIdentifierForChannel(user.phone, channel);
}

function normalizeIdentifierForChannel(identifier: string, channel: OtpChannel): string {
  if (channel === OtpChannel.EMAIL) {
    return normalizeEmail(identifier);
  }

  return normalizePhone(identifier);
}

async function findPendingOtp(input: VerificationLocator) {
  const record = await findLatestOtpByLocator(input);

  if (!record || record.channel !== input.channel || record.consumedAt || record.invalidatedAt) {
    return null;
  }

  return record;
}

async function findLatestOtpByLocator(input: VerificationLocator) {
  if (input.verificationSessionId) {
    return prisma.otpCode.findUnique({
      where: { verificationSessionId: input.verificationSessionId },
    });
  }

  if (!input.identifier) {
    return null;
  }

  return prisma.otpCode.findFirst({
    where: {
      channel: input.channel,
      ...(input.channel === OtpChannel.EMAIL
        ? {
            target: normalizeIdentifierForChannel(input.identifier, input.channel),
          }
        : {
            target: {
              in: expandPhoneLookupVariants(input.identifier),
            },
          }),
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function invalidateOtpRecord(id: string): Promise<void> {
  await prisma.otpCode.update({
    where: { id },
    data: { invalidatedAt: new Date() },
  });
}

function maskVerificationTarget(target: string, channel: OtpChannel): string {
  if (channel === OtpChannel.EMAIL) {
    const [localPartRaw, domain = ''] = target.split('@');
    const localPart = localPartRaw ?? '';
    const visibleLocal = localPart.slice(0, 2);
    return `${visibleLocal}${'*'.repeat(Math.max(localPart.length - 2, 1))}@${domain}`;
  }

  if (target.length <= 4) {
    return `${'*'.repeat(Math.max(target.length, 1))}`;
  }

  return `${target.slice(0, 4)}${'*'.repeat(Math.max(target.length - 6, 1))}${target.slice(-2)}`;
}
