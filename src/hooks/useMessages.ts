import { useCallback, useEffect, useState } from 'react';
import { messageService } from '@/services/messageService';
import type { Message } from '@/types';

export function useMessages(
  conversationId: string | null,
  currentUserId: string | undefined,
  otherMemberLastReadAts: string[]
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    if (!conversationId || !currentUserId) {
      setMessages([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const loaded = await messageService.getMessages(conversationId);
      setMessages(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages.');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, currentUserId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const appendOrReplaceMessage = useCallback((incoming: Message) => {
    setMessages((prev) => {
      const exists = prev.some((m) => m.id === incoming.id);
      if (exists) {
        return prev.map((m) => (m.id === incoming.id ? incoming : m));
      }
      return [...prev, incoming];
    });
  }, []);

  const removeMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const sendMessage = useCallback(
    async (targetConversationId: string, content: string, files: File[] = []) => {
      if (!currentUserId) {
        throw new Error('You must be signed in to send messages.');
      }

      const trimmed = content.trim();
      if (!trimmed && files.length === 0) return null;

      const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const optimisticMessage: Message = {
        id: optimisticId,
        conversationId: targetConversationId,
        senderId: currentUserId,
        content: trimmed,
        messageType:
          files.length > 0
            ? files[0].type.startsWith('image/')
              ? 'image'
              : 'file'
            : 'text',
        timestamp: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'sending',
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        const saved = await messageService.sendMessage(
          targetConversationId,
          trimmed,
          files
        );

        setMessages((prev) => {
          const alreadyFromRealtime = prev.some((m) => m.id === saved.id);
          if (alreadyFromRealtime) {
            return prev.filter((m) => m.id !== optimisticId);
          }
          return prev.map((m) => (m.id === optimisticId ? saved : m));
        });

        return saved;
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        throw err;
      }
    },
    [currentUserId]
  );

  // Recompute read receipts locally whenever peer last_read_at timestamps advance
  useEffect(() => {
    if (!currentUserId || otherMemberLastReadAts.length === 0) return;
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.senderId !== currentUserId || msg.status !== 'sent') return msg;
        const msgTime = new Date(msg.timestamp).getTime();
        const isRead = otherMemberLastReadAts.some(
          (ts) => new Date(ts).getTime() >= msgTime
        );
        return isRead ? { ...msg, status: 'read' } : msg;
      })
    );
  }, [currentUserId, otherMemberLastReadAts]);

  return {
    messages,
    isLoading,
    error,
    reloadMessages: loadMessages,
    sendMessage,
    appendOrReplaceMessage,
    removeMessage,
  };
}
