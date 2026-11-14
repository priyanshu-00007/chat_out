import { useMemo } from 'react';
import {
  AlertCircle,
  BellOff,
  Image as ImageIcon,
  MessageSquareOff,
  Paperclip,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/common/Avatar';
import { EmptyState } from '@/components/common/EmptyState';
import { SearchBar } from '@/components/common/SearchBar';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { formatConversationTime } from '@/utils/formatters';

interface ConversationListProps {
  className?: string;
}

export function ConversationList({ className = '' }: ConversationListProps) {
  const { user } = useAuth();
  const {
    conversations,
    activeConversationId,
    activeTypingUserIds,
    activeFilter,
    setActiveFilter,
    searchQuery,
    setSearchQuery,
    selectConversation,
    getConversationDisplay,
    getUserById,
    isLoadingChat,
    chatError,
    refreshChat,
  } = useChat();
  const navigate = useNavigate();

  const debouncedSearch = useDebounce(searchQuery, 150).trim().toLowerCase();

  const filteredConversations = useMemo(() => {
    return conversations
      .filter((conv) => {
        if (activeFilter === 'archived') return conv.isArchived;
        if (conv.isArchived) return false;
        if (activeFilter === 'unread') return conv.unreadCount > 0;
        if (activeFilter === 'groups') return conv.type === 'group';
        return true;
      })
      .filter((conv) => {
        if (!debouncedSearch) return true;
        const display = getConversationDisplay(conv);
        return (
          display.title.toLowerCase().includes(debouncedSearch) ||
          display.subtitle.toLowerCase().includes(debouncedSearch) ||
          (conv.lastMessage?.content.toLowerCase().includes(debouncedSearch) ?? false)
        );
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [conversations, activeFilter, debouncedSearch, getConversationDisplay]);

  const filterTitle: Record<typeof activeFilter, string> = {
    all: 'Chats',
    unread: 'Unread',
    groups: 'Groups',
    archived: 'Archived',
  };

  return (
    <section
      aria-label="Conversations"
      className={`flex h-full w-full flex-col border-r border-slate-200 bg-white lg:w-80 xl:w-96 dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {/* Header */}
      <div className="border-b border-slate-100 px-4 pt-4 pb-3 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {filterTitle[activeFilter]}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {filteredConversations.length}{' '}
              {filteredConversations.length === 1 ? 'conversation' : 'conversations'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/contacts')}
            title="Start new conversation"
            aria-label="Start new conversation"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-300"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Search conversations */}
        <div className="mt-3">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search conversations or messages..."
            ariaLabel="Search conversations"
          />
        </div>

        {/* Filter pills */}
        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {(['all', 'unread', 'groups', 'archived'] as const).map((filter) => {
            const active = activeFilter === filter;
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {filter}
              </button>
            );
          })}
        </div>
      </div>

      {/* List body */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {isLoadingChat ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3, 4].map((skeleton) => (
              <div
                key={skeleton}
                className="flex animate-pulse items-center gap-3 rounded-xl p-2.5"
              >
                <div className="h-11 w-11 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-3 w-3/4 rounded bg-slate-100 dark:bg-slate-800/60" />
                </div>
              </div>
            ))}
          </div>
        ) : chatError ? (
          <EmptyState
            icon={<AlertCircle className="h-5 w-5 text-rose-500" />}
            title="Unable to load conversations"
            description={chatError}
            action={
              <button
                type="button"
                onClick={() => void refreshChat()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            }
          />
        ) : filteredConversations.length === 0 ? (
          <EmptyState
            icon={<MessageSquareOff className="h-5 w-5" />}
            title="No conversations found"
            description={
              debouncedSearch
                ? 'Try adjusting your search query or clearing the filter.'
                : activeFilter === 'unread'
                  ? 'You are all caught up! No unread messages right now.'
                  : activeFilter === 'archived'
                    ? 'No archived conversations yet.'
                    : 'Start a conversation from your contacts list.'
            }
            action={
              debouncedSearch || activeFilter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveFilter('all');
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Reset filters
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/contacts')}
                  className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  Browse Contacts
                </button>
              )
            }
          />
        ) : (
          <ul className="space-y-1">
            {filteredConversations.map((conv) => {
              const display = getConversationDisplay(conv);
              const lastMessage = conv.lastMessage;
              const isSelected = conv.id === activeConversationId;
              const isTyping = isSelected && activeTypingUserIds.length > 0;

              let lastPreview = 'No messages yet';
              if (isTyping) {
                lastPreview = 'Typing...';
              } else if (lastMessage) {
                const senderPrefix =
                  lastMessage.senderId === user?.id
                    ? 'You: '
                    : conv.type === 'group' && !lastMessage.isSystem
                      ? `${getUserById(lastMessage.senderId)?.fullName.split(' ')[0] ?? 'Member'}: `
                      : '';
                if (lastMessage.content) {
                  lastPreview = `${senderPrefix}${lastMessage.content}`;
                } else if (lastMessage.messageType === 'image') {
                  lastPreview = `${senderPrefix}Photo`;
                } else if (lastMessage.messageType === 'file') {
                  lastPreview = `${senderPrefix}Attachment`;
                }
              }

              return (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => void selectConversation(conv.id)}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      isSelected
                        ? 'bg-indigo-50/90 ring-1 ring-indigo-200/80 dark:bg-indigo-950/50 dark:ring-indigo-800/70'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Avatar
                      src={display.avatarUrl}
                      name={display.title}
                      size="md"
                      status={display.otherUser?.status}
                      showStatus={conv.type === 'direct'}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`truncate text-sm font-semibold ${
                            isSelected
                              ? 'text-indigo-950 dark:text-indigo-100'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {display.title}
                        </span>
                        <span className="shrink-0 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                          {formatConversationTime(conv.updatedAt)}
                        </span>
                      </div>

                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p
                          className={`flex min-w-0 items-center gap-1 truncate text-xs ${
                            isTyping
                              ? 'font-medium text-indigo-600 dark:text-indigo-400'
                              : conv.unreadCount > 0
                                ? 'font-medium text-slate-800 dark:text-slate-200'
                                : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {!isTyping &&
                            lastMessage &&
                            !lastMessage.content &&
                            (lastMessage.messageType === 'image' ? (
                              <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                            ) : lastMessage.messageType === 'file' ? (
                              <Paperclip className="h-3.5 w-3.5 shrink-0" />
                            ) : null)}
                          <span className="truncate">{lastPreview}</span>
                        </p>

                        <div className="flex shrink-0 items-center gap-1.5">
                          {conv.isMuted && (
                            <BellOff
                              className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
                              aria-label="Muted conversation"
                            />
                          )}
                          {conv.unreadCount > 0 && (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold text-white">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
