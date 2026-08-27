import type { Capability } from '@ideeza/domain';

export interface NavEntry {
  readonly id: string;
  readonly label: string;
  readonly href?: string;
  readonly capability?: Capability;
  /**
   * Present in the Figma shell but not part of this platform, or waiting on a
   * decision. Rendered visibly disabled with the reason, never as a live link.
   */
  readonly unavailableReason?: string;
  readonly children?: readonly NavEntry[];
  readonly icon: NavIcon;
}

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

const OTHER_MODULE = 'Part of the wider IDEEZA product, outside this manufacturing platform.';

/**
 * The buyer navigation.
 *
 * The structure and order follow the Figma sidebar so the shell is recognisable.
 * Entries that belong to other IDEEZA modules are kept in place but disabled and
 * labelled, because a link that goes nowhere reads as a broken feature, and
 * hiding them would quietly change the design.
 *
 * Nothing that belongs to the manufacturer or operations domain appears here at
 * all: no inventory, no quote creation, no production updates, no payout
 * release.
 */
export const PRIMARY_NAV: readonly NavEntry[] = Object.freeze<readonly NavEntry[]>([
  { id: 'dashboard', label: 'Dashboard', icon: 'grid', unavailableReason: OTHER_MODULE },
  { id: 'my-project', label: 'My Project', icon: 'folder', unavailableReason: OTHER_MODULE },
  { id: 'parts', label: 'Parts & Agile Module', icon: 'parts', unavailableReason: OTHER_MODULE },
  { id: 'marketplace', label: 'Explore Marketplace', icon: 'compass', unavailableReason: OTHER_MODULE },
  { id: 'newsfeed', label: 'Newsfeed', icon: 'feed', unavailableReason: OTHER_MODULE },
  {
    id: 'favorites',
    label: 'Favorites',
    href: '/favorites',
    capability: 'product.favorite',
    icon: 'heart',
  },
  {
    id: 'messages',
    label: 'Messages',
    href: '/messages',
    capability: 'messaging.participate',
    icon: 'message',
  },
  { id: 'blog', label: 'Blog', icon: 'blog', unavailableReason: OTHER_MODULE },
  {
    id: 'manage-works',
    label: 'Manage Works',
    icon: 'works',
    children: Object.freeze<readonly NavEntry[]>([
      {
        id: 'manufacturing',
        label: 'Manufacturing',
        href: '/manufacturing',
        capability: 'order.view',
        icon: 'factory',
      },
      {
        id: 'freelancers',
        label: 'Freelancers',
        icon: 'freelancer',
        unavailableReason: OTHER_MODULE,
      },
    ]),
  },
]);

export const SECONDARY_NAV: readonly NavEntry[] = Object.freeze<readonly NavEntry[]>([
  { id: 'tutorial', label: 'Tutorial', icon: 'book', unavailableReason: OTHER_MODULE },
  { id: 'tour', label: 'Tour Guide', icon: 'map', unavailableReason: OTHER_MODULE },
  { id: 'report', label: 'Report a Problem', icon: 'flag', unavailableReason: OTHER_MODULE },
]);

export interface ManufacturingTab {
  readonly id: string;
  readonly label: string;
  readonly href: string;
}

/**
 * The manufacturing hub tabs.
 *
 * The Figma hub has Draft, Active Order and Order History. "Quote Requests" is
 * added because the approved model needs a place to watch a request that has
 * been sent and is collecting quotes: that state exists between a draft and an
 * order, and the design has no home for it.
 *
 * Each tab is its own route rather than a query string on the hub. A tab is a
 * different list, guarded by its own capability, and it has to stay
 * bookmarkable and reachable straight from a link in a message or a
 * notification.
 */
export const MANUFACTURING_TABS: readonly ManufacturingTab[] = Object.freeze<readonly ManufacturingTab[]>([
  { id: 'draft', label: 'Draft', href: '/manufacturing' },
  { id: 'requests', label: 'Quote Requests', href: '/manufacturing/rfq' },
  { id: 'active', label: 'Active Orders', href: '/manufacturing/orders' },
  { id: 'history', label: 'Order History', href: '/manufacturing/history' },
]);

export const isNavEntryActive = (entry: NavEntry, pathname: string): boolean => {
  if (entry.href === undefined) {
    return (entry.children ?? []).some((child) => isNavEntryActive(child, pathname));
  }
  if (entry.href === '/') return pathname === '/';
  return pathname === entry.href || pathname.startsWith(`${entry.href}/`);
};
