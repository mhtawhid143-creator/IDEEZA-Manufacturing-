'use client';

import Link from 'next/link';
import { Avatar, DropdownMenu, IconButton, Tooltip } from '@ideeza/ui';
import { signOutAction } from '@/app/auth/actions.js';

export interface NavbarProps {
  readonly displayName: string;
  readonly email: string;
  readonly companyName: string;
  readonly notificationCount?: number;
  readonly onOpenNavigation: () => void;
}

const HelpIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
    <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 9h4M8 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const BellIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
    <path
      d="M10 3a4 4 0 0 0-4 4v3l-1 2h10l-1-2V7a4 4 0 0 0-4-4Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M8 14a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const MenuIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
    <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/**
 * The top bar of the manufacturer frames.
 *
 * It names the shop the member is acting for, because a member can belong to
 * more than one and every screen underneath is scoped to that one — reading a
 * quote list without knowing whose it is would be worse than useless.
 */
export const Navbar = ({
  displayName,
  email,
  companyName,
  notificationCount = 0,
  onOpenNavigation,
}: NavbarProps) => (
  <header className="sticky top-0 z-30 flex h-navbar items-center gap-3 border-b border-line bg-surface px-4 md:px-gutter">
    <IconButton
      label="Open navigation"
      icon={MenuIcon}
      onClick={onOpenNavigation}
      className="lg:hidden"
    />

    <Link href="/dashboard" className="flex items-center gap-2" aria-label="IDEEZA home">
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-on-brand"
        aria-hidden
      >
        ID
      </span>
      <span className="text-base font-bold tracking-wide text-heading">IDEEZA</span>
    </Link>

    <span className="ml-2 hidden truncate text-sm text-muted md:inline">
      Manufacturer ·{' '}
      <span className="font-semibold text-heading">{companyName}</span>
    </span>

    <div className="ml-auto flex items-center gap-1">
      <Tooltip content="Help centre is part of the wider IDEEZA product.">
        <span>
          <IconButton label="Help" icon={HelpIcon} disabled />
        </span>
      </Tooltip>

      <Link href="/notifications" aria-label="Notifications" className="inline-flex">
        <IconButton
          label="Notifications"
          icon={BellIcon}
          badge={notificationCount}
          className="pointer-events-none"
        />
      </Link>

      <DropdownMenu
        label="Account"
        heading={email}
        items={[
          {
            id: 'sign-out',
            label: 'Sign out',
            tone: 'danger',
            onSelect: () => {
              void signOutAction();
            },
          },
        ]}
        trigger={({ ref, onClick, ...aria }) => (
          <button
            ref={ref}
            type="button"
            onClick={onClick}
            className="ml-1 flex items-center gap-2 rounded-full px-1 py-1 text-sm font-medium text-heading hover:bg-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
            {...aria}
          >
            <Avatar name={displayName} size="sm" />
            <span className="hidden max-w-32 truncate sm:inline">{displayName}</span>
            <span aria-hidden className="text-muted">
              ▾
            </span>
          </button>
        )}
      />
    </div>
  </header>
);
