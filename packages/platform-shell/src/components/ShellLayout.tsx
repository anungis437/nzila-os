'use client';

import { type ReactNode } from 'react';
import { useShell } from '../context/provider.js';
import { GlobalNav } from './GlobalNav.js';

export interface ShellLayoutProps {
  children: ReactNode;
  /** Slot for a module-specific sidebar. */
  moduleSidebar?: ReactNode;
  /** Hide the global nav (e.g. for auth pages). */
  hideNav?: boolean;
}

export function ShellLayout({ children, moduleSidebar, hideNav }: ShellLayoutProps) {
  const { user } = useShell();

  if (hideNav || !user) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <GlobalNav />
      {moduleSidebar && (
        <aside className="hidden w-64 border-r border-gray-200 bg-white lg:block">
          {moduleSidebar}
        </aside>
      )}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
