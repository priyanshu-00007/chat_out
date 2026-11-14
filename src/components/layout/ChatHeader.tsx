import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Bell,
  BellOff,
  Info,
  MoreVertical,
  Phone,
  Video,
} from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { Dropdown, type DropdownItem } from '@/components/common/Dropdown';
import { useChat } from '@/context/ChatContext';
import type { Conversation } from '@/types';
import { formatLastSeen } from '@/utils/formatters';

interface ChatHeaderProps {
  conversation: Conversation;
  typingUserIds: string[];
  onBack: () => void;
  onVoiceCallClick: () => void;
  onVideoCallClick: () => void;
  onOpenDetails: () => void;
}

export function ChatHeader({
  conversation,
  typingUserIds,
  onBack,
  onVoiceCallClick,
  onVideoCallClick,
  onOpenDetails,
}: ChatHeaderProps) {
  const {
    getConversationDisplay,
    getUserById,
    toggleMuteConversation,
    toggleArchiveConversation,
  } = useChat();

  const display = getConversationDisplay(conversation);
  const isTyping = typingUserIds.length > 0;

  let statusText = display.subtitle;
  if (isTyping) {
    if (conversation.type === 'group') {
      const typer = getUserById(typingUserIds[0]);
      statusText = `${typer?.fullName.split(' ')[0] ?? 'Someone'} is typing...`;
    } else {
      statusText = 'typing...';
    }
  } else if (conversation.type === 'direct' && display.otherUser) {
    statusText = formatLastSeen(display.otherUser.lastSeen, display.otherUser.status);
  }

  const menuItems: DropdownItem[] = [
    {
      id: 'details',
      label: conversation.type === 'group' ? 'Group info & members' : 'Contact info',
      icon: <Info className="h-4 w-4" />,
      onClick: onOpenDetails,
    },
    {
      id: 'mute',
      label: conversation.isMuted ? 'Unmute notifications' : 'Mute notifications',
      icon: conversation.isMuted ? (
        <Bell className="h-4 w-4" />
      ) : (
        <BellOff className="h-4 w-4" />
      ),
      onClick: () => {
        void toggleMuteConversation(conversation.id);
      },
    },
    {
      id: 'archive',
      label: conversation.isArchived ? 'Unarchive chat' : 'Archive chat',
      icon: conversation.isArchived ? (
        <ArchiveRestore className="h-4 w-4" />
      ) : (
        <Archive className="h-4 w-4" />
      ),
      onClick: () => {
        void toggleArchiveConversation(conversation.id);
      },
    },
  ];

  return (
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onOpenDetails}
          className="flex min-w-0 items-center gap-3 rounded-xl py-0.5 pr-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
        >
          <Avatar
            src={display.avatarUrl}
            name={display.title}
            size="md"
            status={display.otherUser?.status}
            showStatus={conversation.type === 'direct'}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate font-display text-sm font-semibold text-slate-900 dark:text-white">
                {display.title}
              </h2>
              {conversation.isMuted && (
                <BellOff className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              )}
            </div>
            <p
              className={`truncate text-xs ${
                isTyping
                  ? 'font-medium text-indigo-600 dark:text-indigo-400'
                  : display.isOnline
                    ? 'font-medium text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {statusText}
            </p>
          </div>
        </button>
      </div>

      {/* Header actions */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onVoiceCallClick}
          title="Voice call (not yet connected)"
          aria-label="Voice call"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <Phone className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onVideoCallClick}
          title="Video call (not yet connected)"
          aria-label="Video call"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <Video className="h-4 w-4" />
        </button>

        <Dropdown
          ariaLabel="Conversation options"
          trigger={<MoreVertical className="h-4 w-4" />}
          items={menuItems}
        />
      </div>
    </header>
  );
}
