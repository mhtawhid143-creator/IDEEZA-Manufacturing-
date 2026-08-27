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

const NavRow = ({ entry }: { readonly entry: NavEntry }) => {
  const pathname = usePathname();
  const active = isNavEntryActive(entry, pathname);

  if (entry.unavailableReason !== undefined) {
    return (
      <li>
        <Tooltip content={entry.unavailableReason} side="bottom">
          <span aria-disabled="true" className={rowClasses(false, true)}>
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

  return (
    <li>
      <Link
        href={entry.href ?? '/dashboard'}
        aria-current={active ? 'page' : undefined}
        className={rowClasses(active, false)}
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
  /** How complete the shop's profile is, which is what gates being quoted. */
  readonly profileCompleteness?: number;
}

/**
 * The 232px rail from the Figma frames.
 *
 * The promo block the buyer rail carries is replaced by the one thing a shop
 * actually needs prompting about: an incomplete profile, because capabilities are
 * what decide whether a buyer's request ever reaches this inbox.
 */
export const Sidebar = ({ onNavigate, className, profileCompleteness }: SidebarProps) => (
  <nav
    aria-label="Main"
    className={cn(
      'flex h-full w-sidebar shrink-0 flex-col gap-4 border-r border-line bg-surface px-3 py-4',
      className,
    )}
    onClick={onNavigate}
  >
    <ul className="flex flex-col gap-1">
      {PRIMARY_NAV.map((entry) => (
        <NavRow key={entry.id} entry={entry} />
      ))}
    </ul>

    <div className="mt-auto flex flex-col gap-4">
      {profileCompleteness !== undefined && profileCompleteness < 100 && (
        <div className="rounded-xl border border-line bg-canvas p-4">
          <p className="text-sm font-semibold text-heading">Finish your profile</p>
          <Text tone="muted" size="xs" className="mt-1">
            Buyers only see shops whose capabilities cover what they are asking for.
          </Text>
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line"
            role="img"
            aria-label={`Profile ${profileCompleteness}% complete`}
          >
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${profileCompleteness}%` }}
            />
          </div>
          <Link
            href="/profile"
            className="mt-3 inline-flex text-xs font-semibold text-brand underline hover:no-underline"
          >
            {profileCompleteness}% complete — continue
          </Link>
        </div>
      )}

      <div>
        <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted">
          For you
        </p>
        <ul className="mt-1 flex flex-col gap-1">
          {SECONDARY_NAV.map((entry) => (
            <NavRow key={entry.id} entry={entry} />
          ))}
        </ul>
      </div>
    </div>
  </nav>
);
