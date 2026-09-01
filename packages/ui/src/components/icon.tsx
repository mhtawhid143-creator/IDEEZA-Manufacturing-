import { HugeiconsIcon } from '@hugeicons/react';
import {
  Alert01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  Book02Icon,
  Cancel01Icon,
  Building06Icon,
  Cash01Icon,
  Clock01Icon,
  CheckmarkCircle02Icon,
  ChipIcon,
  Compass01Icon,
  CubeIcon,
  DashboardSquare01Icon,
  Factory01Icon,
  FavouriteIcon,
  File01Icon,
  Flag02Icon,
  Folder01Icon,
  Invoice01Icon,
  Layers01Icon,
  HelpCircleIcon,
  InformationCircleIcon,
  ListViewIcon,
  Menu01Icon,
  Message01Icon,
  MoreVerticalIcon,
  SendHorizontalIcon,
  Settings02Icon,
  WarehouseIcon,
  Navigation03Icon,
  News01Icon,
  Notification01Icon,
  Package02Icon,
  PlayIcon,
  PlusSignIcon,
  Search01Icon,
  ShoppingCart01Icon,
  StarIcon,
  Tick02Icon,
  UserGroupIcon,
  ViewIcon,
} from '@hugeicons/core-free-icons';
import { cn } from '../lib/cn.js';

/**
 * The icons, from one set.
 *
 * They had been drawn by hand, a path at a time, wherever one was needed: a
 * bell in three files, two kinds of star, a heart nobody could match to another
 * heart. Hand-drawn glyphs cannot be kept consistent by intention alone — their
 * weights and their optical sizes drift, because each is a separate act of
 * drawing.
 *
 * These come from Hugeicons, which is the set the design system's own icon
 * package is built from, so both sides draw from one library. Everything a
 * screen needs is named here, once, in this repository's words rather than the
 * library's: `factory` is a factory whichever glyph the library calls it.
 */
export type IconName =
  | 'alert'
  | 'bell'
  | 'blog'
  | 'board'
  | 'book'
  | 'cart'
  | 'check'
  | 'check-circle'
  | 'chevron-down'
  | 'chevron-right'
  | 'clock'
  | 'close'
  | 'compass'
  | 'cube'
  | 'factory'
  | 'feed'
  | 'file'
  | 'flag'
  | 'folder'
  | 'grid'
  | 'heart'
  | 'help'
  | 'info'
  | 'invoice'
  | 'layers'
  | 'list'
  | 'map'
  | 'menu'
  | 'message'
  | 'more'
  | 'parts'
  | 'orders'
  | 'payouts'
  | 'people'
  | 'play'
  | 'plus'
  | 'shop'
  | 'stock'
  | 'search'
  | 'settings'
  | 'send'
  | 'star'
  | 'view';

const GLYPH = {
  alert: Alert01Icon,
  bell: Notification01Icon,
  blog: News01Icon,
  board: ChipIcon,
  book: Book02Icon,
  cart: ShoppingCart01Icon,
  check: Tick02Icon,
  'check-circle': CheckmarkCircle02Icon,
  'chevron-down': ArrowDown01Icon,
  'chevron-right': ArrowRight01Icon,
  clock: Clock01Icon,
  close: Cancel01Icon,
  compass: Compass01Icon,
  cube: CubeIcon,
  factory: Factory01Icon,
  feed: DashboardSquare01Icon,
  file: File01Icon,
  flag: Flag02Icon,
  folder: Folder01Icon,
  grid: DashboardSquare01Icon,
  heart: FavouriteIcon,
  help: HelpCircleIcon,
  info: InformationCircleIcon,
  invoice: Invoice01Icon,
  layers: Layers01Icon,
  map: Navigation03Icon,
  list: ListViewIcon,
  menu: Menu01Icon,
  message: Message01Icon,
  more: MoreVerticalIcon,
  parts: ChipIcon,
  play: PlayIcon,
  plus: PlusSignIcon,
  orders: Package02Icon,
  payouts: Cash01Icon,
  people: UserGroupIcon,
  shop: Building06Icon,
  stock: WarehouseIcon,
  search: Search01Icon,
  send: SendHorizontalIcon,
  settings: Settings02Icon,
  star: StarIcon,
  view: ViewIcon,
} as const satisfies Record<IconName, unknown>;

export interface IconProps {
  readonly name: IconName;
  /** Pixel size. The library draws on a 24 grid and scales cleanly. */
  readonly size?: number;
  /**
   * Filled rather than outlined — a favourite that has been set, a star that
   * has been earned. The library carries both and this picks between them.
   */
  readonly filled?: boolean;
  /**
   * What a screen reader should say. Left off, the icon is decorative and is
   * hidden, which is right wherever the words beside it already say it.
   */
  readonly label?: string;
  readonly className?: string;
}

export const Icon = ({ name, size = 20, filled = false, label, className }: IconProps) => (
  <HugeiconsIcon
    icon={GLYPH[name]}
    size={size}
    strokeWidth={1.6}
    className={cn('shrink-0', className)}
    {...(filled ? { fill: 'currentColor' } : {})}
    {...(label === undefined
      ? { 'aria-hidden': true, focusable: false }
      : { role: 'img', 'aria-label': label })}
  />
);
