/**
 * The token values, typed, for the rare case where a value is needed in
 * JavaScript rather than in a class name (charts, canvas, inline svg).
 * Keep in sync with styles/tokens.css.
 */
export const tokens = {
  color: {
    brand: '#7c2db9',
    brandHover: '#6a1fa4',
    brandPressed: '#55168a',
    brandWeak: '#f3eafa',
    accent: '#fe2ad4',
    accentStrong: '#d323b0',
    heading: '#0e0515',
    body: '#4a4450',
    muted: '#716f72',
    surface: '#ffffff',
    canvas: '#f8f5f9',
    border: '#f3eafa',
    danger: '#d73a50',
    warning: '#eab308',
    success: '#11813a',
    info: '#245fe2',
  },
  radius: {
    xs: 2,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 28,
    full: 1000,
  },
  layout: {
    navbarHeight: 68,
    sidebarWidth: 232,
    contentGutter: 32,
    contentMax: 1440,
  },
  breakpoint: {
    sm: 480,
    md: 768,
    lg: 960,
    xl: 1280,
    '2xl': 1440,
  },
  font: {
    body: '"Inter", ui-sans-serif, system-ui, sans-serif',
  },
} as const;

export type Tokens = typeof tokens;
