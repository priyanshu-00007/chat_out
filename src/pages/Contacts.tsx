import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Clock3,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/common/Avatar';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { SearchBar } from '@/components/common/SearchBar';
import { AppShell } from '@/components/layout/AppShell';
import { useChat } from '@/context/ChatContext';
import { useDebounce } from '@/hooks/useDebounce';
import { profileService } from '@/services/profileService';
import type { User } from '@/types';
import { formatLastSeen } from '@/utils/formatters';

type ViewMode = 'contacts' | 'find';

export function Contacts() {
  const { contacts, startDirectConversation, isLoadingChat, chatError, refreshChat } =
    useChat();
  const navigate = useNavigate();

  const [view, setView] = useState<ViewMode>('contacts');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online'>('all');
  const [selectedContact, setSelectedContact] = useState<User | null>(null);
  const [startingChatId, setStartingChatId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [findResults, setFindResults] = useState<User[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  const debouncedQuery = useDebounce(query, 200).trim();

  const filteredContacts = useMemo(() => {
    const normalized = debouncedQuery.toLowerCase();
    return contacts
      .filter((c) => (statusFilter === 'online' ? c.status === 'online' : true))
      .filter((c) => {
        if (!normalized) return true;
        return (
          c.fullName.toLowerCase().includes(normalized) ||
          c.username.toLowerCase().includes(normalized) ||
          c.about.toLowerCase().includes(normalized)
        );
      });
  }, [contacts, statusFilter, debouncedQuery]);

  useEffect(() => {
    if (view !== 'find' || !debouncedQuery) {
      setFindResults([]);
      setIsSearchingUsers(false);
      return;
    }

    let isMounted = true;
    setIsSearchingUsers(true);
    profileService
      .searchUsers(debouncedQuery)
      .then((results) => {
        if (!isMounted) return;
        setFindResults(results);
      })
      .catch((error) => {
        if (!isMounted) return;
        setActionError(
          error instanceof Error ? error.message : 'Could not search for users.'
        );
        setFindResults([]);
      })
      .finally(() => {
        if (isMounted) {
          setIsSearchingUsers(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery, view]);

  const refreshRequests = async () => {
    await refreshChat();
  };

  const handleStartChat = async (contactId: string) => {
    setStartingChatId(contactId);
    setActionError(null);
    try {
      await startDirectConversation(contactId);
      setSelectedContact(null);
      navigate('/dashboard');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not open conversation.');
    } finally {
      setStartingChatId(null);
    }
  };

  const handleAddContact = async (userId: string) => {
    setActionError(null);
    try {
      await profileService.sendContactRequest(userId);
      await refreshRequests();
      setView('contacts');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not send contact request.');
    }
  };

  const handleRespondToRequest = async (userId: string, status: 'accepted' | 'rejected') => {
    setActionError(null);
    try {
      await profileService.respondToContactRequest(userId, status);
      await refreshRequests();
      setView('contacts');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update contact request.');
    }
  };

  const getContactStatusLabel = (status?: User['contactStatus']) => {
    switch (status) {
      case 'accepted':
        return 'Connected';
      case 'pending_outgoing':
        return 'Request sent';
      case 'pending_incoming':
        return 'Incoming request';
      case 'rejected':
        return 'Declined';
      default:
        return 'Not connected';
    }
  };

  const renderFindPersonCard = (person: User) => {
    const status = person.contactStatus ?? 'none';
    const isOutgoing = status === 'pending_outgoing';
    const isIncoming = status === 'pending_incoming';
    const isConnected = status === 'accepted';

    return (
      <div
        key={person.id}
        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start gap-3">
          <Avatar src={person.avatarUrl} name={person.fullName} size="md" status={person.status} showStatus />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate font-display text-sm font-semibold text-slate-900 dark:text-white">
                  {person.fullName}
                </h2>
                <p className="truncate text-xs text-indigo-600 dark:text-indigo-400">@{person.username}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {getContactStatusLabel(status)}
              </span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {person.about}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isConnected ? (
            <button
              type="button"
              onClick={() => void handleStartChat(person.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Open chat
            </button>
          ) : isOutgoing ? (
            <button
              type="button"
              disabled
              className="inline-flex cursor-default items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300"
            >
              <Clock3 className="h-3.5 w-3.5" />
              Request sent
            </button>
          ) : isIncoming ? (
            <>
              <button
                type="button"
                onClick={() => void handleRespondToRequest(person.id, 'accepted')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
              >
                <Check className="h-3.5 w-3.5" />
                Accept
              </button>
              <button
                type="button"
                onClick={() => void handleRespondToRequest(person.id, 'rejected')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <X className="h-3.5 w-3.5" />
                Ignore
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void handleAddContact(person.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add contact
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <AppShell>
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[#f4f6f9] pb-16 md:pb-0 dark:bg-[#0b0f17]">
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                Contacts
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Keep your network current and discover new people to connect with.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setView('contacts')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  view === 'contacts'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                My contacts
              </button>
              <button
                type="button"
                onClick={() => setView('find')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  view === 'find'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Find people
              </button>
            </div>
          </div>

          {view === 'contacts' && (
            <>
              <div className="mx-auto mt-3 max-w-5xl">
                <SearchBar
                  value={query}
                  onChange={setQuery}
                  placeholder="Search your contacts..."
                  ariaLabel="Search contacts"
                />
              </div>

              <div className="mx-auto mt-3 flex max-w-5xl items-center gap-2">
                {(['all', 'online'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusFilter(tab)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition ${
                      statusFilter === tab
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {tab === 'online' ? 'Online now' : 'All contacts'}
                  </button>
                ))}
              </div>
            </>
          )}

          {view === 'find' && (
            <div className="mx-auto mt-3 max-w-5xl">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name, @username, or email..."
                  aria-label="Search for people"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 scrollbar-thin">
          <div className="mx-auto max-w-5xl">
            {actionError && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
              >
                {actionError}
              </div>
            )}

            {view === 'contacts' ? (
              isLoadingChat ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((item) => (
                    <div
                      key={item}
                      className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    />
                  ))}
                </div>
              ) : chatError ? (
                <EmptyState
                  icon={<AlertCircle className="h-5 w-5 text-rose-500" />}
                  title="Unable to load contacts"
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
              ) : filteredContacts.length === 0 ? (
                <EmptyState
                  icon={<Users className="h-5 w-5" />}
                  title={contacts.length === 0 ? 'No accepted contacts yet' : 'No matching contacts'}
                  description={
                    contacts.length === 0
                      ? 'Search for people and add them to your network to start messaging.'
                      : 'Try another name or clear your current filter.'
                  }
                  action={
                    (query || statusFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery('');
                          setStatusFilter('all');
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        Reset search
                      </button>
                    )
                  }
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-indigo-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-800/70"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedContact(contact)}
                        className="flex items-start gap-3 text-left"
                      >
                        <Avatar
                          src={contact.avatarUrl}
                          name={contact.fullName}
                          size="md"
                          status={contact.status}
                          showStatus
                        />
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate font-display text-sm font-semibold text-slate-900 dark:text-white">
                            {contact.fullName}
                          </h2>
                          <p className="truncate text-xs text-indigo-600 dark:text-indigo-400">
                            @{contact.username}
                          </p>
                          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                            {contact.about}
                          </p>
                        </div>
                      </button>

                      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                        <span className="truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">
                          {formatLastSeen(contact.lastSeen, contact.status)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedContact(contact)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            disabled={startingChatId === contact.id}
                            onClick={() => void handleStartChat(contact.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            {startingChatId === contact.id ? 'Opening...' : 'Chat'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <>
                {isSearchingUsers ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((item) => (
                      <div
                        key={item}
                        className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                      />
                    ))}
                  </div>
                ) : !debouncedQuery ? (
                  <EmptyState
                    icon={<Search className="h-5 w-5" />}
                    title="Find people"
                    description="Search by name, username, or email to discover who is on ChatSphere."
                  />
                ) : findResults.length === 0 ? (
                  <EmptyState
                    icon={<Users className="h-5 w-5" />}
                    title="No matching profiles"
                    description="Try another name or handle the search query differently."
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {findResults.map(renderFindPersonCard)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={selectedContact !== null}
        onClose={() => setSelectedContact(null)}
        title="User Profile"
        maxWidthClass="max-w-md"
      >
        {selectedContact && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar
                src={selectedContact.avatarUrl}
                name={selectedContact.fullName}
                size="xl"
                status={selectedContact.status}
                showStatus
              />
              <div className="min-w-0">
                <h3 className="truncate font-display text-lg font-bold text-slate-900 dark:text-white">
                  {selectedContact.fullName}
                </h3>
                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  @{selectedContact.username}
                </p>
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <UserCheck className="h-3.5 w-3.5" />
                  {formatLastSeen(selectedContact.lastSeen, selectedContact.status)}
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-800/50">
              <div>
                <span className="font-medium text-slate-400">About</span>
                <p className="mt-0.5 leading-relaxed text-slate-800 dark:text-slate-200">
                  {selectedContact.about}
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/80 pt-2.5 dark:border-slate-700/70">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {selectedContact.email || 'No email provided'}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={startingChatId === selectedContact.id}
              onClick={() => void handleStartChat(selectedContact.id)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              <MessageSquare className="h-4 w-4" />
              {startingChatId === selectedContact.id
                ? 'Opening Conversation...'
                : 'Start Conversation'}
            </button>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
