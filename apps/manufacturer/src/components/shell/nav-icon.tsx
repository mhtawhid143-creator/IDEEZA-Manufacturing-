import type { NavIcon } from '@/lib/navigation.js';

const PATHS: Record<NavIcon, string> = {
  grid: 'M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z',
  folder: 'M3 6a2 2 0 0 1 2-2h3l2 2h5a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  parts: 'M10 3v4M10 13v4M3 10h4M13 10h4M7 7l6 6M13 7l-6 6',
  compass: 'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM13 7l-2 4-4 2 2-4z',
  feed: 'M4 4h12v3H4zM4 9h7v7H4zM13 9h3v3h-3zM13 13h3v3h-3z',
  message: 'M4 5h12v8H8l-4 3z',
  heart: 'M10 16s-5.5-3.5-5.5-7A3.2 3.2 0 0 1 10 6.4 3.2 3.2 0 0 1 15.5 9c0 3.5-5.5 7-5.5 7z',
  blog: 'M5 3h10v14H5zM7 6h6M7 9h6M7 12h4',
  works: 'M4 8h12v8H4zM7 8V5h6v3',
  factory: 'M3 16V9l4 2V9l4 2V9l4 2v5zM6 13h2M10 13h2M14 13h1',
  freelancer: 'M4 15v-1a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v1M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  bell: 'M10 3a4 4 0 0 0-4 4v3l-1 2h10l-1-2V7a4 4 0 0 0-4-4zM8 14a2 2 0 0 0 4 0',
  book: 'M4 4h5v12H4zM11 4h5v12h-5z',
  map: 'M3 6l4-2 6 2 4-2v10l-4 2-6-2-4 2z',
  flag: 'M5 3v14M5 4h9l-1.5 3L14 10H5',
};

export const NavIconGlyph = ({ name }: { readonly name: NavIcon }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className="shrink-0"
  >
    <path d={PATHS[name]} />
  </svg>
);
