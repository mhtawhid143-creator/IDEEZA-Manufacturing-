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
      // Colour is semantic only. The system's primitives (`violet-600`,
      // `gray-100`, `green-100` …) are not exposed here on purpose: a primitive
      // names a swatch, and a swatch does not know whether it is a surface, a
      // word or a border, so it cannot follow the theme — the pale green pill
      // that looked right on white stayed pale green on the dark surface. A
      // semantic token knows what it is for and carries both themes with it.
      // Every colour a screen or a component asks for is one of the names
      // below; the lint rule refuses a primitive.
      colors: {
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
          blue: 'var(--color-bg-blue)',
          'blue-subtle': 'var(--color-bg-blue-subtle)',
          ai: 'var(--color-bg-ai)',
          'ai-subtle': 'var(--color-bg-ai-subtle)',
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
          'brand-hover': 'var(--color-text-brand-hover)',
          link: 'var(--color-text-link)',
          success: 'var(--color-text-success)',
          warning: 'var(--color-text-warning)',
          error: 'var(--color-text-error)',
          'error-hover': 'var(--color-text-error-hover)',
          blue: 'var(--color-text-blue)',
          ai: 'var(--color-text-ai)',
        },

        // Semantic — icons. An icon is not text: the system gives it its own
        // colour, one step from the words beside it.
        icon: {
          DEFAULT: 'var(--color-icon-default)',
          secondary: 'var(--color-icon-secondary)',
          disabled: 'var(--color-icon-disabled)',
          'on-brand': 'var(--color-icon-on-brand)',
          brand: 'var(--color-icon-brand)',
          blue: 'var(--color-icon-blue)',
          success: 'var(--color-icon-success)',
          warning: 'var(--color-icon-warning)',
          error: 'var(--color-icon-error)',
          ai: 'var(--color-icon-ai)',
        },

        // Component — the button, every variant and state the system paints.
        button: {
          'primary-bg': 'var(--color-button-primary-bg)',
          'primary-bg-hover': 'var(--color-button-primary-bg-hover)',
          'primary-bg-pressed': 'var(--color-button-primary-bg-pressed)',
          'primary-text': 'var(--color-button-primary-text)',
          'secondary-bg': 'var(--color-button-secondary-bg)',
          'secondary-bg-hover': 'var(--color-button-secondary-bg-hover)',
          'secondary-bg-pressed': 'var(--color-button-secondary-bg-pressed)',
          'secondary-border': 'var(--color-button-secondary-border)',
          'secondary-border-hover': 'var(--color-button-secondary-border-hover)',
          'secondary-text': 'var(--color-button-secondary-text)',
          'tonal-bg': 'var(--color-button-tonal-bg)',
          'tonal-bg-hover': 'var(--color-button-tonal-bg-hover)',
          'tonal-bg-pressed': 'var(--color-button-tonal-bg-pressed)',
          'tonal-text': 'var(--color-button-tonal-text)',
          'outline-bg-hover': 'var(--color-button-outline-bg-hover)',
          'outline-bg-pressed': 'var(--color-button-outline-bg-pressed)',
          'ghost-text': 'var(--color-button-ghost-text)',
          'ghost-bg-hover': 'var(--color-button-ghost-bg-hover)',
          'danger-bg': 'var(--color-button-danger-bg)',
          'danger-bg-hover': 'var(--color-button-danger-bg-hover)',
          'danger-bg-pressed': 'var(--color-button-danger-bg-pressed)',
          'danger-text': 'var(--color-button-danger-text)',
          'inverse-bg': 'var(--color-button-inverse-bg)',
          'inverse-bg-hover': 'var(--color-button-inverse-bg-hover)',
          'inverse-bg-pressed': 'var(--color-button-inverse-bg-pressed)',
          'inverse-text': 'var(--color-button-inverse-text)',
          'disabled-bg': 'var(--color-button-disabled-bg)',
          'disabled-text': 'var(--color-button-disabled-text)',
        },

        // Component — the input, its field and the words around it.
        input: {
          bg: 'var(--color-input-bg)',
          'bg-disabled': 'var(--color-input-bg-disabled)',
          border: 'var(--color-input-border)',
          'border-hover': 'var(--color-input-border-hover)',
          'border-focus': 'var(--color-input-border-focus)',
          'border-error': 'var(--color-input-border-error)',
          'border-disabled': 'var(--color-input-border-disabled)',
          text: 'var(--color-input-text)',
          placeholder: 'var(--color-input-placeholder)',
          label: 'var(--color-input-label)',
          helper: 'var(--color-input-helper)',
          'error-text': 'var(--color-input-error-text)',
        },

        // Component — the badge and the tag, painted with their own tokens
        // (A17 / A18 in the Figma system).
        badge: {
          'brand-bg': 'var(--color-badge-brand-bg)',
          'brand-text': 'var(--color-badge-brand-text)',
          'blue-bg': 'var(--color-badge-blue-bg)',
          'blue-text': 'var(--color-badge-blue-text)',
          'success-bg': 'var(--color-badge-success-bg)',
          'success-text': 'var(--color-badge-success-text)',
          'warning-bg': 'var(--color-badge-warning-bg)',
          'warning-text': 'var(--color-badge-warning-text)',
          'error-bg': 'var(--color-badge-error-bg)',
          'error-text': 'var(--color-badge-error-text)',
        },
        tag: {
          'brand-bg': 'var(--color-tag-brand-bg)',
          'brand-text': 'var(--color-tag-brand-text)',
          'neutral-bg': 'var(--color-tag-neutral-bg)',
          'neutral-text': 'var(--color-tag-neutral-text)',
        },
        toast: {
          'success-bg': 'var(--color-toast-success-bg)',
          'warning-bg': 'var(--color-toast-warning-bg)',
          'error-bg': 'var(--color-toast-error-bg)',
          'info-bg': 'var(--color-toast-info-bg)',
        },
        card: {
          bg: 'var(--color-card-bg)',
          'bg-hover': 'var(--color-card-bg-hover)',
          border: 'var(--color-card-border)',
        },
        modal: {
          bg: 'var(--color-modal-bg)',
          border: 'var(--color-modal-border)',
          overlay: 'var(--color-modal-overlay)',
        },
        ai: {
          'badge-bg': 'var(--color-ai-badge-bg)',
          'badge-text': 'var(--color-ai-badge-text)',
          'prompt-bg': 'var(--color-ai-prompt-bg)',
          'prompt-border': 'var(--color-ai-prompt-border)',
        },
        chart: {
          1: 'var(--chart-categorical-01)',
          2: 'var(--chart-categorical-02)',
          3: 'var(--chart-categorical-03)',
          4: 'var(--chart-categorical-04)',
          5: 'var(--chart-categorical-05)',
          6: 'var(--chart-categorical-06)',
          7: 'var(--chart-categorical-07)',
          8: 'var(--chart-categorical-08)',
          grid: 'var(--chart-grid)',
          axis: 'var(--chart-axis)',
          positive: 'var(--chart-positive)',
          negative: 'var(--chart-negative)',
          neutral: 'var(--chart-neutral)',
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
          ai: 'var(--color-border-ai)',
          'focus-danger': 'var(--color-border-focus-danger)',
          'focus-inverse': 'var(--color-border-focus-inverse)',
          'focus-on-fill': 'var(--color-border-focus-on-fill)',
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
      // left are Tailwind's own scale and sit one step above the system's:
      // Tailwind's xs is the system's sm (12), sm its md (14), base its lg
      // (16), lg its xl (18). Each size carries the line height the system
      // pairs with that very step, never a neighbour's. The two steps below
      // Tailwind's scale — the system's xs (11) and 2xs (10) — are reachable as
      // 2xs and 3xs, so a caption never needs a pixel written by hand.
      fontSize: {
        '3xs': ['var(--font-size-2xs)', { lineHeight: 'var(--line-height-2xs)' }],
        '2xs': ['var(--font-size-xs)', { lineHeight: 'var(--line-height-xs)' }],
        xs: ['var(--font-size-sm)', { lineHeight: 'var(--line-height-sm)' }],
        sm: ['var(--font-size-md)', { lineHeight: 'var(--line-height-md)' }],
        base: ['var(--font-size-lg)', { lineHeight: 'var(--line-height-lg)' }],
        lg: ['var(--font-size-xl)', { lineHeight: 'var(--line-height-xl)' }],
        xl: ['var(--font-size-2xl)', { lineHeight: 'var(--line-height-2xl)' }],
        '2xl': ['var(--font-size-3xl)', { lineHeight: 'var(--line-height-3xl)' }],
        '3xl': ['var(--font-size-4xl)', { lineHeight: 'var(--line-height-4xl)' }],
        '4xl': ['var(--font-size-5xl)', { lineHeight: 'var(--line-height-5xl)' }],
        '5xl': ['var(--font-size-6xl)', { lineHeight: 'var(--line-height-6xl)' }],
        '6xl': ['var(--font-size-7xl)', { lineHeight: 'var(--line-height-7xl)' }],
        '7xl': ['var(--font-size-8xl)', { lineHeight: 'var(--line-height-8xl)' }],

        // The system's text styles — one class per Figma style (`Label/MD` is
        // `text-label-md`): size, line height, tracking and weight as one
        // indivisible choice. The vendored @ideeza/ds components are written
        // in these; the plain ramp above stays for this repository's screens.
        'display-xl': ['var(--font-size-8xl)', { lineHeight: 'var(--line-height-9xl)', letterSpacing: 'var(--letter-spacing-tighter)', fontWeight: 'var(--font-weight-bold)' }],
        'display-lg': ['var(--font-size-7xl)', { lineHeight: 'var(--line-height-8xl)', letterSpacing: 'var(--letter-spacing-tight)', fontWeight: 'var(--font-weight-semibold)' }],
        'display-md': ['var(--font-size-6xl)', { lineHeight: 'var(--line-height-7xl)', letterSpacing: 'var(--letter-spacing-snug)', fontWeight: 'var(--font-weight-semibold)' }],
        'heading-h1': ['var(--font-size-5xl)', { lineHeight: 'var(--line-height-6xl)', letterSpacing: 'var(--letter-spacing-close)', fontWeight: 'var(--font-weight-semibold)' }],
        'heading-h2': ['var(--font-size-4xl)', { lineHeight: 'var(--line-height-5xl)', letterSpacing: 'var(--letter-spacing-near)', fontWeight: 'var(--font-weight-semibold)' }],
        'heading-h3': ['var(--font-size-3xl)', { lineHeight: 'var(--line-height-4xl)', letterSpacing: 'var(--letter-spacing-slight)', fontWeight: 'var(--font-weight-semibold)' }],
        'heading-h4': ['var(--font-size-2xl)', { lineHeight: 'var(--line-height-2xl)', letterSpacing: 'var(--letter-spacing-normal)', fontWeight: 'var(--font-weight-semibold)' }],
        'heading-h5': ['var(--font-size-xl)', { lineHeight: 'var(--line-height-xl)', letterSpacing: 'var(--letter-spacing-normal)', fontWeight: 'var(--font-weight-semibold)' }],
        'body-xs': ['var(--font-size-sm)', { lineHeight: 'var(--line-height-sm)', letterSpacing: 'var(--letter-spacing-normal)', fontWeight: 'var(--font-weight-regular)' }],
        'body-sm': ['var(--font-size-md)', { lineHeight: 'var(--line-height-md)', letterSpacing: 'var(--letter-spacing-normal)', fontWeight: 'var(--font-weight-regular)' }],
        'body-md': ['var(--font-size-lg)', { lineHeight: 'var(--line-height-lg)', letterSpacing: 'var(--letter-spacing-normal)', fontWeight: 'var(--font-weight-regular)' }],
        'body-lg': ['var(--font-size-xl)', { lineHeight: 'var(--line-height-2xl)', letterSpacing: 'var(--letter-spacing-normal)', fontWeight: 'var(--font-weight-regular)' }],
        'body-xl': ['var(--font-size-2xl)', { lineHeight: 'var(--line-height-3xl)', letterSpacing: 'var(--letter-spacing-normal)', fontWeight: 'var(--font-weight-regular)' }],
        'body-xs-medium': ['var(--font-size-sm)', { lineHeight: 'var(--line-height-sm)', letterSpacing: 'var(--letter-spacing-normal)', fontWeight: 'var(--font-weight-medium)' }],
        'body-sm-medium': ['var(--font-size-md)', { lineHeight: 'var(--line-height-md)', letterSpacing: 'var(--letter-spacing-normal)', fontWeight: 'var(--font-weight-medium)' }],
        'body-md-medium': ['var(--font-size-lg)', { lineHeight: 'var(--line-height-lg)', letterSpacing: 'var(--letter-spacing-normal)', fontWeight: 'var(--font-weight-medium)' }],
        'body-lg-medium': ['var(--font-size-xl)', { lineHeight: 'var(--line-height-2xl)', letterSpacing: 'var(--letter-spacing-normal)', fontWeight: 'var(--font-weight-medium)' }],
        'body-xl-medium': ['var(--font-size-2xl)', { lineHeight: 'var(--line-height-3xl)', letterSpacing: 'var(--letter-spacing-normal)', fontWeight: 'var(--font-weight-medium)' }],
        'label-xl': ['var(--font-size-lg)', { lineHeight: 'var(--line-height-lg)', letterSpacing: 'var(--letter-spacing-wide)', fontWeight: 'var(--font-weight-semibold)' }],
        'label-lg': ['var(--font-size-md)', { lineHeight: 'var(--line-height-md)', letterSpacing: 'var(--letter-spacing-wide)', fontWeight: 'var(--font-weight-semibold)' }],
        'label-md': ['var(--font-size-sm)', { lineHeight: 'var(--line-height-xs)', letterSpacing: 'var(--letter-spacing-wide)', fontWeight: 'var(--font-weight-semibold)' }],
        'label-sm': ['var(--font-size-xs)', { lineHeight: 'var(--line-height-xs)', letterSpacing: 'var(--letter-spacing-wider)', fontWeight: 'var(--font-weight-semibold)' }],
        'caption-md': ['var(--font-size-sm)', { lineHeight: 'var(--line-height-xs)', letterSpacing: 'var(--letter-spacing-normal)', fontWeight: 'var(--font-weight-regular)' }],
        'caption-sm': ['var(--font-size-xs)', { lineHeight: 'var(--line-height-xs)', letterSpacing: 'var(--letter-spacing-normal)', fontWeight: 'var(--font-weight-regular)' }],
      },

      lineHeight: {
        '3xs': 'var(--line-height-2xs)',
        '2xs': 'var(--line-height-xs)',
        xs: 'var(--line-height-sm)',
        sm: 'var(--line-height-md)',
        base: 'var(--line-height-lg)',
        lg: 'var(--line-height-xl)',
        xl: 'var(--line-height-2xl)',
      },

      fontWeight: {
        normal: 'var(--font-weight-regular)',
        medium: 'var(--font-weight-medium)',
        semibold: 'var(--font-weight-semibold)',
        bold: 'var(--font-weight-bold)',
        extrabold: 'var(--font-weight-extrabold)',
      },

      // The system's tracking, under its own names. `caps` is the one it gives
      // an uppercase label; the negative steps tighten display sizes.
      letterSpacing: {
        tighter: 'var(--letter-spacing-tighter)',
        tight: 'var(--letter-spacing-tight)',
        snug: 'var(--letter-spacing-snug)',
        close: 'var(--letter-spacing-close)',
        near: 'var(--letter-spacing-near)',
        slight: 'var(--letter-spacing-slight)',
        normal: 'var(--letter-spacing-normal)',
        wide: 'var(--letter-spacing-wide)',
        wider: 'var(--letter-spacing-wider)',
        widest: 'var(--letter-spacing-widest)',
        caps: 'var(--letter-spacing-caps)',
      },

      // Layers are named for what sits on them, not numbered, so two floating
      // things never argue over who is on top.
      zIndex: {
        base: 'var(--z-base)',
        sticky: 'var(--z-sticky)',
        dropdown: 'var(--z-dropdown)',
        overlay: 'var(--z-overlay)',
        sheet: 'var(--z-sheet)',
        modal: 'var(--z-modal)',
        popover: 'var(--z-popover)',
        toast: 'var(--z-toast)',
        notification: 'var(--z-notification)',
        max: 'var(--z-max)',
      },

      opacity: {
        disabled: 'var(--opacity-disabled)',
        muted: 'var(--opacity-muted)',
        overlay: 'var(--opacity-overlay)',
        hover: 'var(--opacity-hover)',
        pressed: 'var(--opacity-pressed)',
      },

      borderWidth: {
        DEFAULT: 'var(--border-width-1)',
        1: 'var(--border-width-1)',
        1.5: 'var(--border-width-1-5)',
        2: 'var(--border-width-2)',
        3: 'var(--border-width-3)',
      },

      transitionDuration: {
        DEFAULT: 'var(--motion-duration-normal)',
        instant: 'var(--motion-duration-instant)',
        fast: 'var(--motion-duration-fast)',
        normal: 'var(--motion-duration-normal)',
        slow: 'var(--motion-duration-slow)',
        slower: 'var(--motion-duration-slower)',
      },

      transitionTimingFunction: {
        DEFAULT: 'var(--motion-easing-standard)',
        standard: 'var(--motion-easing-standard)',
        decelerate: 'var(--motion-easing-decelerate)',
        accelerate: 'var(--motion-easing-accelerate)',
        sharp: 'var(--motion-easing-sharp)',
        spring: 'var(--motion-easing-spring)',
      },

      borderRadius: {
        // A bare `rounded` is the system's small radius, not Tailwind's.
        DEFAULT: 'var(--radius-sm)',
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
      // where Tailwind step 4 is 16px — but the two ladders hold the same
      // distances at every step the panels use. So Tailwind's names stay, and
      // each one now resolves to the system's variable for that distance:
      // `p-4` is still 16px, and 16px is now the system's `--spacing-8`. Two
      // steps the panels use (28px and 36px) have no rung on the system's
      // ladder and are the only pixels left here; the shell measurements are
      // taken from the panel frames, which the system does not describe.
      spacing: {
        0: 'var(--spacing-0)',
        0.5: 'var(--spacing-1)',
        1: 'var(--spacing-2)',
        1.5: 'var(--spacing-3)',
        2: 'var(--spacing-4)',
        2.5: 'var(--spacing-5)',
        3: 'var(--spacing-6)',
        3.5: 'var(--spacing-7)',
        4: 'var(--spacing-8)',
        5: 'var(--spacing-10)',
        6: 'var(--spacing-12)',
        7: '28px',
        8: 'var(--spacing-16)',
        9: '36px',
        10: 'var(--spacing-20)',
        12: 'var(--spacing-24)',
        16: 'var(--spacing-32)',
        20: 'var(--spacing-40)',
        24: 'var(--spacing-48)',
        navbar: 'var(--layout-navbar-height)',
        sidebar: 'var(--layout-sidebar-width)',
        gutter: 'var(--layout-gutter)',
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

      backgroundImage: {
        // Figma paint style `Brand/AI gradient` — the AI button hierarchy.
        ai: 'var(--gradient-ai)',
        'ai-hover': 'var(--gradient-ai-hover)',
        'ai-pressed': 'var(--gradient-ai-pressed)',
      },

      // The system's focus treatment is a 3px halo (border/width/3).
      ringWidth: {
        3: 'var(--border-width-3)',
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
