import {
  apiClient,
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from '@/services/api';
import type { AuthTokensResponse, PendingRegistration, User } from '@/types';

export const authService = {
  async register(payload: PendingRegistration): Promise<AuthTokensResponse> {
    const { data } = await apiClient.post<AuthTokensResponse>('/auth/register', {
      full_name: payload.fullName.trim(),
      username: payload.username.trim().replace(/^@/, ''),
      email: payload.email?.trim() || null,
      password: payload.password,
      confirm_password: payload.confirmPassword,
    });
    setAuthTokens(data.access_token, data.refresh_token);
    return data;
  },

  async login(username: string, password: string): Promise<AuthTokensResponse> {
    const { data } = await apiClient.post<AuthTokensResponse>('/auth/login', {
      username: username.trim().replace(/^@/, ''),
      password,
    });
    setAuthTokens(data.access_token, data.refresh_token);
    return data;
  },

  async forgotPassword(email: string): Promise<{ message: string; reset_token?: string }> {
    const { data } = await apiClient.post<{ message: string; reset_token?: string }>(
      '/auth/forgot-password',
      { email: email.trim() || null }
    );
    return data;
  },

  async resetPassword(
    token: string,
    password: string,
    confirmPassword: string
  ): Promise<{ message: string }> {
    const { data } = await apiClient.post<{ message: string }>('/auth/reset-password', {
      token,
      password,
      confirm_password: confirmPassword,
    });
    return data;
  },

  async getCurrentUser(): Promise<User | null> {
    const token = getAccessToken();
    if (!token) return null;

    const { data } = await apiClient.get<User>('/auth/me');
    return data;
  },

  async logout(): Promise<void> {
    const refreshToken = getRefreshToken();
    try {
      if (getAccessToken()) {
        await apiClient.post('/auth/logout', {
          refresh_token: refreshToken,
        });
      }
    } finally {
      clearAuthTokens();
    }
  },
};
