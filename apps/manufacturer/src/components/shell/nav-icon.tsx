import { Icon, type IconName } from '@ideeza/ui';
import type { NavIcon } from '@/lib/navigation.js';

/**
 * The rail's glyphs.
 *
 * The names on the left are the rail's own — what the destination is — and the
 * names on the right are the icon set's. Keeping the two apart means a glyph
 * can be swapped for a better one without every navigation entry knowing.
 */
const GLYPH: Record<NavIcon, IconName> = {
  grid: 'grid',
  folder: 'folder',
  parts: 'parts',
  compass: 'compass',
  feed: 'feed',
  message: 'message',
  heart: 'heart',
  blog: 'blog',
  works: 'cart',
  factory: 'factory',
  freelancer: 'people',
  bell: 'bell',
  book: 'book',
  map: 'map',
  flag: 'flag',
  invoice: 'invoice',
  orders: 'orders',
  payouts: 'payouts',
  settings: 'settings',
  shop: 'shop',
  stock: 'stock',
};

export const NavIconGlyph = ({ name }: { readonly name: NavIcon }) => (
  <Icon name={GLYPH[name]} size={20} />
);
