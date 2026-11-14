import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_USER_SETTINGS } from '@/data/constants';
import {
  BackendConnectionError,
  clearAuthTokens,
  getAccessToken,
} from '@/services/api';
import { authService } from '@/services/authService';
import { profileService } from '@/services/profileService';
import { storageService } from '@/services/storageService';
import type {
  PendingRegistration,
  ThemeMode,
  User,
  UserSettings,
} from '@/types';
import { readStorage, writeStorage } from '@/utils/storage';

const SETTINGS_STORAGE_KEY = 'user_settings';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  backendUnavailableError: string | null;
  settings: UserSettings;
  register: (payload: PendingRegistration) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ message: string; reset_token?: string }>;
  resetPassword: (token: string, password: string, confirmPassword: string) => Promise<{ message: string }>;
  updateProfile: (updates: {
    fullName?: string;
    username?: string;
    about?: string;
    avatarFile?: File | null;
    removeAvatar?: boolean;
  }) => Promise<User>;
  updateSettings: (updater: (prev: UserSettings) => UserSettings) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  logout: () => Promise<void>;
  refreshSessionUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [backendUnavailableError, setBackendUnavailableError] = useState<string | null>(
    null
  );
  const [settings, setSettings] = useState<UserSettings>(() =>
    readStorage<UserSettings>(SETTINGS_STORAGE_KEY, DEFAULT_USER_SETTINGS)
  );

  const pendingAvatarRef = useRef<File | undefined>(undefined);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    writeStorage(SETTINGS_STORAGE_KEY, settings);
  }, [settings]);

  const refreshSessionUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      setBackendUnavailableError(null);
    } catch (err) {
      if (err instanceof BackendConnectionError) {
        setBackendUnavailableError(err.message);
      } else {
        clearAuthTokens();
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await refreshSessionUser();
      } finally {
        if (mounted) setIsInitializing(false);
      }
    }

    void init();
    return () => {
      mounted = false;
    };
  }, [refreshSessionUser]);

  const register = useCallback(async (payload: PendingRegistration) => {
    setBackendUnavailableError(null);
    pendingAvatarRef.current = payload.avatarFile;
    try {
      const authResult = await authService.register(payload);
      let authenticatedUser = authResult.user;

      if (pendingAvatarRef.current) {
        try {
          const uploaded = await storageService.uploadAvatar(pendingAvatarRef.current);
          authenticatedUser = { ...authenticatedUser, avatarUrl: uploaded.avatar_url };
        } finally {
          pendingAvatarRef.current = undefined;
        }
      }

      setUser(authenticatedUser);
    } catch (err) {
      pendingAvatarRef.current = undefined;
      throw err;
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setBackendUnavailableError(null);
    const authResult = await authService.login(username, password);
    setUser(authResult.user);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    setBackendUnavailableError(null);
    return authService.forgotPassword(email);
  }, []);

  const resetPassword = useCallback(
    async (token: string, password: string, confirmPassword: string) => {
      setBackendUnavailableError(null);
      return authService.resetPassword(token, password, confirmPassword);
    },
    []
  );

  const updateProfile = useCallback(
    async (updates: {
      fullName?: string;
      username?: string;
      about?: string;
      avatarFile?: File | null;
      removeAvatar?: boolean;
    }) => {
      if (!user) throw new Error('You must be signed in to update your profile.');
      const updated = await profileService.updateProfile(updates);
      setUser(updated);
      return updated;
    },
    [user]
  );

  const updateSettings = useCallback((updater: (prev: UserSettings) => UserSettings) => {
    setSettings((prev) => updater(prev));
  }, []);

  const setTheme = useCallback((theme: ThemeMode) => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  const toggleTheme = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      pendingAvatarRef.current = undefined;
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isInitializing,
      backendUnavailableError,
      settings,
      register,
      login,
      forgotPassword,
      resetPassword,
      updateProfile,
      updateSettings,
      setTheme,
      toggleTheme,
      logout,
      refreshSessionUser,
    }),
    [
      user,
      isInitializing,
      backendUnavailableError,
      settings,
      register,
      login,
      forgotPassword,
      resetPassword,
      updateProfile,
      updateSettings,
      setTheme,
      toggleTheme,
      logout,
      refreshSessionUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
