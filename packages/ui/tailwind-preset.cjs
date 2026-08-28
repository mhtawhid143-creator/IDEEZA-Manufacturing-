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
      fontSize: {
        // Figma: Body XS 12/16, SM 14/20, Base 16/24, Display 18/28
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '28px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '38px' }],
        '4xl': ['36px', { lineHeight: '44px' }],
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
