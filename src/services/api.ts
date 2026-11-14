import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { readStorage, removeStorage, writeStorage } from '@/utils/storage';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
).replace(/\/+$/, '');

export const WS_BASE_URL = (
  import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000/ws'
).replace(/\/+$/, '');

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export class BackendConnectionError extends Error {
  constructor(
    message = `Cannot connect to the ChatSphere backend server (${API_BASE_URL}). Please ensure the FastAPI server is running.`
  ) {
    super(message);
    this.name = 'BackendConnectionError';
  }
}

export function getAccessToken(): string | null {
  return readStorage<string | null>(ACCESS_TOKEN_KEY, null);
}

export function getRefreshToken(): string | null {
  return readStorage<string | null>(REFRESH_TOKEN_KEY, null);
}

export function setAuthTokens(accessToken: string, refreshToken?: string | null): void {
  writeStorage(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    writeStorage(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearAuthTokens(): void {
  removeStorage(ACCESS_TOKEN_KEY);
  removeStorage(REFRESH_TOKEN_KEY);
}

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function attemptTokenRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ access_token: string; refresh_token?: string }>(
        `${API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken },
        { timeout: 10000 }
      )
      .then(({ data }) => {
        setAuthTokens(data.access_token, data.refresh_token ?? refreshToken);
        return data.access_token;
      })
      .catch(() => {
        clearAuthTokens();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function extractApiErrorMessage(error: AxiosError): string {
  const data = error.response?.data as
    | { detail?: string | Array<{ msg?: string }>; message?: string }
    | undefined;

  if (typeof data?.detail === 'string') return data.detail;
  if (Array.isArray(data?.detail) && data.detail.length > 0) {
    return data.detail.map((item) => item.msg || 'Validation error').join(' ');
  }
  if (typeof data?.message === 'string') return data.message;
  return error.message || 'An unexpected server error occurred.';
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // No HTTP response means network failure / FastAPI backend is offline
    if (!error.response) {
      return Promise.reject(new BackendConnectionError());
    }

    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh');

    if (
      error.response.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true;
      const newToken = await attemptTokenRefresh();
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      }
      clearAuthTokens();
    }

    return Promise.reject(new Error(extractApiErrorMessage(error)));
  }
);

export async function checkBackendHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    await axios.get(`${API_BASE_URL}/health`, { timeout: 3500 });
    return { ok: true };
  } catch (err) {
    if (axios.isAxiosError(err) && !err.response) {
      return {
        ok: false,
        error: new BackendConnectionError().message,
      };
    }
    return {
      ok: false,
      error: `Backend health check failed (${API_BASE_URL}/health).`,
    };
  }
}
