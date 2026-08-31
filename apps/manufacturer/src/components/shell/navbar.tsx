'use client';

import Link from 'next/link';
import { Avatar, DropdownMenu, Icon, IconButton, Tooltip } from '@ideeza/ui';
import { signOutAction } from '@/app/auth/actions.js';

export interface NavbarProps {
  readonly displayName: string;
  readonly email: string;
  readonly companyName: string;
  readonly notificationCount?: number;
  readonly onOpenNavigation: () => void;
}

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
  <header className="sticky top-0 z-sticky flex h-navbar items-center gap-3 border-b border-border-subtle bg-bg-surface px-4 md:px-gutter">
    <IconButton
      label="Open navigation"
      icon={<Icon name="menu" />}
      onClick={onOpenNavigation}
      className="lg:hidden"
    />

    <Link href="/dashboard" className="flex items-center gap-2" aria-label="IDEEZA home">
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-bg-brand text-sm font-bold text-text-on-brand"
        aria-hidden
      >
        ID
      </span>
      <span className="text-base font-bold tracking-caps text-text-primary">IDEEZA</span>
    </Link>

    <span className="ml-2 hidden truncate text-sm text-text-tertiary md:inline">
      Manufacturer ·{' '}
      <span className="font-semibold text-text-primary">{companyName}</span>
    </span>

    <div className="ml-auto flex items-center gap-1">
      <Tooltip content="Help centre is part of the wider IDEEZA product.">
        <span>
          <IconButton label="Help" icon={<Icon name="help" />} disabled />
        </span>
      </Tooltip>

      <Link href="/notifications" aria-label="Notifications" className="inline-flex">
        <IconButton
          label="Notifications"
          icon={<Icon name="bell" />}
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
            className="ml-1 flex items-center gap-2 rounded-full px-1 py-1 text-sm font-medium text-text-primary hover:bg-bg-surface-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
            {...aria}
          >
            <Avatar name={displayName} size="sm" />
            <span className="hidden max-w-32 truncate sm:inline">{displayName}</span>
            <span aria-hidden className="text-text-tertiary">
              ▾
            </span>
          </button>
        )}
      />
    </div>
  </header>
);
