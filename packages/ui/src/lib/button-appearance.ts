import { cn } from './cn.js';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tonal'
  | 'ghost'
  | 'outline'
  | 'danger';

/** Figma button heights: 32, 36, 40, 44, 48. */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Every colour here is the design system's button token for that variant and
 * state — `--color-button-*` — rather than a surface or text colour that
 * happens to match today. When the system repaints a pressed danger button,
 * this one follows without anyone noticing a step was missed.
 */
export const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-button-primary-bg text-button-primary-text hover:bg-button-primary-bg-hover active:bg-button-primary-bg-pressed shadow-1',
  secondary:
    'bg-button-secondary-bg text-button-secondary-text border-1.5 border-button-secondary-border hover:bg-button-secondary-bg-hover hover:border-button-secondary-border-hover active:bg-button-secondary-bg-pressed',
  tonal:
    'bg-button-tonal-bg text-button-tonal-text hover:bg-button-tonal-bg-hover active:bg-button-tonal-bg-pressed',
  ghost:
    'bg-transparent text-button-ghost-text hover:bg-button-ghost-bg-hover active:bg-button-secondary-bg-pressed',
  outline:
    'bg-transparent text-text-brand border border-border-brand hover:bg-button-outline-bg-hover active:bg-button-outline-bg-pressed',
  danger:
    'bg-button-danger-bg text-button-danger-text hover:bg-button-danger-bg-hover active:bg-button-danger-bg-pressed shadow-1',
};

/**
 * The system's size ramp (A01, corrected 2026-08-02), name for name — this
 * repository's xs…xl are the system's SM…2XL:
 *
 *   SM 32 · radius/lg · px 12 · gap 6 · 12/16   MD 36 · radius/lg · px 14 · gap 6 · 14/20
 *   LG 40 · radius/xl · px 16 · gap 6 · 14/20   XL 44 · radius/xl · px 20 · gap 8 · 16/24
 *   2XL 48 · radius/2xl · px 24 · gap 8 · 16/24
 *
 * The height is the Figma measurement and stays exact; the vertical padding
 * states the space that fixed height already leaves around the line box.
 */
export const BUTTON_SIZE: Record<ButtonSize, string> = {
  xs: 'h-8 px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  sm: 'h-9 px-3.5 py-2 text-sm gap-1.5 rounded-lg',
  md: 'h-10 px-4 py-2 text-sm gap-1.5 rounded-xl',
  lg: 'h-11 px-5 py-2.5 text-base gap-2 rounded-xl',
  xl: 'h-12 px-6 py-3 text-base gap-2 rounded-2xl',
};

const BASE =
  'inline-flex select-none items-center justify-center whitespace-nowrap font-semibold tracking-wide transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus ' +
  'disabled:cursor-not-allowed disabled:bg-button-disabled-bg disabled:text-button-disabled-text disabled:border-transparent disabled:shadow-none';

export interface ButtonAppearance {
  readonly variant?: ButtonVariant | undefined;
  readonly size?: ButtonSize | undefined;
  readonly fullWidth?: boolean | undefined;
  /**
   * The control is shown but has nothing behind it — a link with no
   * destination, an action this build cannot perform. It replaces the variant
   * colours rather than being layered over them, because a class layered over
   * a variant is a coin toss over which one Tailwind emitted last.
   */
  readonly unavailable?: boolean | undefined;
  readonly className?: string | undefined;
}

/**
 * The button's look, without the button.
 *
 * A link that navigates must stay an anchor: an anchor wrapped around a button
 * is two interactive elements for one action, which assistive technology reads
 * as such. This lets a link wear the same appearance instead.
 *
 * It lives outside the button component on purpose. The component is a client
 * component, and a server component may not call into one — but it may render
 * a link with these classes.
 */
/** A control that is shown but cannot be used: readable, and obviously inert. */
const UNAVAILABLE =
  'cursor-not-allowed bg-bg-subtle text-text-secondary shadow-none hover:bg-bg-subtle';

export const buttonAppearance = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  unavailable = false,
  className,
}: ButtonAppearance = {}): string =>
  cn(
    BASE,
    unavailable ? UNAVAILABLE : BUTTON_VARIANT[variant],
    BUTTON_SIZE[size],
    fullWidth && 'w-full',
    className,
  );
