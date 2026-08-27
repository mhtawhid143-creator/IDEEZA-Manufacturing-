import type { Capability } from '@ideeza/domain';

export type NavIcon =
  | 'grid'
  | 'folder'
  | 'parts'
  | 'compass'
  | 'feed'
  | 'message'
  | 'heart'
  | 'blog'
  | 'works'
  | 'factory'
  | 'freelancer'
  | 'bell'
  | 'book'
  | 'map'
  | 'flag';

export interface NavEntry {
  readonly id: string;
  readonly label: string;
  readonly href?: string;
  readonly capability?: Capability;
  /**
   * Present in the Figma rail but not reachable yet: another IDEEZA module, or a
   * screen this plan builds in a later stage. Rendered visibly disabled with the
   * reason, never as a link that goes nowhere.
   */
  readonly unavailableReason?: string;
  readonly children?: readonly NavEntry[];
  readonly icon: NavIcon;
}

const OTHER_MODULE =
  'Part of the wider IDEEZA product, outside this manufacturing platform.';

/*
 * Every destination in the rail now has a screen, so the helper that rendered an
 * unbuilt one as a disabled row with its reason has no work left. The
 * other-module reason above stays: Tutorial, Tour Guide and Help belong to the
 * wider IDEEZA product, not to this platform.
 */

/**
 * The manufacturer navigation, in the order the Figma rail has it.
 *
 * Nothing from the buyer domain appears here at all: no favourites, no drafts,
 * no checkout. The route table for this surface in `@ideeza/auth` does not even
 * carry those paths, so a link to one could not be followed if it were written.
 */
export const PRIMARY_NAV: readonly NavEntry[] = Object.freeze<readonly NavEntry[]>([
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    capability: 'rfq.view',
    icon: 'grid',
  },
  {
    id: 'rfqs',
    label: 'Request Quote',
    href: '/rfqs',
    capability: 'rfq.view',
    icon: 'folder',
  },
  {
    id: 'quotes',
    label: 'Quotes',
    href: '/quotes',
    capability: 'quote.view',
    icon: 'feed',
  },
  {
    id: 'orders',
    label: 'My Orders',
    href: '/orders',
    capability: 'order.view',
    icon: 'works',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    href: '/inventory',
    capability: 'inventory.read',
    icon: 'parts',
  },
  {
    id: 'payouts',
    label: 'Payouts & Earnings',
    href: '/payouts',
    capability: 'payout.withdraw',
    icon: 'compass',
  },
  {
    id: 'messages',
    label: 'Messages',
    href: '/messages',
    capability: 'messaging.participate',
    icon: 'message',
  },
  {
    id: 'profile',
    label: 'Profile',
    href: '/profile',
    capability: 'profile.manage',
    icon: 'factory',
  },
  {
    id: 'blog',
    label: 'Blog',
    href: '/blog',
    capability: 'blog.publish',
    icon: 'blog',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    capability: 'settings.manage',
    icon: 'compass',
  },
]);

export const SECONDARY_NAV: readonly NavEntry[] = Object.freeze<readonly NavEntry[]>([
  { id: 'tutorial', label: 'Tutorial', icon: 'book', unavailableReason: OTHER_MODULE },
  { id: 'tour', label: 'Tour Guide', icon: 'map', unavailableReason: OTHER_MODULE },
  {
    id: 'help',
    label: 'Help and Feedback',
    icon: 'flag',
    unavailableReason: OTHER_MODULE,
  },
]);

export const isNavEntryActive = (entry: NavEntry, pathname: string): boolean => {
  if (entry.href === undefined) {
    return (entry.children ?? []).some((child) => isNavEntryActive(child, pathname));
  }
  if (entry.href === '/') return pathname === '/';
  return pathname === entry.href || pathname.startsWith(`${entry.href}/`);
};

/**
 * The destinations whose screens exist.
 *
 * Derived from the rail rather than kept as a second list, so a screen becomes
 * clickable everywhere at the moment its stage removes the reason from its rail
 * entry — the dashboard tiles and the top bar read this too, which is what stops
 * one of them from linking into a 404 while the rail knows better.
 */
export const BUILT_ROUTES: ReadonlySet<string> = new Set(
  PRIMARY_NAV.flatMap((entry) =>
    entry.href !== undefined && entry.unavailableReason === undefined ? [entry.href] : [],
  ),
);

/** The href when the screen exists, and nothing when it does not. */
export const linkIfBuilt = (href: string): string | undefined =>
  BUILT_ROUTES.has(href) ? href : undefined;
