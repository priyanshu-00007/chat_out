import { WS_BASE_URL, getAccessToken } from '@/services/api';
import type { Message } from '@/types';

export type RealtimeStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WebSocketServerEvent {
  type:
    | 'message:new'
    | 'message:updated'
    | 'message:deleted'
    | 'typing'
    | 'presence:sync'
    | 'read_receipt'
    | 'conversation:updated';
  payload: Record<string, unknown>;
}

export const realtimeService = {
  connectConversationSocket(
    conversationId: string,
    handlers: {
      onMessageNew: (message: Message) => void;
      onMessageUpdated: (message: Message) => void;
      onMessageDeleted: (messageId: string) => void;
      onTypingChange: (typingUserIds: string[]) => void;
      onPresenceSync?: (onlineUserIds: Set<string>) => void;
      onReadReceipt?: (userId: string, lastReadAt: string) => void;
      onStatusChange?: (status: RealtimeStatus) => void;
    }
  ): {
    sendTyping: (isTyping: boolean) => void;
    cleanup: () => void;
  } {
    const token = getAccessToken();
    if (!token) {
      handlers.onStatusChange?.('disconnected');
      return {
        sendTyping: () => {},
        cleanup: () => {},
      };
    }

    let socket: WebSocket | null = null;
    let isDisposed = false;
    let reconnectAttempt = 0;
    let reconnectTimer: number | null = null;
    const typingUsers = new Map<string, number>();

    const emitTyping = () => {
      handlers.onTypingChange(Array.from(typingUsers.keys()));
    };

    const connect = () => {
      if (isDisposed) return;
      handlers.onStatusChange?.('connecting');

      const wsUrl = `${WS_BASE_URL}/chat/${encodeURIComponent(conversationId)}?token=${encodeURIComponent(token)}`;
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        reconnectAttempt = 0;
        handlers.onStatusChange?.('connected');
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as WebSocketServerEvent;
          if (data.type === 'message:new') {
            handlers.onMessageNew(data.payload as unknown as Message);
          } else if (data.type === 'message:updated') {
            handlers.onMessageUpdated(data.payload as unknown as Message);
          } else if (data.type === 'message:deleted') {
            const id = data.payload.message_id as string | undefined;
            if (id) handlers.onMessageDeleted(id);
          } else if (data.type === 'typing') {
            const userId = data.payload.user_id as string | undefined;
            const isTyping = Boolean(data.payload.is_typing);
            if (!userId) return;

            const existingTimer = typingUsers.get(userId);
            if (existingTimer !== undefined) {
              window.clearTimeout(existingTimer);
              typingUsers.delete(userId);
            }

            if (isTyping) {
              const timeoutId = window.setTimeout(() => {
                typingUsers.delete(userId);
                emitTyping();
              }, 4000);
              typingUsers.set(userId, timeoutId);
            }
            emitTyping();
          } else if (data.type === 'presence:sync' && handlers.onPresenceSync) {
            const onlineIds = (data.payload.online_user_ids as string[] | undefined) ?? [];
            handlers.onPresenceSync(new Set(onlineIds));
          } else if (data.type === 'read_receipt' && handlers.onReadReceipt) {
            const uid = data.payload.user_id as string | undefined;
            const readAt = data.payload.last_read_at as string | undefined;
            if (uid && readAt) {
              handlers.onReadReceipt(uid, readAt);
            }
          }
        } catch {
          // Ignore malformed WebSocket messages
        }
      };

      socket.onerror = () => {
        handlers.onStatusChange?.('error');
      };

      socket.onclose = () => {
        if (isDisposed) {
          handlers.onStatusChange?.('disconnected');
          return;
        }
        handlers.onStatusChange?.('disconnected');
        if (reconnectAttempt < 5) {
          const delayMs = Math.min(1000 * 2 ** reconnectAttempt, 16000);
          reconnectAttempt += 1;
          reconnectTimer = window.setTimeout(connect, delayMs);
        }
      };
    };

    connect();

    return {
      sendTyping: (isTyping: boolean) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: 'typing',
              payload: { is_typing: isTyping },
            })
          );
        }
      },
      cleanup: () => {
        isDisposed = true;
        if (reconnectTimer !== null) {
          window.clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        typingUsers.forEach((timerId) => window.clearTimeout(timerId));
        typingUsers.clear();
        if (socket) {
          socket.close();
          socket = null;
        }
        handlers.onStatusChange?.('disconnected');
      },
    };
  },
};
