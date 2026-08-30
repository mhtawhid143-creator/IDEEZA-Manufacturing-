'use client';

import { useState, type ReactNode } from 'react';
import { Drawer, ToastProvider } from '@ideeza/ui';
import { Navbar } from './navbar.js';
import { Sidebar } from './sidebar.js';

export interface AppShellProps {
  readonly displayName: string;
  readonly email: string;
  readonly notificationCount?: number;
  readonly children: ReactNode;
}

/**
 * Navbar plus rail plus content, as measured from the Figma frames: 68px bar,
 * 232px rail, 32px content gutter.
 *
 * Below the large breakpoint the rail becomes a drawer opened from the bar,
 * because the design has no phone layout for it and a 232px rail leaves nothing
 * for the content.
 */
export const AppShell = ({
  displayName,
  email,
  notificationCount,
  children,
}: AppShellProps) => {
  const [navigationOpen, setNavigationOpen] = useState(false);

  return (
    <ToastProvider>
    <div className="min-h-dvh bg-bg-page">
      <Navbar
        displayName={displayName}
        email={email}
        notificationCount={notificationCount ?? 0}
        onOpenNavigation={() => setNavigationOpen(true)}
      />

      <div className="flex">
        <div className="sticky top-navbar hidden h-[calc(100dvh-var(--ids-navbar-height))] lg:block">
          <Sidebar />
        </div>

        <main className="min-w-0 flex-1 px-4 py-4 md:px-gutter md:py-gutter">
          <div className="mx-auto w-full max-w-content">{children}</div>
        </main>
      </div>

      <Drawer
        open={navigationOpen}
        onClose={() => setNavigationOpen(false)}
        title="Navigation"
        side="left"
        width="sm"
      >
        <Sidebar
          className="w-full border-r-0 px-0 py-0"
          onNavigate={() => setNavigationOpen(false)}
        />
      </Drawer>
    </div>
    </ToastProvider>
  );
};
