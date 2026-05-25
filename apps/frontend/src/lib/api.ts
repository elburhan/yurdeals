// ============================================
// API Client — YurDeals Frontend
// ============================================

import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
const AUTH_TOKEN_STORAGE_KEY = 'yurdeals_access_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_RETRY_FLAG = '__csrfRetry';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

if (typeof window !== 'undefined') {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
    meta?: Record<string, unknown>;
  };
}

interface CsrfResponseData {
  csrfToken: string;
}

interface CsrfRequestConfig extends AxiosRequestConfig {
  [CSRF_RETRY_FLAG]?: boolean;
}

export class ApiError extends Error {
  public code: string;
  public status: number;
  public details?: Array<{ field: string; message: string }>;
  public meta?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: Array<{ field: string; message: string }>,
    meta?: Record<string, unknown>,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.meta = meta;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

class ApiClient {
  private client: AxiosInstance;
  private csrfToken: string | null = null;
  private csrfTokenPromise: Promise<string> | null = null;

  constructor(baseUrl: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      withCredentials: true,
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
    });

    this.client.interceptors.request.use(async (config) => {
      if (isUnsafeMethod(config.method)) {
        const token = await this.getCsrfToken();
        config.headers.set(CSRF_HEADER_NAME, token);
      }

      return config;
    });
  }

  async get<T>(path: string, params?: object): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, params);
  }

  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body);
  }

  async postForm<T>(path: string, body: FormData): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body);
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: object,
  ): Promise<ApiResponse<T>> {
    try {
      const requestConfig: CsrfRequestConfig = {
        method,
        url: path,
        data: body,
        params,
      };
      const response = await this.client.request<ApiResponse<T>>(requestConfig);

      return response.data;
    } catch (error) {
      if (!isApiAxiosError(error)) {
        throw new ApiError('An unexpected error occurred', 'UNKNOWN', 500);
      }

      const status = error.response?.status ?? 500;
      const errorBody = error.response?.data;
      const originalConfig = error.config as CsrfRequestConfig | undefined;

      if (
        status === 403 &&
        errorBody?.error?.code === 'CSRF_INVALID' &&
        originalConfig &&
        !originalConfig[CSRF_RETRY_FLAG]
      ) {
        this.clearCsrfToken();
        originalConfig[CSRF_RETRY_FLAG] = true;
        const response = await this.client.request<ApiResponse<T>>(originalConfig);
        return response.data;
      }

      if (!errorBody) {
        throw new ApiError('Request failed', 'UNKNOWN', status);
      }

      throw new ApiError(
        errorBody.error?.message ?? 'Request failed',
        errorBody.error?.code ?? 'UNKNOWN',
        status,
        errorBody.error?.details,
        errorBody.error?.meta,
      );
    }
  }

  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }

    if (!this.csrfTokenPromise) {
      this.csrfTokenPromise = this.fetchCsrfToken().finally(() => {
        this.csrfTokenPromise = null;
      });
    }

    this.csrfToken = await this.csrfTokenPromise;
    return this.csrfToken;
  }

  private async fetchCsrfToken(): Promise<string> {
    const response = await this.client.get<ApiResponse<CsrfResponseData>>('/auth/csrf');
    return response.data.data.csrfToken;
  }

  private clearCsrfToken(): void {
    this.csrfToken = null;
    this.csrfTokenPromise = null;
  }
}

function isApiAxiosError(error: unknown): error is AxiosError<ApiErrorResponse> {
  return axios.isAxiosError(error);
}

function isUnsafeMethod(method: string | undefined): boolean {
  return UNSAFE_METHODS.has((method ?? 'GET').toUpperCase());
}

export const api = new ApiClient(API_BASE);

export function getStoredAccessToken(): string | null {
  return null;
}

export function setStoredAccessToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  void token;
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export function clearStoredAccessToken(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}
