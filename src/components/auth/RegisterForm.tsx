import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowRight, AtSign, Camera, Mail, ShieldCheck, Trash2, User as UserIcon } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { validateAvatarFile } from '@/services/storageService';
import type { PendingRegistration } from '@/types';
import { validateUsername } from '@/utils/formatters';

interface RegisterFormProps {
  isSubmitting: boolean;
  disabled?: boolean;
  error: string | null;
  onSubmit: (payload: PendingRegistration) => Promise<void>;
}

export function RegisterForm({
  isSubmitting,
  disabled = false,
  error,
  onSubmit,
}: RegisterFormProps) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | undefined>(undefined);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(undefined);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileError = validateAvatarFile(file);
    if (fileError) {
      setValidationError(fileError);
      return;
    }

    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setValidationError(null);
  };

  const handleRemoveAvatar = () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarFile(undefined);
    setAvatarPreview(undefined);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().length < 2) {
      setValidationError('Full name must be at least 2 characters.');
      return;
    }

    const usernameErr = validateUsername(username);
    if (usernameErr) {
      setValidationError(usernameErr);
      return;
    }

    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters long.');
      return;
    }

    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setValidationError('Password must include upper/lowercase letters, a number, and a special character.');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    if (email.trim() && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email.trim())) {
      setValidationError('Please provide a valid email address.');
      return;
    }

    setValidationError(null);
    await onSubmit({
      fullName: fullName.trim(),
      username: username.trim().replace(/^@/, ''),
      email: email.trim() || undefined,
      password,
      confirmPassword,
      avatarFile,
    });
  };

  const displayError = validationError || error;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
        <Avatar src={avatarPreview} name={fullName || 'New User'} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Profile photo</p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Optional. JPG, PNG, WebP, or GIF up to 4 MB.</p>
          <div className="mt-2 flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarChange} disabled={disabled || isSubmitting} className="hidden" />
            <button type="button" disabled={disabled || isSubmitting} onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <Camera className="h-3.5 w-3.5" />
              {avatarPreview ? 'Replace' : 'Upload photo'}
            </button>
            {avatarPreview && (
              <button type="button" onClick={handleRemoveAvatar} aria-label="Remove profile photo" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40">
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="reg-fullname" className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Full name</label>
        <div className="relative">
          <UserIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input id="reg-fullname" type="text" placeholder="Alex Morgan" value={fullName} disabled={disabled || isSubmitting} onChange={(e) => { setFullName(e.target.value); if (validationError) setValidationError(null); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3.5 pl-9 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500" />
        </div>
      </div>

      <div>
        <label htmlFor="reg-username" className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Username</label>
        <div className="relative">
          <AtSign className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input id="reg-username" type="text" placeholder="alexmorgan" value={username} disabled={disabled || isSubmitting} onChange={(e) => { setUsername(e.target.value); if (validationError) setValidationError(null); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3.5 pl-9 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500" />
        </div>
      </div>

      <div>
        <label htmlFor="reg-email" className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Email address (optional)</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input id="reg-email" type="email" placeholder="alex@example.com" value={email} disabled={disabled || isSubmitting} onChange={(e) => { setEmail(e.target.value); if (validationError) setValidationError(null); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3.5 pl-9 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500" />
        </div>
      </div>

      <div>
        <label htmlFor="reg-password" className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Password</label>
        <div className="relative">
          <ShieldCheck className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input id="reg-password" type="password" placeholder="Create a secure password" value={password} disabled={disabled || isSubmitting} onChange={(e) => { setPassword(e.target.value); if (validationError) setValidationError(null); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3.5 pl-9 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500" />
        </div>
      </div>

      <div>
        <label htmlFor="reg-confirm-password" className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Confirm password</label>
        <div className="relative">
          <ShieldCheck className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input id="reg-confirm-password" type="password" placeholder="Repeat the password" value={confirmPassword} disabled={disabled || isSubmitting} onChange={(e) => { setConfirmPassword(e.target.value); if (validationError) setValidationError(null); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3.5 pl-9 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500" />
        </div>
      </div>

      {displayError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          {displayError}
        </div>
      )}

      <button type="submit" disabled={disabled || isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
        <span>{isSubmitting ? 'Creating account...' : 'Create account'}</span>
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
