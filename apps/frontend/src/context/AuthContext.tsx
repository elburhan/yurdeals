// ============================================
// Auth Context — Global Auth State Management
// ============================================

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, clearStoredAccessToken } from '../lib/api';
import {
  login as loginRequest,
  resendOtp as resendOtpRequest,
  signup as signupRequest,
  verifyOtp as verifyOtpRequest,
  type LoginInput,
  type OtpChannel,
  type RegisterInput,
  type RegisterResult,
  type ResendOtpInput,
  type VerificationContext,
  type VerifyOtpInput,
} from '../lib/authApi';

/** User shape returned from the backend */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  avatar: string | null;
  isVerified: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type { LoginInput, OtpChannel, RegisterInput, RegisterResult, VerificationContext };

export interface VerifyOtpResult {
  status: 'authenticated' | 'verified';
  user: AuthUser | null;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  verifyOtp: (input: VerifyOtpInput) => Promise<VerifyOtpResult>;
  resendOtp: (input: ResendOtpInput) => Promise<VerificationContext>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /** Fetch the current user profile on mount (cookie-based session check) */
  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get<{ user: AuthUser }>('/auth/me');
      setUser(res.data.user);
    } catch {
      clearStoredAccessToken();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (input: LoginInput) => {
    const authenticatedUser = await loginRequest(input);
    setUser(authenticatedUser);
    return authenticatedUser;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await signupRequest(input);

    if (result.kind === 'authenticated') {
      setUser(result.user);
    } else {
      setUser(null);
    }

    return result;
  }, []);

  const verifyOtp = useCallback(async (input: VerifyOtpInput): Promise<VerifyOtpResult> => {
    const result = await verifyOtpRequest(input);

    if (result.authenticated && result.user) {
      setUser(result.user);
      return { status: 'authenticated', user: result.user };
    }

    setUser(null);
    return { status: 'verified', user: result.user };
  }, []);

  const resendOtp = useCallback(async (input: ResendOtpInput): Promise<VerificationContext> => {
    const result = await resendOtpRequest(input);
    return result.verification;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors on logout — clear local state regardless
    }
    clearStoredAccessToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      register,
      verifyOtp,
      resendOtp,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, register, verifyOtp, resendOtp, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Re-export ApiError for convenience in form components
export { ApiError };
