/**
 * Tailwind preset that exposes the design tokens as utilities.
 *
 * Every colour, radius, shadow and layout size resolves to a CSS variable from
 * styles/tokens.css, so a theme change never requires touching a component.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--ids-color-brand)',
          hover: 'var(--ids-color-brand-hover)',
          pressed: 'var(--ids-color-brand-pressed)',
          weak: 'var(--ids-color-brand-weak)',
          tint: 'var(--ids-color-brand-tint)',
          surface: 'var(--ids-color-brand-surface)',
          'surface-hover': 'var(--ids-color-brand-surface-hover)',
          'surface-pressed': 'var(--ids-color-brand-surface-pressed)',
        },
        accent: 'var(--ids-color-accent)',
        'accent-strong': 'var(--ids-color-accent-strong)',
        heading: 'var(--ids-color-heading)',
        body: 'var(--ids-color-body)',
        muted: 'var(--ids-color-muted)',
        'on-brand': 'var(--ids-color-on-brand)',
        surface: 'var(--ids-color-surface)',
        canvas: 'var(--ids-color-canvas)',
        raised: 'var(--ids-color-raised)',
        line: {
          DEFAULT: 'var(--ids-color-border)',
          strong: 'var(--ids-color-border-strong)',
          input: 'var(--ids-color-border-input)',
          'input-hover': 'var(--ids-color-border-input-hover)',
        },
        danger: {
          DEFAULT: 'var(--ids-color-danger)',
          strong: 'var(--ids-color-danger-strong)',
          weak: 'var(--ids-color-danger-weak)',
        },
        warning: {
          DEFAULT: 'var(--ids-color-warning)',
          weak: 'var(--ids-color-warning-weak)',
        },
        success: {
          DEFAULT: 'var(--ids-color-success)',
          weak: 'var(--ids-color-success-weak)',
        },
        info: {
          DEFAULT: 'var(--ids-color-info)',
          weak: 'var(--ids-color-info-weak)',
        },
        neutral: {
          DEFAULT: 'var(--ids-color-neutral)',
          weak: 'var(--ids-color-neutral-weak)',
        },
        'disabled-bg': 'var(--ids-color-disabled-bg)',
        'disabled-text': 'var(--ids-color-disabled-text)',
      },
      fontFamily: {
        sans: 'var(--ids-font-body)',
        heading: 'var(--ids-font-heading)',
        mono: 'var(--ids-font-mono)',
      },
      // The type ramp is the design system's. Each step names the system
      // variable that holds it rather than a pixel value, so the sizes follow
      // the system — including the smaller values it swaps in below 768px,
      // which a hard-coded ramp cannot do.
      //
      // The names on the left are this repository's, and the sizes line up one
      // for one: xs is the system's 12, sm its 14, base its 16, lg its 18.
      fontSize: {
        xs: ['var(--font-size-sm)', { lineHeight: 'var(--line-height-xs)' }],
        sm: ['var(--font-size-md)', { lineHeight: 'var(--line-height-md)' }],
        base: ['var(--font-size-lg)', { lineHeight: 'var(--line-height-lg)' }],
        lg: ['var(--font-size-xl)', { lineHeight: 'var(--line-height-2xl)' }],
        xl: ['var(--font-size-2xl)', { lineHeight: 'var(--line-height-3xl)' }],
        '2xl': ['var(--font-size-3xl)', { lineHeight: 'var(--line-height-4xl)' }],
        '3xl': ['var(--font-size-4xl)', { lineHeight: 'var(--line-height-5xl)' }],
        '4xl': ['var(--font-size-5xl)', { lineHeight: 'var(--line-height-6xl)' }],
      },
      fontWeight: {
        normal: 'var(--font-weight-regular)',
        medium: 'var(--font-weight-medium)',
        semibold: 'var(--font-weight-semibold)',
        bold: 'var(--font-weight-bold)',
      },
      borderRadius: {
        xs: 'var(--ids-radius-xs)',
        sm: 'var(--ids-radius-sm)',
        md: 'var(--ids-radius-md)',
        lg: 'var(--ids-radius-lg)',
        xl: 'var(--ids-radius-xl)',
        '2xl': 'var(--ids-radius-2xl)',
        full: 'var(--ids-radius-full)',
      },
      boxShadow: {
        card: 'var(--ids-shadow-card)',
        dropdown: 'var(--ids-shadow-dropdown)',
        modal: 'var(--ids-shadow-modal)',
        overlay: 'var(--ids-shadow-overlay)',
        brand: 'var(--ids-shadow-brand)',
        none: 'none',
      },
      spacing: {
        // Figma spacing scale adds 10px and 28px to the default ladder.
        2.5: '10px',
        7: '28px',
        navbar: 'var(--ids-navbar-height)',
        sidebar: 'var(--ids-sidebar-width)',
        gutter: 'var(--ids-content-gutter)',
      },
      maxWidth: {
        content: 'var(--ids-content-max)',
      },
      screens: {
        // Figma grid: mobile 390, tablet 768, desktop 1440; the panel file
        // switches its own layout at 960.
        sm: '480px',
        md: '768px',
        lg: '960px',
        xl: '1280px',
        '2xl': '1440px',
      },
      ringColor: {
        focus: 'var(--ids-color-focus-halo)',
        'focus-on-fill': 'var(--ids-color-focus-halo-on-fill)',
        'focus-danger': 'var(--ids-color-focus-halo-danger)',
      },
      keyframes: {
        'ids-fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'ids-slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'ids-slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'ids-spin': { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-in': 'ids-fade-in 150ms ease-out',
        'slide-up': 'ids-slide-up 180ms ease-out',
        'slide-in-right': 'ids-slide-in-right 220ms ease-out',
        spin: 'ids-spin 900ms linear infinite',
      },
    },
  },
};
