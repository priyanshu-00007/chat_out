import { apiClient } from '@/services/api';
import { storageService } from '@/services/storageService';
import type { Message, MessageType } from '@/types';

export const messageService = {
  async getMessages(conversationId: string): Promise<Message[]> {
    const { data } = await apiClient.get<Message[]>(`/messages/${conversationId}`);
    return data;
  },

  async sendMessage(
    conversationId: string,
    content: string,
    files: File[] = []
  ): Promise<Message> {
    const trimmed = content.trim();
    if (!trimmed && files.length === 0) {
      throw new Error('Cannot send an empty message.');
    }

    const uploadedFiles =
      files.length > 0
        ? await Promise.all(
            files.map((file) => storageService.uploadFile(file, conversationId))
          )
        : [];

    let messageType: MessageType = 'text';
    if (uploadedFiles.length > 0) {
      const hasImage = uploadedFiles.some((f) => f.file_type.startsWith('image/'));
      messageType = hasImage ? 'image' : 'file';
    }

    const { data } = await apiClient.post<Message>('/messages', {
      conversation_id: conversationId,
      content: trimmed,
      message_type: messageType,
      attachment_ids: uploadedFiles.map((f) => f.id),
    });

    return data;
  },

  async markMessageRead(messageId: string): Promise<void> {
    await apiClient.post(`/messages/${messageId}/read`);
  },
};
