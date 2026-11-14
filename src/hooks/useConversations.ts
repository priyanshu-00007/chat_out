import { useCallback, useEffect, useState } from 'react';
import { conversationService } from '@/services/conversationService';
import { profileService } from '@/services/profileService';
import type { Conversation, CreateGroupPayload, User } from '@/types';

export function useConversations(currentUserId: string | undefined) {
  const [contacts, setContacts] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    if (!currentUserId) {
      setContacts([]);
      setConversations([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [loadedContacts, loadedConversations] = await Promise.all([
        profileService.getContacts(),
        conversationService.getConversations(),
      ]);
      setContacts(loadedContacts);
      setConversations(loadedConversations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load conversations.');
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const contactsWithPresence = contacts.map((contact) => ({
    ...contact,
    status: onlineUserIds.has(contact.id) ? ('online' as const) : contact.status,
  }));

  const startDirectConversation = useCallback(
    async (targetUserId: string): Promise<Conversation> => {
      if (!currentUserId) throw new Error('Authentication required.');
      const conv = await conversationService.createOrGetDirectConversation(targetUserId);
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conv.id);
        if (exists) return prev.map((c) => (c.id === conv.id ? conv : c));
        return [conv, ...prev];
      });
      return conv;
    },
    [currentUserId]
  );

  const createGroupConversation = useCallback(
    async (payload: CreateGroupPayload): Promise<Conversation> => {
      if (!currentUserId) throw new Error('Authentication required.');
      const created = await conversationService.createGroupConversation(payload);
      setConversations((prev) => [created, ...prev]);
      return created;
    },
    [currentUserId]
  );

  const toggleMuteConversation = useCallback(
    async (conversationId: string) => {
      if (!currentUserId) return;
      const target = conversations.find((c) => c.id === conversationId);
      if (!target) return;

      const nextMuted = !target.isMuted;
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, isMuted: nextMuted } : c))
      );
      try {
        await conversationService.updateMembershipPreference(conversationId, {
          isMuted: nextMuted,
        });
      } catch (err) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, isMuted: target.isMuted } : c
          )
        );
        throw err;
      }
    },
    [conversations, currentUserId]
  );

  const toggleArchiveConversation = useCallback(
    async (conversationId: string) => {
      if (!currentUserId) return;
      const target = conversations.find((c) => c.id === conversationId);
      if (!target) return;

      const nextArchived = !target.isArchived;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, isArchived: nextArchived } : c
        )
      );
      try {
        await conversationService.updateMembershipPreference(conversationId, {
          isArchived: nextArchived,
        });
      } catch (err) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, isArchived: target.isArchived } : c
          )
        );
        throw err;
      }
    },
    [conversations, currentUserId]
  );

  const markAsRead = useCallback(
    async (conversationId: string) => {
      if (!currentUserId) return;
      const readAt = await conversationService.markConversationRead(conversationId);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                unreadCount: 0,
                members: c.members.map((m) =>
                  m.userId === currentUserId ? { ...m, lastReadAt: readAt } : m
                ),
              }
            : c
        )
      );
    },
    [currentUserId]
  );

  return {
    contacts: contactsWithPresence,
    conversations,
    setConversations,
    onlineUserIds,
    setOnlineUserIds,
    isLoading,
    error,
    refreshData,
    startDirectConversation,
    createGroupConversation,
    toggleMuteConversation,
    toggleArchiveConversation,
    markAsRead,
  };
}
