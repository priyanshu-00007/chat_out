import { apiClient } from '@/services/api';

export const MAX_AVATAR_BYTES = 4 * 1024 * 1024; // 4 MB
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_AVATAR_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
]);

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_AVATAR_MIME_TYPES.has(file.type)) {
    return 'Profile photo must be a JPG, PNG, WebP, or GIF image.';
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return 'Profile photo must be smaller than 4 MB.';
  }
  return null;
}

export function validateAttachmentFile(file: File): string | null {
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type)) {
    return `File type "${file.type || 'unknown'}" is not supported.`;
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `File "${file.name}" exceeds the 25 MB size limit.`;
  }
  return null;
}

export interface UploadedFileMetadata {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
}

export const storageService = {
  async uploadFile(file: File, conversationId?: string): Promise<UploadedFileMetadata> {
    const validationError = validateAttachmentFile(file);
    if (validationError) throw new Error(validationError);

    const formData = new FormData();
    formData.append('file', file);
    if (conversationId) {
      formData.append('conversation_id', conversationId);
    }

    const { data } = await apiClient.post<UploadedFileMetadata>('/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async uploadAvatar(file: File): Promise<{ avatar_url: string }> {
    const validationError = validateAvatarFile(file);
    if (validationError) throw new Error(validationError);

    const formData = new FormData();
    formData.append('file', file);

    const { data } = await apiClient.post<{ avatar_url: string }>(
      '/users/avatar',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return data;
  },
};
