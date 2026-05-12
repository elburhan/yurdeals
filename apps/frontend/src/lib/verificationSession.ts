import type { VerificationContext } from './authApi';

const VERIFICATION_SESSION_STORAGE_KEY = 'yurdeals_signup_verification';
const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;

export interface StoredVerificationContext extends VerificationContext {
  resendAvailableAt: number;
}

export function createStoredVerificationContext(
  verification: VerificationContext,
  cooldownSeconds = DEFAULT_RESEND_COOLDOWN_SECONDS,
): StoredVerificationContext {
  return {
    ...verification,
    resendAvailableAt: Date.now() + cooldownSeconds * 1000,
  };
}

export function saveVerificationContext(context: StoredVerificationContext): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(VERIFICATION_SESSION_STORAGE_KEY, JSON.stringify(context));
}

export function loadVerificationContext(): StoredVerificationContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(VERIFICATION_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredVerificationContext>;
    if (
      typeof parsed.verificationSessionId !== 'string' ||
      typeof parsed.verificationTarget !== 'string' ||
      (parsed.channel !== 'EMAIL' && parsed.channel !== 'PHONE') ||
      typeof parsed.expiresInSeconds !== 'number'
    ) {
      clearVerificationContext();
      return null;
    }

    return {
      verificationSessionId: parsed.verificationSessionId,
      verificationTarget: parsed.verificationTarget,
      channel: parsed.channel,
      expiresInSeconds: parsed.expiresInSeconds,
      resendAvailableAt:
        typeof parsed.resendAvailableAt === 'number'
          ? parsed.resendAvailableAt
          : Date.now() + DEFAULT_RESEND_COOLDOWN_SECONDS * 1000,
    };
  } catch {
    clearVerificationContext();
    return null;
  }
}

export function clearVerificationContext(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(VERIFICATION_SESSION_STORAGE_KEY);
}

export { DEFAULT_RESEND_COOLDOWN_SECONDS };
