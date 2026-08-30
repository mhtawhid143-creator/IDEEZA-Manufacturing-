'use client';

import { useState, type ReactNode } from 'react';
import { Drawer } from '@ideeza/ui';
import { Navbar } from './navbar.js';
import { Sidebar } from './sidebar.js';

export interface AppShellProps {
  readonly displayName: string;
  readonly email: string;
  readonly companyName: string;
  readonly notificationCount?: number;
  readonly profileCompleteness?: number;
  readonly children: ReactNode;
}

/**
 * Navbar plus rail plus content, at the measurements the Figma frames use: 68px
 * bar, 232px rail, 32px content gutter — the same shell as the buyer app,
 * because it is the same product.
 *
 * Below the large breakpoint the rail becomes a drawer opened from the bar.
 */
export const AppShell = ({
  displayName,
  email,
  companyName,
  notificationCount,
  profileCompleteness,
  children,
}: AppShellProps) => {
  const [navigationOpen, setNavigationOpen] = useState(false);

  return (
      <div className="min-h-dvh bg-bg-page">
        <Navbar
          displayName={displayName}
          email={email}
          companyName={companyName}
          notificationCount={notificationCount ?? 0}
          onOpenNavigation={() => setNavigationOpen(true)}
        />

        <div className="flex">
          <div className="sticky top-navbar hidden h-[calc(100dvh-var(--layout-navbar-height))] lg:block">
            <Sidebar {...(profileCompleteness === undefined ? {} : { profileCompleteness })} />
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
            {...(profileCompleteness === undefined ? {} : { profileCompleteness })}
          />
        </Drawer>
      </div>
  );
};
