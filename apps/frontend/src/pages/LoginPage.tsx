// ============================================
// Login Page — Mobile-First Auth Form
// ============================================

import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';

interface FieldErrors {
  identifier?: string;
  password?: string;
}

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
  if (isAuthenticated) {
    return <Navigate to={from || '/account'} replace />;
  }

  function validateForm(): boolean {
    const errors: FieldErrors = {};

    if (!identifier.trim()) {
      errors.identifier = 'Email or phone is required';
    } else if (identifier.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      errors.identifier = 'Enter a valid email address or phone number';
    }

    if (!password) {
      errors.password = 'Password is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGlobalError('');

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const user = await login({ identifier: identifier.trim(), password });
      const roleDestination =
        user.role === 'ADMIN' ? '/admin' : user.role === 'STAFF' ? '/staff' : from || '/account';
      navigate(roleDestination, { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.details?.length) {
          const newErrors: FieldErrors = {};
          for (const detail of error.details) {
            if (detail.field === 'identifier') newErrors.identifier = detail.message;
            if (detail.field === 'password') newErrors.password = detail.message;
          }
          setFieldErrors(newErrors);
        } else {
          setGlobalError(error.message);
        }
      } else {
        setGlobalError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-900 via-surface-800 to-primary-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
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
            Welcome back
          </h1>
          <p className="text-surface-400 text-sm">Sign in to your YurDeals account</p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl bg-white/[0.07] backdrop-blur-xl border border-white/10 p-6 sm:p-8">
          {globalError && (
            <div
              className="mb-5 rounded-xl bg-red-500/10 border border-red-500/20 p-4 animate-fade-in"
              role="alert"
              id="login-error"
            >
              <p className="text-red-300 text-sm font-medium">{globalError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Identifier */}
            <div>
              <label
                htmlFor="login-identifier"
                className="block text-sm font-medium text-surface-300 mb-1.5"
              >
                Email or phone
              </label>
              <input
                id="login-identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setFieldErrors((p) => ({ ...p, identifier: undefined }));
                }}
                className={`w-full rounded-xl border bg-white/5 px-4 py-3 text-white placeholder-surface-500
                  focus:outline-none focus:ring-2 transition-all duration-200
                  ${
                    fieldErrors.identifier
                      ? 'border-red-400/50 focus:ring-red-400/40'
                      : 'border-white/10 focus:ring-primary-500/40 focus:border-primary-500/50'
                  }`}
                placeholder="you@example.com or +234 800 000 0000"
                aria-invalid={fieldErrors.identifier ? 'true' : 'false'}
                aria-describedby={fieldErrors.identifier ? 'login-identifier-error' : undefined}
              />
              {fieldErrors.identifier && (
                <p id="login-identifier-error" className="mt-1.5 text-xs text-red-400" role="alert">
                  {fieldErrors.identifier}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-surface-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFieldErrors((p) => ({ ...p, password: undefined }));
                  }}
                  className={`w-full rounded-xl border bg-white/5 px-4 py-3 pr-12 text-white placeholder-surface-500
                    focus:outline-none focus:ring-2 transition-all duration-200
                    ${
                      fieldErrors.password
                        ? 'border-red-400/50 focus:ring-red-400/40'
                        : 'border-white/10 focus:ring-primary-500/40 focus:border-primary-500/50'
                    }`}
                  placeholder="Password"
                  aria-invalid={fieldErrors.password ? 'true' : 'false'}
                  aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="login-password-error" className="mt-1.5 text-xs text-red-400" role="alert">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              id="login-submit"
              className="w-full rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-3.5
                text-white font-semibold shadow-lg shadow-primary-500/25
                hover:from-primary-500 hover:to-primary-400
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Register link */}
          <p className="mt-6 text-center text-sm text-surface-400">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-medium text-primary-400 hover:text-primary-300 transition-colors"
            >
              Create one
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-surface-500 text-xs mt-6">
          Secure login with HttpOnly cookies
        </p>
      </div>
    </div>
  );
}
