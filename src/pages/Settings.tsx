import { useState } from 'react';
import { Bell, Lock, LogOut, Moon, Radio, Shield, Sun, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/hooks/useAuth';

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          checked ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export function Settings() {
  const { user, settings, setTheme, updateSettings, logout } = useAuth();
  const { realtimeStatus } = useChat();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const realtimeBadgeClass =
    realtimeStatus === 'connected'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
      : realtimeStatus === 'connecting'
        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300';

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto bg-[#f4f6f9] px-4 py-6 pb-20 sm:px-8 md:pb-8 scrollbar-thin dark:bg-[#0b0f17]">
        <div className="mx-auto max-w-3xl space-y-5">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Settings
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Customize appearance, privacy, notifications, and account preferences.
            </p>
          </div>

          {/* Theme Selection */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
              <Sun className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Appearance
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition ${
                  settings.theme === 'light'
                    ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600/20 dark:bg-indigo-950/30'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <Sun className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Light Theme
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Clean neutral canvas & crisp white cards
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition ${
                  settings.theme === 'dark'
                    ? 'border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500/30'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-indigo-400">
                  <Moon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Dark Theme
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Low-glare slate surfaces for night work
                  </p>
                </div>
              </button>
            </div>
          </section>

          {/* Account Settings */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Account
              </h2>
            </div>

            <div className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    Signed-in account
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {user?.fullName} (@{user?.username}){user?.email ? ` · ${user.email}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/profile')}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Edit Profile
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
                    <Radio className="h-3.5 w-3.5 text-slate-400" />
                    WebSocket Realtime
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Live FastAPI WebSocket message, presence, and typing channel status
                  </p>
                </div>
                <span
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize ${realtimeBadgeClass}`}
                >
                  {realtimeStatus}
                </span>
              </div>
            </div>
          </section>

          {/* Privacy Settings */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <Lock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Privacy
              </h2>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Last seen & online status
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Choose who can see when you were last active
                  </p>
                </div>
                <select
                  aria-label="Last seen visibility"
                  value={settings.privacy.lastSeenVisibility}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      privacy: {
                        ...prev.privacy,
                        lastSeenVisibility: e.target.value as
                          | 'everyone'
                          | 'contacts'
                          | 'nobody',
                      },
                    }))
                  }
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My contacts</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Profile photo visibility
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Control who can view your avatar
                  </p>
                </div>
                <select
                  aria-label="Profile photo visibility"
                  value={settings.privacy.profilePhotoVisibility}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      privacy: {
                        ...prev.privacy,
                        profilePhotoVisibility: e.target.value as
                          | 'everyone'
                          | 'contacts'
                          | 'nobody',
                      },
                    }))
                  }
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My contacts</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>

              <ToggleRow
                label="Read receipts"
                description="Update read status when you open incoming messages"
                checked={settings.privacy.readReceipts}
                onChange={(checked) =>
                  updateSettings((prev) => ({
                    ...prev,
                    privacy: { ...prev.privacy, readReceipts: checked },
                  }))
                }
              />
            </div>
          </section>

          {/* Notification Settings */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <Bell className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Notifications
              </h2>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <ToggleRow
                label="Desktop notifications"
                description="Show alerts for incoming direct and group messages"
                checked={settings.notifications.desktopAlerts}
                onChange={(checked) =>
                  updateSettings((prev) => ({
                    ...prev,
                    notifications: { ...prev.notifications, desktopAlerts: checked },
                  }))
                }
              />
              <ToggleRow
                label="Message sound"
                description="Play a subtle chime when new messages arrive"
                checked={settings.notifications.messageSound}
                onChange={(checked) =>
                  updateSettings((prev) => ({
                    ...prev,
                    notifications: { ...prev.notifications, messageSound: checked },
                  }))
                }
              />
              <ToggleRow
                label="Show message preview"
                description="Include sender text inside notification banners"
                checked={settings.notifications.showMessagePreview}
                onChange={(checked) =>
                  updateSettings((prev) => ({
                    ...prev,
                    notifications: { ...prev.notifications, showMessagePreview: checked },
                  }))
                }
              />
              <ToggleRow
                label="Group mentions only"
                description="Only notify for group chats when you are mentioned"
                checked={settings.notifications.groupMentionsOnly}
                onChange={(checked) =>
                  updateSettings((prev) => ({
                    ...prev,
                    notifications: { ...prev.notifications, groupMentionsOnly: checked },
                  }))
                }
              />
            </div>
          </section>

          {/* Session / Logout */}
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rose-200/80 bg-white p-5 shadow-2xs dark:border-rose-900/50 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  Sign out of ChatSphere
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ends your active ChatSphere session on this device.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => void handleLogout()}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
            >
              <LogOut className="h-3.5 w-3.5" />
              {isLoggingOut ? 'Signing out...' : 'Logout'}
            </button>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
