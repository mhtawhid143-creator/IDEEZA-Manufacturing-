'use client';

import Link from 'next/link';
import { Avatar, DropdownMenu, IconButton, Tooltip, cn } from '@ideeza/ui';
import { signOutAction } from '@/app/auth/actions.js';

export interface NavbarProps {
  readonly displayName: string;
  readonly email: string;
  readonly notificationCount?: number;
  readonly onOpenNavigation: () => void;
}

const HelpIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
    <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M8 8a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.6M10 14h.01"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const CartIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
    <path
      d="M3 4h2l1.6 8.2A2 2 0 0 0 8.6 14h6.2a2 2 0 0 0 2-1.6L18 7H6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="9" cy="17" r="1" fill="currentColor" />
    <circle cx="15" cy="17" r="1" fill="currentColor" />
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
 * The 68px top bar from the Figma frames.
 *
 * Two elements are deliberately inert rather than removed: the token balance,
 * which no part of this platform writes, and the cart, whose meaning in a
 * manufacturing flow is still an open product decision. Both say so on hover
 * instead of pretending to work.
 */
export const Navbar = ({
  displayName,
  email,
  notificationCount = 0,
  onOpenNavigation,
}: NavbarProps) => (
  <header className="sticky top-0 z-30 flex h-navbar items-center gap-3 border-b border-border-subtle bg-bg-surface px-4 md:px-gutter">
    <IconButton
      label="Open navigation"
      icon={MenuIcon}
      onClick={onOpenNavigation}
      className="lg:hidden"
    />

    <Link href="/manufacturing" className="flex items-center gap-2" aria-label="IDEEZA home">
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-bg-brand text-sm font-bold text-text-on-brand"
        aria-hidden
      >
        ID
      </span>
      <span className="text-base font-bold tracking-wide text-text-primary">IDEEZA</span>
    </Link>

    <div className="ml-2 hidden items-center gap-3 md:flex">
      <Tooltip content="Token rewards are part of the wider IDEEZA product and are not wired up here.">
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-full border border-border-brand/30 bg-bg-brand-subtle px-3 py-1.5',
            'text-xs font-semibold text-text-brand',
          )}
        >
          <span className="inline-block h-4 w-4 rounded-full bg-bg-brand/20" aria-hidden />
          Earn IDZ Tokens
        </span>
      </Tooltip>
      <span className="text-xs text-text-tertiary">
        Tokens: <span className="font-semibold text-text-brand">—</span>
      </span>
    </div>

    <div className="ml-auto flex items-center gap-1">
      <Tooltip content="Help centre is not part of this task.">
        <span>
          <IconButton label="Help" icon={HelpIcon} disabled />
        </span>
      </Tooltip>
      <Tooltip content="The manufacturing cart is waiting on a product decision, so it is inert.">
        <span>
          <IconButton label="Manufacturing cart" icon={CartIcon} disabled />
        </span>
      </Tooltip>
      <Link href="/notifications" aria-label="Notifications" className="inline-flex">
        <IconButton
          label="Notifications"
          icon={BellIcon}
          badge={notificationCount}
          // The link owns the navigation; the button is the visual affordance.
          tabIndex={-1}
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
