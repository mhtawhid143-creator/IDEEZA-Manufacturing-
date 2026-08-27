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

export const BUTTON_SIZE: Record<ButtonSize, string> = {
  xs: 'h-8 px-3 text-xs gap-1.5 rounded-md',
  sm: 'h-9 px-3.5 text-sm gap-2 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-md',
  lg: 'h-11 px-5 text-sm gap-2 rounded-lg',
  xl: 'h-12 px-6 text-base gap-2.5 rounded-lg',
};

const BASE =
  'inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus ' +
  'disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:text-disabled-text disabled:border-transparent disabled:shadow-none';

export interface ButtonAppearance {
  readonly variant?: ButtonVariant | undefined;
  readonly size?: ButtonSize | undefined;
  readonly fullWidth?: boolean | undefined;
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
export const buttonAppearance = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: ButtonAppearance = {}): string =>
  cn(BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], fullWidth && 'w-full', className);
