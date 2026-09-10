'use client';

import { Suspense, useState, type ReactNode } from 'react';
import { Drawer } from '@ideeza/ui';
import { Navbar } from './navbar.js';
import { ReportProblemDialog } from './report-problem-dialog.js';
import { Sidebar } from './sidebar.js';
import { TourRunner } from '../tour/tour-runner.js';

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
  // Owned here rather than in the rail, and for a specific reason: the desktop
  // rail sits inside a `sticky` wrapper, which is a stacking context, so a
  // dialog rendered inside it cannot rise above the page however high its
  // z-index goes. At the shell's root it is in the same context as the content
  // it covers. Both rails open this one.
  const [reporting, setReporting] = useState(false);
  const openFromRail = (what: 'report-problem') => {
    if (what === 'report-problem') setReporting(true);
  };

  return (
      <div className="min-h-dvh bg-bg-page">
        {/*
          The first thing the keyboard reaches on every page.

          Without it, getting from the address bar to an order takes thirteen
          presses through the rail — and the rail is identical on every screen,
          so the cost is paid again on each one. It is off-screen until it is
          focused, which is the point: it costs a sighted mouse user nothing and
          saves everybody else the whole of the navigation.
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
          companyName={companyName}
          notificationCount={notificationCount ?? 0}
          onOpenNavigation={() => setNavigationOpen(true)}
        />

        <div className="flex">
          <div className="sticky top-navbar hidden h-[calc(100dvh-var(--layout-navbar-height))] lg:block">
            <Sidebar
              onOpen={openFromRail}
              {...(profileCompleteness === undefined ? {} : { profileCompleteness })}
            />
          </div>

          {/*
            `tabIndex={-1}` so the skip link actually moves the focus here
            rather than only scrolling to it — a scroll without focus leaves
            the next Tab back at the top of the rail, which is the failure the
            link exists to prevent.
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
            onOpen={(what) => {
              setNavigationOpen(false);
              openFromRail(what);
            }}
            {...(profileCompleteness === undefined ? {} : { profileCompleteness })}
          />
        </Drawer>

        <ReportProblemDialog open={reporting} onClose={() => setReporting(false)} />

        {/* The tour runs over whatever screen it has walked to, so it is mounted
            here for the same reason the dialog above is: the rail is a sticky
            stacking context, and nothing rendered inside it can rise over the
            page. It reads its place from the query string, which is why it needs
            a Suspense boundary of its own — without one, every page in this
            shell would have to be dynamic to satisfy `useSearchParams`. */}
        <Suspense fallback={null}>
          <TourRunner />
        </Suspense>
      </div>
  );
};
