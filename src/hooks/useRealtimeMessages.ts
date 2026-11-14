import { useEffect, useRef, useState } from 'react';
import { realtimeService, type RealtimeStatus } from '@/services/realtimeService';
import type { Message } from '@/types';

interface UseRealtimeMessagesOptions {
  conversationId: string | null;
  currentUserId: string | undefined;
  onIncomingMessage: (message: Message) => void;
  onMessageUpdated: (message: Message) => void;
  onMessageDeleted: (messageId: string) => void;
  onPresenceSync?: (onlineUserIds: Set<string>) => void;
  onReadReceipt?: (userId: string, lastReadAt: string) => void;
}

export function useRealtimeMessages({
  conversationId,
  currentUserId,
  onIncomingMessage,
  onMessageUpdated,
  onMessageDeleted,
  onPresenceSync,
  onReadReceipt,
}: UseRealtimeMessagesOptions) {
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('disconnected');
  const sendTypingRef = useRef<(isTyping: boolean) => void>(() => {});
  const callbacksRef = useRef({
    onIncomingMessage,
    onMessageUpdated,
    onMessageDeleted,
    onPresenceSync,
    onReadReceipt,
  });

  callbacksRef.current = {
    onIncomingMessage,
    onMessageUpdated,
    onMessageDeleted,
    onPresenceSync,
    onReadReceipt,
  };

  useEffect(() => {
    setTypingUserIds([]);
    if (!conversationId || !currentUserId) {
      sendTypingRef.current = () => {};
      setRealtimeStatus('disconnected');
      return;
    }

    const socketSession = realtimeService.connectConversationSocket(conversationId, {
      onMessageNew: (message) => callbacksRef.current.onIncomingMessage(message),
      onMessageUpdated: (message) => callbacksRef.current.onMessageUpdated(message),
      onMessageDeleted: (messageId) => callbacksRef.current.onMessageDeleted(messageId),
      onTypingChange: setTypingUserIds,
      onPresenceSync: (ids) => callbacksRef.current.onPresenceSync?.(ids),
      onReadReceipt: (uid, ts) => callbacksRef.current.onReadReceipt?.(uid, ts),
      onStatusChange: setRealtimeStatus,
    });

    sendTypingRef.current = socketSession.sendTyping;

    return () => {
      socketSession.cleanup();
      sendTypingRef.current = () => {};
      setTypingUserIds([]);
    };
  }, [conversationId, currentUserId]);

  return {
    typingUserIds,
    realtimeStatus,
    sendTyping: (isTyping: boolean) => sendTypingRef.current(isTyping),
  };
}
