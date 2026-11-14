import type { ReactNode } from 'react';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#f4f6f9] text-slate-900 dark:bg-[#0b0f17] dark:text-slate-100">
      <Sidebar className="hidden md:flex" />
      <div className="flex min-w-0 flex-1 overflow-hidden">{children}</div>
      <MobileNav />
    </div>
  );
}
