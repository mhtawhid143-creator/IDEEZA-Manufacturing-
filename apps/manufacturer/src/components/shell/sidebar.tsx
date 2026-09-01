'use client';

import { useState } from 'react';
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
import { ReportProblemDialog } from './report-problem-dialog.js';

const rowClasses = (active: boolean, disabled: boolean): string =>
  cn(
    'relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
    // The mark that says "here": a bar on the edge the rail is anchored to,
    // which nothing else in the list carries.
    active &&
      'before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-bg-brand',
    disabled
      ? 'cursor-not-allowed text-text-tertiary'
      : active
        ? 'bg-bg-brand-subtle font-medium text-text-brand'
        : 'text-text-secondary hover:bg-bg-surface-raised hover:text-text-primary',
  );

const NavRow = ({
  entry,
  onOpen,
}: {
  readonly entry: NavEntry;
  readonly onOpen?: (what: NonNullable<NavEntry['opens']>) => void;
}) => {
  const pathname = usePathname();
  const active = isNavEntryActive(entry, pathname);

  // Not a link: it raises a dialog over the screen the reporter is on, and a
  // link that goes nowhere would take the back button with it.
  if (entry.opens !== undefined) {
    return (
      <li>
        <button
          type="button"
          onClick={() => onOpen?.(entry.opens as NonNullable<NavEntry['opens']>)}
          className={rowClasses(false, false)}
        >
          <NavIconGlyph name={entry.icon} />
          <span className="truncate">{entry.label}</span>
        </button>
      </li>
    );
  }

  if (entry.unavailableReason !== undefined) {
    return (
      <li>
        <Tooltip content={entry.unavailableReason} side="bottom">
          <span aria-disabled="true" className={rowClasses(false, true)}>
            <NavIconGlyph name={entry.icon} />
            <span className="truncate">{entry.label}</span>
            <span className="ml-auto text-2xs uppercase tracking-caps text-text-tertiary">
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
export const Sidebar = ({ onNavigate, className, profileCompleteness }: SidebarProps) => {
  const [reporting, setReporting] = useState(false);

  return (
    <>
  <nav
    aria-label="Main"
    className={cn(
      'flex h-full w-sidebar shrink-0 flex-col gap-4 border-r border-border-subtle bg-bg-surface px-3 py-4',
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
        <div className="rounded-xl border border-border-subtle bg-bg-page p-4">
          <p className="text-sm font-semibold text-text-primary">Finish your profile</p>
          <Text tone="muted" size="xs" className="mt-1">
            Buyers only see shops whose capabilities cover what they are asking for.
          </Text>
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle"
            role="img"
            aria-label={`Profile ${profileCompleteness}% complete`}
          >
            <div
              className="h-full rounded-full bg-bg-brand"
              style={{ width: `${profileCompleteness}%` }}
            />
          </div>
          <Link
            href="/profile"
            className="mt-3 inline-flex text-xs font-semibold text-text-brand underline hover:no-underline"
          >
            {profileCompleteness}% complete — continue
          </Link>
        </div>
      )}

      <div>
        <p className="px-3 text-xs font-semibold uppercase tracking-caps text-text-tertiary">
          For you
        </p>
        <ul className="mt-1 flex flex-col gap-1">
          {SECONDARY_NAV.map((entry) => (
            <NavRow
              key={entry.id}
              entry={entry}
              onOpen={(what) => {
                if (what === 'report-problem') setReporting(true);
              }}
            />
          ))}
        </ul>
      </div>
    </div>
  </nav>
      <ReportProblemDialog open={reporting} onClose={() => setReporting(false)} />
    </>
  );
};
