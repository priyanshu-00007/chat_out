import { MessageSquare, Settings, User as UserIcon, Users, UsersRound } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChat } from '@/context/ChatContext';

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { totalUnreadCount, activeConversationId } = useChat();

  const isDashboard = location.pathname === '/' || location.pathname === '/dashboard';

  // Hide bottom nav when actively inside a chat thread on mobile
  if (isDashboard && activeConversationId) {
    return null;
  }

  const navItems = [
    {
      label: 'Chats',
      path: '/dashboard',
      icon: MessageSquare,
      badge: totalUnreadCount,
      active: isDashboard,
    },
    {
      label: 'Groups',
      path: '/groups',
      icon: UsersRound,
      badge: 0,
      active: location.pathname === '/groups',
    },
    {
      label: 'Contacts',
      path: '/contacts',
      icon: Users,
      badge: 0,
      active: location.pathname === '/contacts',
    },
    {
      label: 'Profile',
      path: '/profile',
      icon: UserIcon,
      badge: 0,
      active: location.pathname === '/profile',
    },
    {
      label: 'Settings',
      path: '/settings',
      icon: Settings,
      badge: 0,
      active: location.pathname === '/settings',
    },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-slate-200 bg-white/95 px-2 py-1.5 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/95"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            type="button"
            onClick={() => navigate(item.path)}
            className={`relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-medium transition ${
              item.active
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {item.badge > 0 && (
                <span className="absolute -top-1.5 -right-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </div>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
