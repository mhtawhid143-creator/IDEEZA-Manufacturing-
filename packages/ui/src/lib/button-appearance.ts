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

export const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-pressed shadow-card',
  secondary:
    'bg-surface text-heading border border-line-input hover:bg-raised hover:border-line-input-hover active:bg-line-input',
  tonal:
    'bg-brand-surface text-brand-hover hover:bg-brand-surface-hover active:bg-brand-surface-pressed',
  ghost: 'bg-transparent text-heading hover:bg-raised active:bg-line-input',
  outline:
    'bg-transparent text-brand border border-brand hover:bg-brand-surface-hover active:bg-brand-surface-pressed',
  danger:
    'bg-danger-strong text-on-brand hover:brightness-95 active:brightness-90 shadow-card',
};

/**
 * The height is the Figma measurement and stays exact; the vertical padding
 * states the space that fixed height already leaves around the line box, so the
 * box model says what the eye sees. Nothing rendered changes — every content
 * box here stays at least as tall as its line.
 */
export const BUTTON_SIZE: Record<ButtonSize, string> = {
  xs: 'h-8 px-3 py-1.5 text-xs gap-1.5 rounded-md',
  sm: 'h-9 px-3.5 py-2 text-sm gap-2 rounded-md',
  md: 'h-10 px-4 py-2 text-sm gap-2 rounded-md',
  lg: 'h-11 px-5 py-2.5 text-sm gap-2 rounded-lg',
  xl: 'h-12 px-6 py-3 text-base gap-2.5 rounded-lg',
};

const BASE =
  'inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus ' +
  'disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:text-disabled-text disabled:border-transparent disabled:shadow-none';

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
  'cursor-not-allowed bg-disabled-bg text-body shadow-none hover:bg-disabled-bg';

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
