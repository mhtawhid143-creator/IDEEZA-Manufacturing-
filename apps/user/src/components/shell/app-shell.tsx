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
      {/*
        The first thing the keyboard reaches on every page.

        Without it, getting from the address bar to a quote means pressing Tab
        through the whole rail — and the rail is identical on every screen, so
        the cost is paid again on each one. It is off-screen until focused,
        which is the point: it costs a sighted mouse user nothing.
      */}
      <a
        href="#main"
        className="fixed left-4 top-4 z-notification -translate-y-20 rounded-md border border-border bg-bg-surface px-4 py-2 text-sm font-semibold text-text-link shadow-2 transition-transform duration-fast ease-standard focus-visible:translate-y-0"
      >
        Skip to the page
      </a>
      <Navbar
        displayName={displayName}
        email={email}
        notificationCount={notificationCount ?? 0}
        onOpenNavigation={() => setNavigationOpen(true)}
      />

      <div className="flex">
        <div className="sticky top-navbar hidden h-[calc(100dvh-var(--layout-navbar-height))] lg:block">
          <Sidebar />
        </div>

        {/*
          `tabIndex={-1}` so the skip link moves the focus here rather than
          only scrolling to it — a scroll without focus leaves the next Tab
          back at the top of the rail, which is the failure it exists to
          prevent.
        */}
        <main
          id="main"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 py-4 focus-visible:outline-none md:px-gutter md:py-gutter"
        >
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
