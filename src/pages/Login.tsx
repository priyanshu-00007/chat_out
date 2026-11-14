import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Lock, Moon, RefreshCw, Sun, UserRound } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { useAuth } from '@/hooks/useAuth';
import { checkBackendHealth } from '@/services/api';

export function Login() {
  const { login, settings, toggleTheme } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
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
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Sign in to ChatSphere</h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Use your username and password to continue.</p>
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

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="login-username" className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Username</label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input id="login-username" type="text" placeholder="alexmorgan" value={username} disabled={isSubmitting} onChange={(e) => { setUsername(e.target.value); if (error) setError(null); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3.5 pl-9 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500" />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input id="login-password" type="password" placeholder="Enter your password" value={password} disabled={isSubmitting} onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3.5 pl-9 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500" />
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                {error}
              </div>
            )}

            <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            New to ChatSphere?{' '}
            <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">Create an account</Link>
          </p>
        </div>
      </main>

      <footer className="text-center text-xs text-slate-400 dark:text-slate-500">ChatSphere · Real-Time Messaging</footer>
    </div>
  );
}
