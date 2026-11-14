export type PresenceStatus = 'online' | 'offline' | 'away';

export type MessageStatus = 'sending' | 'sent' | 'read';

export type ContactStatus =
  | 'none'
  | 'self'
  | 'accepted'
  | 'pending_outgoing'
  | 'pending_incoming'
  | 'rejected';

export type MessageType = 'text' | 'image' | 'file' | 'system';

export type ConversationType = 'direct' | 'group';

export type SidebarFilter = 'all' | 'unread' | 'groups' | 'archived';

export type ThemeMode = 'light' | 'dark';

export interface User {
  id: string;
  fullName: string;
  username: string;
  email?: string | null;
  avatarPath: string | null;
  avatarUrl?: string;
  about: string;
  status: PresenceStatus;
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
  contactStatus?: ContactStatus;
}

export interface Attachment {
  id: string;
  messageId: string;
  uploaderId: string;
  name: string;
  type: 'image' | 'file';
  filePath: string;
  url?: string;
  size: number;
  mimeType: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: MessageType;
  timestamp: string;
  updatedAt: string;
  status: MessageStatus;
  attachments?: Attachment[];
  isSystem?: boolean;
}

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  role: 'admin' | 'member';
  isMuted: boolean;
  isArchived: boolean;
  joinedAt: string;
  lastReadAt: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name?: string;
  description?: string;
  avatarPath?: string | null;
  avatarUrl?: string;
  createdBy: string;
  participantIds: string[];
  adminIds: string[];
  members: ConversationMember[];
  lastMessage?: Message;
  unreadCount: number;
  isMuted: boolean;
  isArchived: boolean;
  updatedAt: string;
  typingUserIds: string[];
}

export interface UserSettings {
  theme: ThemeMode;
  notifications: {
    desktopAlerts: boolean;
    messageSound: boolean;
    showMessagePreview: boolean;
    groupMentionsOnly: boolean;
  };
  privacy: {
    lastSeenVisibility: 'everyone' | 'contacts' | 'nobody';
    profilePhotoVisibility: 'everyone' | 'contacts' | 'nobody';
    readReceipts: boolean;
  };
}

export interface PendingRegistration {
  fullName: string;
  username: string;
  email?: string;
  password: string;
  confirmPassword: string;
  avatarFile?: File;
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
  avatarFile?: File;
  participantIds: string[];
}

export interface AuthTokensResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  user: User;
}


