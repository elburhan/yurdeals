import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { ApiError } from '../lib/api';
import type { StoredVerificationContext } from '../lib/verificationSession';
import {
  clearVerificationContext,
  createStoredVerificationContext,
  DEFAULT_RESEND_COOLDOWN_SECONDS,
  loadVerificationContext,
  saveVerificationContext,
} from '../lib/verificationSession';

interface VerifyOtpLocationState {
  verification?: StoredVerificationContext;
}

export default function VerifyOtpPage() {
  const { isAuthenticated, verifyOtp, resendOtp } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const routeState = location.state as VerifyOtpLocationState | null;
  const [verification, setVerification] = useState<StoredVerificationContext | null>(() => {
    return routeState?.verification ?? loadVerificationContext();
  });
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    getSecondsRemaining(routeState?.verification ?? loadVerificationContext()),
  );

  useEffect(() => {
    if (routeState?.verification) {
      setVerification(routeState.verification);
      saveVerificationContext(routeState.verification);
      setSecondsRemaining(getSecondsRemaining(routeState.verification));
    }
  }, [routeState]);

  useEffect(() => {
    if (!verification) {
      return;
    }

    saveVerificationContext(verification);
  }, [verification]);

  useEffect(() => {
    if (!verification || secondsRemaining <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsRemaining(getSecondsRemaining(verification));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [verification, secondsRemaining]);

  const helperCopy = useMemo(() => {
    if (!verification) {
      return '';
    }

    const channelLabel = verification.channel === 'EMAIL' ? 'email' : 'phone';
    return `We sent a 6-digit code to ${verification.verificationTarget}. Enter it below to verify your account${channelLabel === 'phone' ? '.' : ' before you continue.'}`;
  }, [verification]);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!verification) {
    return <Navigate to="/register" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const currentVerification = verification;

    if (!currentVerification) {
      navigate('/register', { replace: true });
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter the 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await verifyOtp({
        verificationSessionId: currentVerification.verificationSessionId,
        channel: currentVerification.channel,
        otp: otp.trim(),
      });

      clearVerificationContext();
      showToast('Your account has been verified successfully.', 'success');

      if (result.status === 'authenticated') {
        navigate('/dashboard', { replace: true });
        return;
      }

      navigate('/login', {
        replace: true,
        state: {
          verified: true,
        },
      });
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError('Verification failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (!verification || isResending || secondsRemaining > 0) {
      return;
    }

    const currentVerification = verification;

    setIsResending(true);
    setError('');

    try {
      const nextVerification = await resendOtp({
        verificationSessionId: currentVerification.verificationSessionId,
        channel: currentVerification.channel,
      });

      const stored = createStoredVerificationContext(
        nextVerification,
        DEFAULT_RESEND_COOLDOWN_SECONDS,
      );
      setVerification(stored);
      setSecondsRemaining(getSecondsRemaining(stored));
      showToast('A new verification code has been sent.', 'success');
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);

        const retryAfterSeconds = readRetryAfterSeconds(requestError.meta);
        if (retryAfterSeconds > 0) {
          const updated = createStoredVerificationContext(currentVerification, retryAfterSeconds);
          setVerification(updated);
          setSecondsRemaining(getSecondsRemaining(updated));
        }
      } else {
        setError('We could not resend the code right now. Please try again.');
      }
    } finally {
      setIsResending(false);
    }
  }

  function handleChangeDetails() {
    clearVerificationContext();
    navigate('/register', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-900 via-surface-800 to-primary-950 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-6">
          <Link to="/" className="inline-block">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/30 mb-4">
              <svg
                className="w-7 h-7 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </Link>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mb-1">
            Verify your account
          </h1>
          <p className="text-surface-400 text-sm">{helperCopy}</p>
        </div>

        <div className="rounded-2xl bg-white/[0.07] backdrop-blur-xl border border-white/10 p-6 sm:p-8">
          {error && (
            <div className="mb-5 rounded-xl bg-red-500/10 border border-red-500/20 p-4 animate-fade-in" role="alert">
              <p className="text-red-300 text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="verification-otp"
                className="block text-sm font-medium text-surface-300 mb-1.5"
              >
                Verification code <span className="text-red-300">*</span>
              </label>
              <input
                id="verification-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(event) => {
                  const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtp(digitsOnly);
                  setError('');
                }}
                className={`w-full rounded-xl border bg-white/5 px-4 py-3 text-center text-2xl tracking-[0.4em] text-white placeholder-surface-500
                  focus:outline-none focus:ring-2 transition-all duration-200 ${
                    error
                      ? 'border-red-400/50 focus:ring-red-400/40'
                      : 'border-white/10 focus:ring-primary-500/40 focus:border-primary-500/50'
                  }`}
                placeholder="000000"
                maxLength={6}
                aria-invalid={error ? 'true' : 'false'}
              />
              <p className="mt-2 text-xs text-surface-400">
                Enter the 6-digit code sent to your {verification.channel === 'EMAIL' ? 'email' : 'phone'}.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-3.5 text-white font-semibold shadow-lg shadow-primary-500/25 hover:from-primary-500 hover:to-primary-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
            >
              {isSubmitting ? 'Verifying...' : 'Verify account'}
            </button>
          </form>

          <div className="mt-5 space-y-3 text-sm">
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={isResending || secondsRemaining > 0}
              className="w-full rounded-xl border border-white/10 px-4 py-3 font-semibold text-white hover:border-primary-400/50 hover:text-primary-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isResending
                ? 'Sending new code...'
                : secondsRemaining > 0
                  ? `You can resend in ${secondsRemaining}s`
                  : 'Resend OTP'}
            </button>

            <button
              type="button"
              onClick={handleChangeDetails}
              className="w-full rounded-xl px-4 py-3 text-surface-300 hover:text-white"
            >
              Go back to signup / change email or phone
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getSecondsRemaining(verification: StoredVerificationContext | null): number {
  if (!verification) {
    return 0;
  }

  return Math.max(0, Math.ceil((verification.resendAvailableAt - Date.now()) / 1000));
}

function readRetryAfterSeconds(meta?: Record<string, unknown>): number {
  if (!meta) {
    return 0;
  }

  const candidate = meta.retryAfterSeconds;
  return typeof candidate === 'number' && candidate > 0 ? candidate : 0;
}
