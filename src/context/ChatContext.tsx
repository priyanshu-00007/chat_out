import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { useMessages } from '@/hooks/useMessages';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import type { RealtimeStatus } from '@/services/realtimeService';
import type {
  Conversation,
  CreateGroupPayload,
  Message,
  SidebarFilter,
  User,
} from '@/types';

interface ChatContextValue {
  contacts: User[];
  conversations: Conversation[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  activeMessages: Message[];
  activeTypingUserIds: string[];
  activeFilter: SidebarFilter;
  searchQuery: string;
  isLoadingChat: boolean;
  isLoadingMessages: boolean;
  chatError: string | null;
  messagesError: string | null;
  realtimeStatus: RealtimeStatus;
  totalUnreadCount: number;
  setActiveFilter: (filter: SidebarFilter) => void;
  setSearchQuery: (query: string) => void;
  selectConversation: (conversationId: string | null) => Promise<void>;
  sendMessage: (
    conversationId: string,
    content: string,
    files?: File[]
  ) => Promise<void>;
  sendTyping: (isTyping: boolean) => void;
  startDirectConversation: (contactId: string) => Promise<Conversation>;
  createGroupConversation: (payload: CreateGroupPayload) => Promise<Conversation>;
  toggleMuteConversation: (conversationId: string) => Promise<void>;
  toggleArchiveConversation: (conversationId: string) => Promise<void>;
  refreshChat: () => Promise<void>;
  getUserById: (userId: string) => User | undefined;
  getConversationDisplay: (conversation: Conversation) => {
    title: string;
    avatarUrl?: string;
    subtitle: string;
    isOnline: boolean;
    otherUser?: User;
  };
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, settings } = useAuth();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<SidebarFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const {
    contacts,
    conversations,
    setConversations,
    setOnlineUserIds,
    isLoading: isLoadingChat,
    error: chatError,
    refreshData,
    startDirectConversation: startDirect,
    createGroupConversation: createGroup,
    toggleMuteConversation: toggleMute,
    toggleArchiveConversation: toggleArchive,
    markAsRead,
  } = useConversations(isAuthenticated ? user?.id : undefined);

  useEffect(() => {
    if (!isAuthenticated) {
      setActiveConversationId(null);
      setSearchQuery('');
      setActiveFilter('all');
    }
  }, [isAuthenticated]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  const otherMemberLastReadAts = useMemo(() => {
    if (!activeConversation || !user?.id) return [];
    return activeConversation.members
      .filter((m) => m.userId !== user.id)
      .map((m) => m.lastReadAt);
  }, [activeConversation, user?.id]);

  const {
    messages: activeMessages,
    isLoading: isLoadingMessages,
    error: messagesError,
    sendMessage: sendConvMessage,
    appendOrReplaceMessage,
    removeMessage,
  } = useMessages(activeConversationId, user?.id, otherMemberLastReadAts);

  const handleIncomingRealtimeMessage = useCallback(
    (incoming: Message) => {
      appendOrReplaceMessage(incoming);
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === incoming.conversationId
            ? {
                ...conv,
                lastMessage: incoming,
                updatedAt: incoming.timestamp,
              }
            : conv
        )
      );
      if (
        incoming.senderId !== user?.id &&
        activeConversationId === incoming.conversationId &&
        settings.privacy.readReceipts
      ) {
        void markAsRead(incoming.conversationId).catch(() => {});
      }
    },
    [
      activeConversationId,
      appendOrReplaceMessage,
      markAsRead,
      setConversations,
      settings.privacy.readReceipts,
      user?.id,
    ]
  );

  const handleReadReceipt = useCallback(
    (readerId: string, lastReadAt: string) => {
      if (!activeConversationId) return;
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeConversationId
            ? {
                ...conv,
                members: conv.members.map((m) =>
                  m.userId === readerId ? { ...m, lastReadAt } : m
                ),
              }
            : conv
        )
      );
    },
    [activeConversationId, setConversations]
  );

  const {
    typingUserIds: activeTypingUserIds,
    realtimeStatus,
    sendTyping,
  } = useRealtimeMessages({
    conversationId: activeConversationId,
    currentUserId: user?.id,
    onIncomingMessage: handleIncomingRealtimeMessage,
    onMessageUpdated: appendOrReplaceMessage,
    onMessageDeleted: removeMessage,
    onPresenceSync: setOnlineUserIds,
    onReadReceipt: handleReadReceipt,
  });

  const getUserById = useCallback(
    (userId: string): User | undefined => {
      if (user && user.id === userId) return user;
      return contacts.find((c) => c.id === userId);
    },
    [contacts, user]
  );

  const selectConversation = useCallback(
    async (conversationId: string | null) => {
      setActiveConversationId(conversationId);
      if (!conversationId) return;

      const conv = conversations.find((c) => c.id === conversationId);
      if (conv && conv.unreadCount > 0) {
        await markAsRead(conversationId).catch(() => {});
      }
    },
    [conversations, markAsRead]
  );

  const sendMessage = useCallback(
    async (conversationId: string, content: string, files: File[] = []) => {
      const saved = await sendConvMessage(conversationId, content, files);
      if (saved) {
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  lastMessage: saved,
                  updatedAt: saved.timestamp,
                }
              : conv
          )
        );
      }
    },
    [sendConvMessage, setConversations]
  );

  const startDirectConversation = useCallback(
    async (contactId: string): Promise<Conversation> => {
      const conv = await startDirect(contactId);
      setActiveFilter('all');
      setActiveConversationId(conv.id);
      return conv;
    },
    [startDirect]
  );

  const createGroupConversation = useCallback(
    async (payload: CreateGroupPayload): Promise<Conversation> => {
      const created = await createGroup(payload);
      setActiveFilter('all');
      setActiveConversationId(created.id);
      return created;
    },
    [createGroup]
  );

  const toggleArchiveConversation = useCallback(
    async (conversationId: string) => {
      await toggleArchive(conversationId);
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
      }
    },
    [activeConversationId, toggleArchive]
  );

  const getConversationDisplay = useCallback(
    (conversation: Conversation) => {
      if (conversation.type === 'group') {
        return {
          title: conversation.name || 'Unnamed Group',
          avatarUrl: conversation.avatarUrl,
          subtitle: `${conversation.participantIds.length} members`,
          isOnline: false,
        };
      }

      const myId = user?.id;
      const otherId =
        conversation.participantIds.find((id) => id !== myId) ??
        conversation.participantIds[0];
      const otherUser = getUserById(otherId);

      return {
        title: otherUser?.fullName ?? 'Unknown User',
        avatarUrl: otherUser?.avatarUrl,
        subtitle: otherUser ? `@${otherUser.username}` : '',
        isOnline: otherUser?.status === 'online',
        otherUser,
      };
    },
    [getUserById, user?.id]
  );

  const totalUnreadCount = useMemo(
    () =>
      conversations
        .filter((c) => !c.isArchived)
        .reduce((sum, conv) => sum + conv.unreadCount, 0),
    [conversations]
  );

  const value = useMemo<ChatContextValue>(
    () => ({
      contacts,
      conversations,
      activeConversationId,
      activeConversation,
      activeMessages,
      activeTypingUserIds,
      activeFilter,
      searchQuery,
      isLoadingChat,
      isLoadingMessages,
      chatError,
      messagesError,
      realtimeStatus,
      totalUnreadCount,
      setActiveFilter,
      setSearchQuery,
      selectConversation,
      sendMessage,
      sendTyping,
      startDirectConversation,
      createGroupConversation,
      toggleMuteConversation: toggleMute,
      toggleArchiveConversation,
      refreshChat: refreshData,
      getUserById,
      getConversationDisplay,
    }),
    [
      contacts,
      conversations,
      activeConversationId,
      activeConversation,
      activeMessages,
      activeTypingUserIds,
      activeFilter,
      searchQuery,
      isLoadingChat,
      isLoadingMessages,
      chatError,
      messagesError,
      realtimeStatus,
      totalUnreadCount,
      selectConversation,
      sendMessage,
      sendTyping,
      startDirectConversation,
      createGroupConversation,
      toggleMute,
      toggleArchiveConversation,
      refreshData,
      getUserById,
      getConversationDisplay,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return ctx;
}
