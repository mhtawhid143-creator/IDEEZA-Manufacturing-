'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Text, Tooltip, cn } from '@ideeza/ui';
import {
  PRIMARY_NAV,
  SECONDARY_NAV,
  isNavEntryActive,
  type NavEntry,
} from '@/lib/navigation.js';
import { NavIconGlyph } from './nav-icon.js';

const rowClasses = (active: boolean, disabled: boolean): string =>
  cn(
    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
    disabled
      ? 'cursor-not-allowed text-muted'
      : active
        ? 'bg-brand-weak font-semibold text-brand'
        : 'text-body hover:bg-raised',
  );

const NavRow = ({ entry, depth = 0 }: { readonly entry: NavEntry; readonly depth?: number }) => {
  const pathname = usePathname();
  const active = isNavEntryActive(entry, pathname);

  if (entry.unavailableReason !== undefined) {
    return (
      <li>
        <Tooltip content={entry.unavailableReason} side="bottom">
          <span
            aria-disabled="true"
            className={cn(rowClasses(false, true), depth > 0 && 'pl-9')}
          >
            <NavIconGlyph name={entry.icon} />
            <span className="truncate">{entry.label}</span>
            <span className="ml-auto text-[10px] uppercase tracking-wide text-muted">
              n/a
            </span>
          </span>
        </Tooltip>
      </li>
    );
  }

  if (entry.href === undefined) {
    return (
      <li>
        <p className={cn(rowClasses(active, false), 'cursor-default hover:bg-transparent')}>
          <NavIconGlyph name={entry.icon} />
          <span className="truncate">{entry.label}</span>
        </p>
        {entry.children !== undefined && (
          <ul className="mt-1 flex flex-col gap-1">
            {entry.children.map((child) => (
              <NavRow key={child.id} entry={child} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={entry.href}
        aria-current={active ? 'page' : undefined}
        className={cn(rowClasses(active, false), depth > 0 && 'pl-9')}
      >
        <NavIconGlyph name={entry.icon} />
        <span className="truncate">{entry.label}</span>
      </Link>
    </li>
  );
};

export interface SidebarProps {
  readonly onNavigate?: () => void;
  readonly className?: string;
}

/**
 * The 232px rail from the Figma frames: primary navigation, then the promo
 * block, then the help group.
 */
export const Sidebar = ({ onNavigate, className }: SidebarProps) => (
  <nav
    aria-label="Main"
    className={cn(
      'flex h-full w-sidebar shrink-0 flex-col gap-4 border-r border-line bg-surface px-3 py-4',
      className,
    )}
    onClick={onNavigate}
  >
    <Link
      href="/manufacturing"
      className="mx-1 flex items-center justify-between gap-2 rounded-lg border border-brand/40 px-3 py-2.5 text-sm font-semibold text-brand hover:bg-brand-weak"
    >
      Quick Start
      <span aria-hidden>›</span>
    </Link>

    <ul className="flex flex-col gap-1">
      {PRIMARY_NAV.map((entry) => (
        <NavRow key={entry.id} entry={entry} />
      ))}
    </ul>

    <div className="mt-auto flex flex-col gap-4">
      <div className="rounded-xl border border-line bg-canvas p-4">
        <p className="text-sm font-semibold text-heading">Unlock all features</p>
        <Text tone="muted" size="xs" className="mt-1">
          Plan upgrades are part of the wider IDEEZA product and are not wired up
          in this platform yet.
        </Text>
        <button
          type="button"
          disabled
          className="mt-3 w-full cursor-not-allowed rounded-md bg-disabled-bg px-3 py-2 text-sm font-semibold text-disabled-text"
        >
          Upgrade Plus
        </button>
      </div>

      <div>
        <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted">For you</p>
        <ul className="mt-1 flex flex-col gap-1">
          {SECONDARY_NAV.map((entry) => (
            <NavRow key={entry.id} entry={entry} />
          ))}
        </ul>
      </div>
    </div>
  </nav>
);
