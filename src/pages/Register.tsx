import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Moon, RefreshCw, Sun } from 'lucide-react';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { Logo } from '@/components/common/Logo';
import { useAuth } from '@/hooks/useAuth';
import { checkBackendHealth } from '@/services/api';
import type { PendingRegistration } from '@/types';

export function Register() {
  const { register, settings, toggleTheme } = useAuth();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [checkingBackend, setCheckingBackend] = useState(false);

  const probeBackend = useCallback(async () => {
    setCheckingBackend(true);
    try {
      const status = await checkBackendHealth();
      setBackendError(status.ok ? null : status.error ?? 'Backend server is unreachable.');
    } finally {
      setCheckingBackend(false);
    }
  }, []);

  useEffect(() => {
    void probeBackend();
  }, [probeBackend]);

  const handleRegisterSubmit = async (payload: PendingRegistration) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await register(payload);
      setBackendError(null);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create your account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col justify-between bg-[#f4f6f9] px-4 py-8 dark:bg-[#0b0f17]">
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <Logo />
        <button type="button" onClick={toggleTheme} aria-label="Toggle theme" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-2xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
          {settings.theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <main className="mx-auto my-8 w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Create your account</h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Set up your ChatSphere profile with a username, password, and optional email.</p>
          </div>

          {backendError && (
            <div role="alert" className="mb-5 flex items-start justify-between gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{backendError}</span>
              </div>
              <button type="button" disabled={checkingBackend} onClick={() => void probeBackend()} aria-label="Retry backend connection" className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 font-semibold hover:bg-amber-100 disabled:opacity-60 dark:hover:bg-amber-900/50">
                <RefreshCw className={`h-3 w-3 ${checkingBackend ? 'animate-spin' : ''}`} />
                Retry
              </button>
            </div>
          )}

          <RegisterForm isSubmitting={isSubmitting} error={error} onSubmit={handleRegisterSubmit} />

          <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">Sign in</Link>
          </p>
        </div>
      </main>

      <footer className="text-center text-xs text-slate-400 dark:text-slate-500">ChatSphere · Real-Time Messaging</footer>
    </div>
  );
}
