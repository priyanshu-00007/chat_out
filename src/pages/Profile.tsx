import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AtSign, Camera, CheckCircle2, Edit3, Mail, Save, Trash2, X } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { validateAvatarFile } from '@/services/storageService';
import { validateUsername } from '@/utils/formatters';

export function Profile() {
  const { user, updateProfile } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [about, setAbout] = useState(user?.about ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(user?.avatarUrl);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  if (!user) return null;

  const startEditing = () => {
    setFullName(user.fullName);
    setUsername(user.username);
    setAbout(user.about);
    setAvatarFile(null);
    setAvatarPreview(user.avatarUrl);
    setRemoveAvatar(false);
    setError(null);
    setSavedNotice(false);
    setIsEditing(true);
  };

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationErr = validateAvatarFile(file);
    if (validationErr) {
      setError(validationErr);
      return;
    }

    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setRemoveAvatar(false);
    setError(null);
  };

  const handleRemoveAvatar = () => {
    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarFile(null);
    setAvatarPreview(undefined);
    setRemoveAvatar(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    const usernameErr = validateUsername(username);
    if (usernameErr) {
      setError(usernameErr);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        username: username.trim().replace(/^@/, ''),
        about: about.trim(),
        avatarFile,
        removeAvatar,
      });
      setIsEditing(false);
      setSavedNotice(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto bg-[#f4f6f9] px-4 py-6 pb-20 sm:px-8 md:pb-8 scrollbar-thin dark:bg-[#0b0f17]">
        <div className="mx-auto max-w-2xl space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                Profile
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage your personal details shown across ChatSphere.
              </p>
            </div>
            {!isEditing && (
              <button
                type="button"
                onClick={startEditing}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit Profile
              </button>
            )}
          </div>

          {savedNotice && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Profile updated successfully.
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            {isEditing ? (
              <form onSubmit={handleSave} className="space-y-5">
                <div className="flex items-center gap-4">
                  <Avatar
                    src={avatarPreview}
                    name={fullName || user.fullName}
                    size="xl"
                    status={user.status}
                    showStatus
                  />
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        Change Photo
                      </button>
                      {avatarPreview && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      JPG, PNG, WebP, or GIF up to 4 MB.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="profile-fullname"
                      className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Full name
                    </label>
                    <input
                      id="profile-fullname"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-username"
                      className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Username
                    </label>
                    <div className="relative">
                      <AtSign className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="profile-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3.5 pl-9 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="profile-about"
                    className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    About / Status message
                  </label>
                  <textarea
                    id="profile-about"
                    rows={3}
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                    placeholder="Share what you are working on..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                  >
                    {error}
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <Avatar
                    src={user.avatarUrl}
                    name={user.fullName}
                    size="xl"
                    status={user.status}
                    showStatus
                  />
                  <div>
                    <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                      {user.fullName}
                    </h2>
                    <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                      @{user.username}
                    </p>
                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          user.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                      {user.status}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/70 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="px-4 py-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      About / Status
                    </p>
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                      {user.about || 'No status message set.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Email
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        {user.email || 'No email provided'}
                      </p>
                    </div>
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Optional
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
