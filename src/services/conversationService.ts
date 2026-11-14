import { apiClient } from '@/services/api';
import type { Conversation, CreateGroupPayload } from '@/types';

export const conversationService = {
  async getConversations(): Promise<Conversation[]> {
    const { data } = await apiClient.get<Conversation[]>('/chats');
    return data;
  },

  async getConversationById(conversationId: string): Promise<Conversation> {
    const { data } = await apiClient.get<Conversation>(`/chats/${conversationId}`);
    return data;
  },

  async createOrGetDirectConversation(targetUserId: string): Promise<Conversation> {
    const { data } = await apiClient.post<Conversation>('/chats', {
      participant_id: targetUserId,
    });
    return data;
  },

  async createGroupConversation(payload: CreateGroupPayload): Promise<Conversation> {
    const formData = new FormData();
    formData.append('name', payload.name.trim());
    if (payload.description?.trim()) {
      formData.append('description', payload.description.trim());
    }
    payload.participantIds.forEach((id) => {
      formData.append('participant_ids', id);
    });
    if (payload.avatarFile) {
      formData.append('avatar', payload.avatarFile);
    }

    const { data } = await apiClient.post<Conversation>('/groups', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async updateMembershipPreference(
    conversationId: string,
    updates: { isMuted?: boolean; isArchived?: boolean }
  ): Promise<void> {
    await apiClient.put(`/chats/${conversationId}/preferences`, {
      is_muted: updates.isMuted,
      is_archived: updates.isArchived,
    });
  },

  async markConversationRead(conversationId: string): Promise<string> {
    const { data } = await apiClient.post<{ last_read_at: string }>(
      `/chats/${conversationId}/read`
    );
    return data.last_read_at ?? new Date().toISOString();
  },
};
