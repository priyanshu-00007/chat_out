import { AppShell } from '@/components/layout/AppShell';
import { ChatWindow } from '@/components/layout/ChatWindow';
import { ConversationList } from '@/components/layout/ConversationList';
import { useChat } from '@/context/ChatContext';

export function Dashboard() {
  const { activeConversationId } = useChat();

  return (
    <AppShell>
      {/* Conversation List: always visible on lg+, visible on <lg when no active conversation */}
      <ConversationList
        className={
          activeConversationId
            ? 'hidden lg:flex'
            : 'flex pb-16 md:pb-0'
        }
      />

      {/* Chat Window: always visible on lg+, visible on <lg when a conversation is selected */}
      <ChatWindow
        className={activeConversationId ? 'flex' : 'hidden lg:flex'}
      />
    </AppShell>
  );
}
