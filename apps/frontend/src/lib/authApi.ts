import { api } from './api';
import type { AuthUser } from '../context/AuthContext';

export type OtpChannel = 'EMAIL' | 'PHONE';

export interface RegisterInput {
  email?: string;
  password: string;
  name: string;
  phone: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface VerificationContext {
  verificationSessionId: string;
  verificationTarget: string;
  channel: OtpChannel;
  expiresInSeconds: number;
}

interface TokenPayload {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

interface AuthSuccessData {
  user: AuthUser;
  token?: TokenPayload;
}

interface RegisterPendingVerificationData {
  user: AuthUser;
  verificationRequired: true;
  verification: VerificationContext;
}

export type RegisterResult =
  | { kind: 'authenticated'; user: AuthUser }
  | { kind: 'verification_required'; verification: VerificationContext; user: AuthUser };

export interface VerifyOtpInput {
  verificationSessionId?: string;
  identifier?: string;
  channel: OtpChannel;
  otp: string;
}

export interface ResendOtpInput {
  verificationSessionId?: string;
  identifier?: string;
  channel: OtpChannel;
}

export interface ResendOtpResult {
  verification: VerificationContext;
}

export interface VerifyOtpResult {
  authenticated: boolean;
  user: AuthUser | null;
}

export async function login(input: LoginInput): Promise<AuthUser> {
  const res = await api.post<AuthSuccessData>('/auth/login', input);
  return res.data.user;
}

export async function signup(input: RegisterInput): Promise<RegisterResult> {
  const res = await api.post<RegisterPendingVerificationData | AuthSuccessData>('/auth/register', input);

  if ('verificationRequired' in res.data && res.data.verificationRequired) {
    return {
      kind: 'verification_required',
      verification: res.data.verification,
      user: res.data.user,
    };
  }

  return {
    kind: 'authenticated',
    user: res.data.user,
  };
}

export async function verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
  const res = await api.post<AuthSuccessData>('/auth/verify-otp', input);
  const authenticated = Boolean(res.data.user);

  return {
    authenticated,
    user: res.data.user ?? null,
  };
}

export async function resendOtp(input: ResendOtpInput): Promise<ResendOtpResult> {
  const res = await api.post<ResendOtpResult>('/auth/resend-otp', input);
  return res.data;
}
