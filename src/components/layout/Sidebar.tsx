import {
  Archive,
  LogOut,
  MessageSquare,
  MessageSquareDot,
  Moon,
  Settings,
  Sun,
  Users,
  UsersRound,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/common/Avatar';
import { Logo } from '@/components/common/Logo';
import { SearchBar } from '@/components/common/SearchBar';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/context/ChatContext';
import type { SidebarFilter } from '@/types';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className = '' }: SidebarProps) {
  const { user, settings, toggleTheme, logout } = useAuth();
  const {
    activeFilter,
    setActiveFilter,
    searchQuery,
    setSearchQuery,
    totalUnreadCount,
    conversations,
  } = useChat();
  const location = useLocation();
  const navigate = useNavigate();

  const archivedCount = conversations.filter((c) => c.isArchived).length;
  const groupsCount = conversations.filter((c) => c.type === 'group' && !c.isArchived).length;

  const isDashboard = location.pathname === '/' || location.pathname === '/dashboard';

  const handleChatFilterClick = (filter: SidebarFilter) => {
    setActiveFilter(filter);
    if (!isDashboard) {
      navigate('/dashboard');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItemClass = (active: boolean) =>
    `flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      active
        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
    }`;

  return (
    <aside
      aria-label="Primary navigation"
      className={`flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {/* Top logo & theme button */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 dark:border-slate-800">
        <Logo />
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} theme`}
          className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          {settings.theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Current user profile summary */}
      {user && (
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition ${
              location.pathname === '/profile'
                ? 'border-indigo-200 bg-indigo-50/70 dark:border-indigo-800/70 dark:bg-indigo-950/40'
                : 'border-slate-200/80 bg-slate-50/70 hover:bg-slate-100/80 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800'
            }`}
          >
            <Avatar
              src={user.avatarUrl}
              name={user.fullName}
              size="sm"
              status={user.status}
              showStatus
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {user.fullName}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                @{user.username}
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Global sidebar search */}
      <div className="px-3 pt-3">
        <SearchBar
          value={searchQuery}
          onChange={(val) => {
            setSearchQuery(val);
            if (!isDashboard && val.trim()) {
              navigate('/dashboard');
            }
          }}
          placeholder="Search chats..."
          ariaLabel="Search conversations"
        />
      </div>

      {/* Navigation items */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3 scrollbar-thin">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Messages
        </p>

        <button
          type="button"
          onClick={() => handleChatFilterClick('all')}
          className={navItemClass(isDashboard && activeFilter === 'all')}
        >
          <span className="flex items-center gap-3">
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span>All Chats</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleChatFilterClick('unread')}
          className={navItemClass(isDashboard && activeFilter === 'unread')}
        >
          <span className="flex items-center gap-3">
            <MessageSquareDot className="h-4 w-4 shrink-0" />
            <span>Unread Messages</span>
          </span>
          {totalUnreadCount > 0 && (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              {totalUnreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => navigate('/groups')}
          className={navItemClass(location.pathname === '/groups')}
        >
          <span className="flex items-center gap-3">
            <UsersRound className="h-4 w-4 shrink-0" />
            <span>Groups</span>
          </span>
          {groupsCount > 0 && (
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
              {groupsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => navigate('/contacts')}
          className={navItemClass(location.pathname === '/contacts')}
        >
          <span className="flex items-center gap-3">
            <Users className="h-4 w-4 shrink-0" />
            <span>Contacts</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleChatFilterClick('archived')}
          className={navItemClass(isDashboard && activeFilter === 'archived')}
        >
          <span className="flex items-center gap-3">
            <Archive className="h-4 w-4 shrink-0" />
            <span>Archived Chats</span>
          </span>
          {archivedCount > 0 && (
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
              {archivedCount}
            </span>
          )}
        </button>

        <div className="my-3 border-t border-slate-100 dark:border-slate-800" />

        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Preferences
        </p>

        <button
          type="button"
          onClick={() => navigate('/settings')}
          className={navItemClass(location.pathname === '/settings')}
        >
          <span className="flex items-center gap-3">
            <Settings className="h-4 w-4 shrink-0" />
            <span>Settings</span>
          </span>
        </button>
      </nav>

      {/* Footer logout */}
      <div className="border-t border-slate-100 p-3 dark:border-slate-800">
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
