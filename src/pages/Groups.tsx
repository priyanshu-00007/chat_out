import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  Plus,
  Shield,
  Trash2,
  Users,
  UsersRound,
} from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { SearchBar } from '@/components/common/SearchBar';
import { AppShell } from '@/components/layout/AppShell';
import { MessageBubble } from '@/components/layout/MessageBubble';
import { MessageInput } from '@/components/layout/MessageInput';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/hooks/useAuth';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { validateAvatarFile } from '@/services/storageService';
import { formatConversationTime, formatDateSeparator, getDateKey } from '@/utils/formatters';

export function Groups() {
  const { user } = useAuth();
  const {
    contacts,
    conversations,
    activeConversationId,
    activeMessages,
    activeTypingUserIds,
    isLoadingChat,
    isLoadingMessages,
    messagesError,
    selectConversation,
    sendMessage,
    sendTyping,
    createGroupConversation,
    getUserById,
  } = useChat();

  const groupConversations = useMemo(
    () =>
      conversations
        .filter((c) => c.type === 'group')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [conversations]
  );

  const [groupSearch, setGroupSearch] = useState('');
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const isXlScreen = useMediaQuery('(min-width: 1280px)');
  const isDesktopScreen = useMediaQuery('(min-width: 1024px)');

  // Create Group modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupAvatarFile, setGroupAvatarFile] = useState<File | undefined>(undefined);
  const [groupAvatarPreview, setGroupAvatarPreview] = useState<string | undefined>(undefined);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return groupConversations;
    return groupConversations.filter(
      (g) =>
        (g.name?.toLowerCase().includes(q) ?? false) ||
        (g.description?.toLowerCase().includes(q) ?? false)
    );
  }, [groupConversations, groupSearch]);

  const selectedGroup = useMemo(
    () => groupConversations.find((g) => g.id === activeConversationId) ?? null,
    [groupConversations, activeConversationId]
  );

  // Auto-select first group on desktop when entering Groups page with no group selected
  useEffect(() => {
    if (!selectedGroup && isDesktopScreen && groupConversations.length > 0) {
      void selectConversation(groupConversations[0].id);
    }
  }, [selectedGroup, isDesktopScreen, groupConversations, selectConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedGroup?.id, activeMessages.length, activeTypingUserIds.length]);

  useEffect(() => {
    return () => {
      if (groupAvatarPreview) URL.revokeObjectURL(groupAvatarPreview);
    };
  }, [groupAvatarPreview]);

  const filteredModalContacts = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) || c.username.toLowerCase().includes(q)
    );
  }, [contacts, memberSearch]);

  const toggleParticipant = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleGroupAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationErr = validateAvatarFile(file);
    if (validationErr) {
      setCreateError(validationErr);
      return;
    }
    if (groupAvatarPreview) URL.revokeObjectURL(groupAvatarPreview);
    setGroupAvatarFile(file);
    setGroupAvatarPreview(URL.createObjectURL(file));
    setCreateError(null);
  };

  const resetCreateForm = () => {
    setGroupName('');
    setGroupDescription('');
    if (groupAvatarPreview) URL.revokeObjectURL(groupAvatarPreview);
    setGroupAvatarFile(undefined);
    setGroupAvatarPreview(undefined);
    setSelectedMemberIds([]);
    setMemberSearch('');
    setCreateError(null);
  };

  const handleCreateGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || groupName.trim().length < 2) {
      setCreateError('Group name must be at least 2 characters.');
      return;
    }
    if (selectedMemberIds.length === 0) {
      setCreateError('Select at least one participant to create a group.');
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      await createGroupConversation({
        name: groupName.trim(),
        description: groupDescription.trim(),
        avatarFile: groupAvatarFile,
        participantIds: selectedMemberIds,
      });
      setIsCreateOpen(false);
      resetCreateForm();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unable to create group.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <AppShell>
      {/* Left/Middle Group List */}
      <section
        aria-label="Groups list"
        className={`h-full w-full flex-col border-r border-slate-200 bg-white lg:w-80 xl:w-96 dark:border-slate-800 dark:bg-slate-900 ${
          selectedGroup ? 'hidden lg:flex' : 'flex pb-16 md:pb-0'
        }`}
      >
        <div className="border-b border-slate-100 px-4 pt-4 pb-3 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Groups
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {groupConversations.length} active{' '}
                {groupConversations.length === 1 ? 'group' : 'groups'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              New Group
            </button>
          </div>

          <div className="mt-3">
            <SearchBar
              value={groupSearch}
              onChange={setGroupSearch}
              placeholder="Search groups..."
              ariaLabel="Search groups"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {isLoadingChat ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : filteredGroups.length === 0 ? (
            <EmptyState
              icon={<UsersRound className="h-5 w-5" />}
              title="No groups found"
              description="Create a new group chat and invite contacts."
              action={
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  Create Group
                </button>
              }
            />
          ) : (
            <ul className="space-y-1">
              {filteredGroups.map((group) => {
                const isSelected = group.id === selectedGroup?.id;
                const lastMsg = group.lastMessage;

                return (
                  <li key={group.id}>
                    <button
                      type="button"
                      onClick={() => void selectConversation(group.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        isSelected
                          ? 'bg-indigo-50/90 ring-1 ring-indigo-200/80 dark:bg-indigo-950/50 dark:ring-indigo-800/70'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <Avatar
                        src={group.avatarUrl}
                        name={group.name || 'Group'}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {group.name}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {formatConversationTime(group.updatedAt)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {lastMsg?.content || `${group.participantIds.length} members`}
                          </p>
                          <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {group.participantIds.length}
                          </span>
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

      {/* Group Conversation & Members Area */}
      <main
        className={`h-full min-w-0 flex-1 flex-col bg-[#f4f6f9] dark:bg-[#0b0f17] ${
          selectedGroup ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {!selectedGroup ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={<UsersRound className="h-6 w-6 text-indigo-500" />}
              title="Select or create a group"
              description="Collaborate with multiple contacts in a shared ChatSphere group."
              action={
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  Create New Group
                </button>
              }
            />
          </div>
        ) : (
          <div className="flex h-full min-w-0 flex-1 overflow-hidden">
            <div className="flex h-full min-w-0 flex-1 flex-col">
              {/* Group Header */}
              <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void selectConversation(null)}
                    aria-label="Back to groups"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <Avatar
                    src={selectedGroup.avatarUrl}
                    name={selectedGroup.name || 'Group'}
                    size="md"
                  />
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-sm font-semibold text-slate-900 dark:text-white">
                      {selectedGroup.name}
                    </h2>
                    <p
                      className={`truncate text-xs ${
                        activeTypingUserIds.length > 0
                          ? 'font-medium text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {activeTypingUserIds.length > 0
                        ? `${getUserById(activeTypingUserIds[0])?.fullName.split(' ')[0] ?? 'Someone'} is typing...`
                        : `${selectedGroup.participantIds.length} members${
                            selectedGroup.description ? ` · ${selectedGroup.description}` : ''
                          }`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMembersPanel((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                    showMembersPanel
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Members</span>
                  <span>({selectedGroup.participantIds.length})</span>
                </button>
              </header>

              {/* Group Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 scrollbar-thin">
                {isLoadingMessages ? (
                  <div className="space-y-3 py-4">
                    {[1, 2, 3].map((s) => (
                      <div key={s} className="h-12 w-56 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
                    ))}
                  </div>
                ) : messagesError ? (
                  <EmptyState
                    icon={<AlertCircle className="h-5 w-5 text-rose-500" />}
                    title="Unable to load messages"
                    description={messagesError}
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
                        !isOwn &&
                        !msg.isSystem &&
                        (!prevMsg || prevMsg.senderId !== msg.senderId || showDateDivider);

                      return (
                        <Fragment key={msg.id}>
                          {showDateDivider && (
                            <div className="my-3 flex justify-center">
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
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
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Group Composer */}
              <MessageInput
                onSend={(content, files) => sendMessage(selectedGroup.id, content, files)}
                onTyping={sendTyping}
              />
            </div>

            {/* Group Members Panel */}
            {showMembersPanel && (
              <aside className="hidden w-72 shrink-0 flex-col border-l border-slate-200 bg-white xl:flex dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
                  <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                    Group Members ({selectedGroup.participantIds.length})
                  </h3>
                  {selectedGroup.description && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {selectedGroup.description}
                    </p>
                  )}
                </div>
                <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto p-2 scrollbar-thin dark:divide-slate-800/70">
                  {selectedGroup.participantIds.map((memberId) => {
                    const member = getUserById(memberId);
                    if (!member) return null;
                    const isAdmin = selectedGroup.adminIds.includes(memberId);
                    return (
                      <li
                        key={memberId}
                        className="flex items-center justify-between gap-2.5 rounded-xl px-2.5 py-2.5"
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
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
                            <Shield className="h-2.5 w-2.5" />
                            Admin
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </aside>
            )}
          </div>
        )}
      </main>

      {/* Group Members Modal for smaller screens */}
      <Modal
        isOpen={showMembersPanel && selectedGroup !== null && !isXlScreen}
        onClose={() => setShowMembersPanel(false)}
        title={`Members (${selectedGroup?.participantIds.length ?? 0})`}
        description={selectedGroup?.description}
      >
        {selectedGroup && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {selectedGroup.participantIds.map((memberId) => {
              const member = getUserById(memberId);
              if (!member) return null;
              const isAdmin = selectedGroup.adminIds.includes(memberId);
              return (
                <li key={memberId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                      src={member.avatarUrl}
                      name={member.fullName}
                      size="sm"
                      status={member.status}
                      showStatus
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {member.fullName}
                        {member.id === user?.id ? ' (You)' : ''}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        @{member.username}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
                      Admin
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      {/* Create Group Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          resetCreateForm();
        }}
        title="Create New Group"
        description="Set a group photo, name, and invite participants."
      >
        <form onSubmit={handleCreateGroup} className="space-y-4">
          {/* Group image upload */}
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <Avatar src={groupAvatarPreview} name={groupName || 'New Group'} size="lg" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Group image
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleGroupAvatarChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {groupAvatarPreview ? 'Change' : 'Upload image'}
                </button>
                {groupAvatarPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      if (groupAvatarPreview) URL.revokeObjectURL(groupAvatarPreview);
                      setGroupAvatarFile(undefined);
                      setGroupAvatarPreview(undefined);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Group name */}
          <div>
            <label
              htmlFor="group-name"
              className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Group name
            </label>
            <input
              id="group-name"
              type="text"
              value={groupName}
              onChange={(e) => {
                setGroupName(e.target.value);
                if (createError) setCreateError(null);
              }}
              placeholder="e.g. Launch Squad"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100"
            />
          </div>

          {/* Group description */}
          <div>
            <label
              htmlFor="group-desc"
              className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Description (optional)
            </label>
            <input
              id="group-desc"
              type="text"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              placeholder="What is this group about?"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100"
            />
          </div>

          {/* Participants picker */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Add participants
              </span>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {selectedMemberIds.length} selected
              </span>
            </div>

            <SearchBar
              value={memberSearch}
              onChange={setMemberSearch}
              placeholder="Filter contacts..."
              ariaLabel="Filter participants"
              className="mb-2"
            />

            {filteredModalContacts.length === 0 ? (
              <p className="rounded-xl border border-slate-200 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                No contacts available to invite.
              </p>
            ) : (
              <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 scrollbar-thin dark:divide-slate-800 dark:border-slate-800">
                {filteredModalContacts.map((contact) => {
                  const checked = selectedMemberIds.includes(contact.id);
                  return (
                    <li key={contact.id}>
                      <button
                        type="button"
                        onClick={() => toggleParticipant(contact.id)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar
                            src={contact.avatarUrl}
                            name={contact.fullName}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                              {contact.fullName}
                            </p>
                            <p className="truncate text-[11px] text-slate-500">
                              @{contact.username}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                            checked
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {checked && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {createError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
            >
              {createError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsCreateOpen(false);
                resetCreateForm();
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {isCreating ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
