'use client';

import Link from 'next/link';
import { Avatar, cn, DropdownMenu, Icon, IconButton, Tooltip } from '@ideeza/ui';
import { signOutAction } from '@/app/auth/actions.js';

export interface NavbarProps {
  readonly displayName: string;
  readonly email: string;
  readonly notificationCount?: number;
  readonly onOpenNavigation: () => void;
}

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
  <header className="sticky top-0 z-sticky flex h-navbar items-center gap-3 border-b border-border-subtle bg-bg-surface px-4 md:px-gutter">
    <IconButton
      label="Open navigation"
      icon={<Icon name="menu" />}
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
      <span className="text-base font-bold tracking-caps text-text-primary">IDEEZA</span>
    </Link>

    <div className="ml-2 hidden items-center gap-3 md:flex">
      <Tooltip content="Token rewards are part of the wider IDEEZA product and are not wired up here.">
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-full border border-border-brand bg-bg-brand-subtle px-3 py-1.5',
            'text-xs font-semibold text-text-brand',
          )}
        >
          <span className="inline-block h-4 w-4 rounded-full bg-bg-brand" aria-hidden />
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
          <IconButton label="Help" icon={<Icon name="help" />} disabled />
        </span>
      </Tooltip>
      <Tooltip content="The manufacturing cart is waiting on a product decision, so it is inert.">
        <span>
          <IconButton label="Manufacturing cart" icon={<Icon name="cart" />} disabled />
        </span>
      </Tooltip>
      <Link href="/notifications" aria-label="Notifications" className="inline-flex">
        <IconButton
          label="Notifications"
          icon={<Icon name="bell" />}
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
