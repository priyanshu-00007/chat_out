import type { PresenceStatus } from '@/types';
import { getInitials } from '@/utils/formatters';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: PresenceStatus;
  showStatus?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-7 w-7 text-[11px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
};

const DOT_SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-2 w-2 border',
  sm: 'h-2.5 w-2.5 border-2',
  md: 'h-3 w-3 border-2',
  lg: 'h-3.5 w-3.5 border-2',
  xl: 'h-4 w-4 border-2',
};

const STATUS_COLORS: Record<PresenceStatus, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-500',
  offline: 'bg-slate-400 dark:bg-slate-500',
};

export function Avatar({
  src,
  name,
  size = 'md',
  status,
  showStatus = false,
  className = '',
}: AvatarProps) {
  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${SIZE_CLASSES[size]} rounded-full object-cover ring-1 ring-slate-200/80 dark:ring-slate-700/80`}
        />
      ) : (
        <div
          aria-label={name}
          className={`${SIZE_CLASSES[size]} flex items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700 ring-1 ring-indigo-200/70 dark:bg-indigo-950/70 dark:text-indigo-300 dark:ring-indigo-800/60`}
        >
          {getInitials(name)}
        </div>
      )}

      {showStatus && status && (
        <span
          title={status}
          className={`absolute right-0 bottom-0 block rounded-full border-white dark:border-slate-900 ${DOT_SIZE_CLASSES[size]} ${STATUS_COLORS[status]}`}
        />
      )}
    </div>
  );
}
