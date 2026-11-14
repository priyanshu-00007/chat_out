import { apiClient } from '@/services/api';
import { storageService } from '@/services/storageService';
import type { User } from '@/types';

export const profileService = {
  async getContacts(): Promise<User[]> {
    const { data } = await apiClient.get<User[]>('/users/contacts');
    return data;
  },

  async getContactRequests(): Promise<Array<{ id: string; senderId: string; recipientId: string; status: string }>> {
    const { data } = await apiClient.get<Array<{ id: string; senderId: string; recipientId: string; status: string }>>('/users/contact-requests');
    return data;
  },

  async sendContactRequest(targetUserId: string): Promise<{ status: string; message: string }> {
    const { data } = await apiClient.post<{ status: string; message: string }>('/users/contacts/request', {
      target_user_id: targetUserId,
    });
    return data;
  },

  async respondToContactRequest(
    targetUserId: string,
    status: 'accepted' | 'rejected'
  ): Promise<{ status: string; message: string }> {
    const { data } = await apiClient.post<{ status: string; message: string }>(
      `/users/contacts/request/${targetUserId}/respond`,
      { status }
    );
    return data;
  },

  async searchUsers(query: string): Promise<User[]> {
    const normalizedQuery = query.trim().replace(/^@+/, '');
    const { data } = await apiClient.get<User[]>('/users/search', {
      params: { q: normalizedQuery },
    });
    return data;
  },

  async getUserById(userId: string): Promise<User> {
    const { data } = await apiClient.get<User>(`/users/${userId}`);
    return data;
  },

  async updateProfile(updates: {
    fullName?: string;
    username?: string;
    about?: string;
    avatarFile?: File | null;
    removeAvatar?: boolean;
  }): Promise<User> {
    if (updates.avatarFile) {
      await storageService.uploadAvatar(updates.avatarFile);
    }

    const payload: Record<string, unknown> = {};
    if (updates.fullName !== undefined) payload.full_name = updates.fullName.trim();
    if (updates.username !== undefined) {
      payload.username = updates.username.trim().replace(/^@/, '');
    }
    if (updates.about !== undefined) payload.about = updates.about.trim();
    if (updates.removeAvatar) payload.avatar_url = null;

    const { data } = await apiClient.put<User>('/users/profile', payload);
    return data;
  },
};
