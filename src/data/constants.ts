import type { UserSettings } from '@/types';

export const DEFAULT_USER_SETTINGS: UserSettings = {
  theme: 'light',
  notifications: {
    desktopAlerts: true,
    messageSound: true,
    showMessagePreview: true,
    groupMentionsOnly: false,
  },
  privacy: {
    lastSeenVisibility: 'everyone',
    profilePhotoVisibility: 'everyone',
    readReceipts: true,
  },
};
