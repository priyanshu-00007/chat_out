interface LogoProps {
  compact?: boolean;
  className?: string;
}

export function Logo({ compact = false, className = '' }: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 3C7.029 3 3 6.582 3 11C3 13.066 3.88 14.948 5.324 16.364L4.4 20.1L8.352 18.426C9.49 18.8 10.72 19 12 19C16.971 19 21 15.418 21 11C21 6.582 16.971 3 12 3Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="11" r="1.25" fill="currentColor" />
          <circle cx="12.5" cy="11" r="1.25" fill="currentColor" />
          <circle cx="16" cy="11" r="1.25" fill="currentColor" />
        </svg>
      </div>
      {!compact && (
        <div className="leading-none">
          <span className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white">
            ChatSphere
          </span>
        </div>
      )}
    </div>
  );
}
