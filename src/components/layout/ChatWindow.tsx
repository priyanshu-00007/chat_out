import { Fragment, useEffect, useRef, useState } from 'react';
import { AlertCircle, MessageSquare, Phone, Shield, Users, Video } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { ChatHeader } from '@/components/layout/ChatHeader';
import { MessageBubble } from '@/components/layout/MessageBubble';
import { MessageInput } from '@/components/layout/MessageInput';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/hooks/useAuth';
import { formatDateSeparator, formatLastSeen, getDateKey } from '@/utils/formatters';

interface ChatWindowProps {
  className?: string;
}

export function ChatWindow({ className = '' }: ChatWindowProps) {
  const { user } = useAuth();
  const {
    activeConversation,
    activeMessages,
    activeTypingUserIds,
    isLoadingMessages,
    messagesError,
    selectConversation,
    sendMessage,
    sendTyping,
    getUserById,
    getConversationDisplay,
  } = useChat();

  const [callPreviewType, setCallPreviewType] = useState<'voice' | 'video' | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.id, activeMessages.length, activeTypingUserIds.length]);

  if (!activeConversation) {
    return (
      <main
        className={`flex flex-1 flex-col items-center justify-center bg-[#f4f6f9] dark:bg-[#0b0f17] ${className}`}
      >
        <EmptyState
          icon={<MessageSquare className="h-6 w-6 text-indigo-500" />}
          title="Select a conversation"
          description="Choose an existing chat from the list or start a new conversation with any contact."
        />
      </main>
    );
  }

  const display = getConversationDisplay(activeConversation);

  return (
    <main
      className={`flex h-full min-w-0 flex-1 flex-col bg-[#f4f6f9] dark:bg-[#0b0f17] ${className}`}
    >
      <ChatHeader
        conversation={activeConversation}
        typingUserIds={activeTypingUserIds}
        onBack={() => void selectConversation(null)}
        onVoiceCallClick={() => setCallPreviewType('voice')}
        onVideoCallClick={() => setCallPreviewType('video')}
        onOpenDetails={() => setShowDetailsModal(true)}
      />

      {/* Scrollable message history */}
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 scrollbar-thin">
        {isLoadingMessages ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className={`flex ${item % 2 === 0 ? 'justify-end' : 'justify-start'}`}
              >
                <div className="h-12 w-56 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        ) : messagesError ? (
          <EmptyState
            icon={<AlertCircle className="h-5 w-5 text-rose-500" />}
            title="Unable to load messages"
            description={messagesError}
            className="my-12"
          />
        ) : activeMessages.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-5 w-5" />}
            title={`Start chatting with ${display.title}`}
            description="Send your first message, photo, or file below."
            className="my-12"
          />
        ) : (
          <div className="mx-auto flex max-w-4xl flex-col gap-2">
            {activeMessages.map((msg, index) => {
              const prevMsg = index > 0 ? activeMessages[index - 1] : null;
              const showDateDivider =
                !prevMsg || getDateKey(prevMsg.timestamp) !== getDateKey(msg.timestamp);
              const isOwn = msg.senderId === user?.id;
              const sender = getUserById(msg.senderId);
              const showSenderName =
                activeConversation.type === 'group' &&
                !isOwn &&
                !msg.isSystem &&
                (!prevMsg || prevMsg.senderId !== msg.senderId || showDateDivider);

              return (
                <Fragment key={msg.id}>
                  {showDateDivider && (
                    <div className="my-3 flex items-center justify-center">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-500 shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                        {formatDateSeparator(msg.timestamp)}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={msg}
                    isOwn={isOwn}
                    senderName={sender?.fullName}
                    showSenderName={showSenderName}
                  />
                </Fragment>
              );
            })}

            {/* Live Realtime typing indicator */}
            {activeTypingUserIds.length > 0 && (
              <div className="mt-1 flex items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {getUserById(activeTypingUserIds[0])?.fullName.split(' ')[0] ??
                      'User'}{' '}
                    is typing
                  </span>
                  <span className="flex items-center gap-1" aria-hidden="true">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500" />
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <MessageInput
        onSend={(content, files) => sendMessage(activeConversation.id, content, files)}
        onTyping={sendTyping}
      />

      {/* Call visual-only modal */}
      <Modal
        isOpen={callPreviewType !== null}
        onClose={() => setCallPreviewType(null)}
        title={callPreviewType === 'video' ? 'Video Call' : 'Voice Call'}
        description="Feature not connected"
        maxWidthClass="max-w-sm"
      >
        <div className="flex flex-col items-center py-3 text-center">
          <Avatar src={display.avatarUrl} name={display.title} size="xl" />
          <p className="mt-3 font-display text-base font-semibold text-slate-900 dark:text-white">
            {display.title}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {callPreviewType === 'video' ? 'Video calling' : 'Voice calling'} is a visual
            UI control only and is not connected to a WebRTC signaling server.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {callPreviewType === 'video' ? (
                <Video className="h-4 w-4" />
              ) : (
                <Phone className="h-4 w-4" />
              )}
            </span>
            <button
              type="button"
              onClick={() => setCallPreviewType(null)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Conversation / Group Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title={activeConversation.type === 'group' ? 'Group Details' : 'Contact Details'}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar
              src={display.avatarUrl}
              name={display.title}
              size="lg"
              status={display.otherUser?.status}
              showStatus={activeConversation.type === 'direct'}
            />
            <div className="min-w-0">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {display.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeConversation.type === 'group'
                  ? `${activeConversation.participantIds.length} participants`
                  : `@${display.otherUser?.username ?? ''}`}
              </p>
            </div>
          </div>

          {activeConversation.type === 'direct' && display.otherUser && (
            <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-800/50">
              <div>
                <span className="font-medium text-slate-400">Status</span>
                <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">
                  {formatLastSeen(display.otherUser.lastSeen, display.otherUser.status)}
                </p>
              </div>
              <div>
                <span className="font-medium text-slate-400">About</span>
                <p className="mt-0.5 text-slate-700 dark:text-slate-300">
                  {display.otherUser.about}
                </p>
              </div>
              <div>
                <span className="font-medium text-slate-400">Email</span>
                <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">
                  {display.otherUser.email || 'No email provided'}
                </p>
              </div>
            </div>
          )}

          {activeConversation.type === 'group' && (
            <div className="space-y-3">
              {activeConversation.description && (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                  {activeConversation.description}
                </p>
              )}
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Users className="h-3.5 w-3.5" />
                  Members ({activeConversation.participantIds.length})
                </h4>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                  {activeConversation.participantIds.map((memberId) => {
                    const member = getUserById(memberId);
                    if (!member) return null;
                    const isAdmin = activeConversation.adminIds.includes(memberId);
                    return (
                      <li
                        key={memberId}
                        className="flex items-center justify-between gap-3 px-3 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar
                            src={member.avatarUrl}
                            name={member.fullName}
                            size="sm"
                            status={member.status}
                            showStatus
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                              {member.fullName}
                              {member.id === user?.id ? ' (You)' : ''}
                            </p>
                            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                              @{member.username}
                            </p>
                          </div>
                        </div>
                        {isAdmin && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
                            <Shield className="h-2.5 w-2.5" />
                            Admin
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </main>
  );
}
