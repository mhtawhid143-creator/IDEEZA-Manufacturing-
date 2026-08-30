/**
 * Tailwind preset — the design system's names, not this repository's.
 *
 * Every colour, radius, shadow and type size below is a variable from
 * `@ideeza/tokens`, under the name the system gives it. `bg-bg-surface`,
 * `text-text-primary`, `border-border-subtle` read oddly the first time and are
 * deliberate: they are what the system's own components are written in, so a
 * component from either side can be read — and eventually moved — without
 * translating a vocabulary on the way.
 *
 * This mirrors `@ideeza/tokens/tailwind-preset` rather than importing it. That
 * module is TypeScript compiled at publish time, and the system is installed
 * from git, which ships its `css` directory and no build. When the system is
 * published to npm this file becomes `presets: [ideezaPreset]` and goes.
 *
 * What is not the system's is marked where it appears: the layout measurements
 * taken from the panel frames, the animation the panels use, and the screen
 * breakpoints the panel grid is drawn on.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Primitives — for the few places a step is named directly.
        violet: {
          50: 'var(--color-violet-50)',
          100: 'var(--color-violet-100)',
          200: 'var(--color-violet-200)',
          300: 'var(--color-violet-300)',
          400: 'var(--color-violet-400)',
          500: 'var(--color-violet-500)',
          600: 'var(--color-violet-600)',
          700: 'var(--color-violet-700)',
          800: 'var(--color-violet-800)',
          900: 'var(--color-violet-900)',
          950: 'var(--color-violet-950)',
        },
        gray: {
          50: 'var(--color-gray-50)',
          100: 'var(--color-gray-100)',
          200: 'var(--color-gray-200)',
          300: 'var(--color-gray-300)',
          400: 'var(--color-gray-400)',
          500: 'var(--color-gray-500)',
          600: 'var(--color-gray-600)',
          700: 'var(--color-gray-700)',
          800: 'var(--color-gray-800)',
          900: 'var(--color-gray-900)',
          950: 'var(--color-gray-950)',
        },
        blue: {
          50: 'var(--color-blue-50)',
          100: 'var(--color-blue-100)',
          500: 'var(--color-blue-500)',
          700: 'var(--color-blue-700)',
        },
        green: {
          50: 'var(--color-green-50)',
          100: 'var(--color-green-100)',
          500: 'var(--color-green-500)',
          800: 'var(--color-green-800)',
        },
        red: {
          50: 'var(--color-red-50)',
          100: 'var(--color-red-100)',
          500: 'var(--color-red-500)',
          700: 'var(--color-red-700)',
        },
        yellow: {
          50: 'var(--color-yellow-50)',
          100: 'var(--color-yellow-100)',
          500: 'var(--color-yellow-500)',
          800: 'var(--color-yellow-800)',
        },
        orange: {
          100: 'var(--color-orange-100)',
          500: 'var(--color-orange-500)',
          700: 'var(--color-orange-700)',
        },

        // Semantic — backgrounds
        bg: {
          page: 'var(--color-bg-page)',
          surface: 'var(--color-bg-surface)',
          'surface-raised': 'var(--color-bg-surface-raised)',
          subtle: 'var(--color-bg-subtle)',
          inverse: 'var(--color-bg-inverse)',
          overlay: 'var(--color-bg-overlay)',
          brand: 'var(--color-bg-brand)',
          'brand-hover': 'var(--color-bg-brand-hover)',
          'brand-pressed': 'var(--color-bg-brand-pressed)',
          'brand-subtle': 'var(--color-bg-brand-subtle)',
          success: 'var(--color-bg-success)',
          'success-subtle': 'var(--color-bg-success-subtle)',
          warning: 'var(--color-bg-warning)',
          'warning-subtle': 'var(--color-bg-warning-subtle)',
          error: 'var(--color-bg-error)',
          'error-subtle': 'var(--color-bg-error-subtle)',
          info: 'var(--color-bg-info)',
          'info-subtle': 'var(--color-bg-info-subtle)',
        },

        // Semantic — text
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          disabled: 'var(--color-text-disabled)',
          inverse: 'var(--color-text-inverse)',
          'on-brand': 'var(--color-text-on-brand)',
          brand: 'var(--color-text-brand)',
          link: 'var(--color-text-link)',
          success: 'var(--color-text-success)',
          warning: 'var(--color-text-warning)',
          error: 'var(--color-text-error)',
        },

        // Semantic — borders
        border: {
          DEFAULT: 'var(--color-border-default)',
          strong: 'var(--color-border-strong)',
          subtle: 'var(--color-border-subtle)',
          focus: 'var(--color-border-focus)',
          error: 'var(--color-border-error)',
          brand: 'var(--color-border-brand)',
          success: 'var(--color-border-success)',
          warning: 'var(--color-border-warning)',
          blue: 'var(--color-border-blue)',
        },
      },

      fontFamily: {
        sans: 'var(--font-family-body)',
        display: 'var(--font-family-display)',
        mono: 'var(--font-family-mono)',
      },

      // The system's ramp. Each step names its variable rather than a pixel
      // value, so the sizes follow it — including the smaller values it swaps
      // in below 768px, which a hard-coded ramp cannot do. The names on the
      // left are Tailwind's own scale and the sizes line up one for one: xs is
      // the system's 12, sm its 14, base its 16, lg its 18.
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
        none: 'var(--radius-none)',
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        full: 'var(--radius-full)',
      },

      boxShadow: {
        none: 'var(--elevation-0)',
        1: 'var(--elevation-1)',
        2: 'var(--elevation-2)',
        3: 'var(--elevation-3)',
        4: 'var(--elevation-4)',
        5: 'var(--elevation-5)',
        6: 'var(--elevation-6)',
        inner: 'var(--elevation-inner)',
        'depth-accent': 'var(--shadow-depth-accent)',
      },

      // The system numbers its spacing ladder its own way — its step 4 is 8px
      // where Tailwind step 4 is 16px — so adopting it would silently halve
      // every padding and gap already written against Tailwind's scale. The
      // ladder stays Tailwind's; what is added is the shell, measured from the
      // panel frames, which the system does not describe.
      spacing: {
        2.5: "10px",
        7: "28px",
        navbar: "var(--layout-navbar-height)",
        sidebar: "var(--layout-sidebar-width)",
        gutter: "var(--layout-gutter)",
      },

      maxWidth: {
        content: 'var(--layout-content-max)',
        // The measure a line of prose is read at: about 80 characters, at any
        // size, because it scales with the type rather than being a pixel.
        measure: '40em',
      },

      screens: {
        // The panel grid: mobile 390, tablet 768, desktop 1440, with the panel
        // file's own switch at 960.
        sm: '480px',
        md: '768px',
        lg: '960px',
        xl: '1280px',
        '2xl': '1440px',
      },

      ringColor: {
        focus: 'var(--color-focus-halo)',
        'focus-on-fill': 'var(--color-focus-halo-on-fill)',
        'focus-danger': 'var(--color-focus-halo-danger)',
      },

      keyframes: {
        'ui-fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'ui-slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'ui-slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'ui-spin': { to: { transform: 'rotate(360deg)' } },
      },

      animation: {
        'fade-in': 'ui-fade-in var(--motion-duration-fast) var(--motion-easing-standard)',
        'slide-up': 'ui-slide-up var(--motion-duration-normal) var(--motion-easing-decelerate)',
        'slide-in-right':
          'ui-slide-in-right var(--motion-duration-slow) var(--motion-easing-decelerate)',
        spin: 'ui-spin 900ms linear infinite',
      },
    },
  },
};
