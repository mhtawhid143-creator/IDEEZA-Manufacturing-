'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { Spinner } from './spinner.js';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tonal'
  | 'ghost'
  | 'outline'
  | 'danger';

/** Figma button heights: 32, 36, 40, 44, 48. */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-pressed shadow-card',
  secondary:
    'bg-surface text-heading border border-line-input hover:bg-raised hover:border-line-input-hover active:bg-line-input',
  tonal: 'bg-brand-surface text-brand-hover hover:bg-brand-surface-hover active:bg-brand-surface-pressed',
  ghost: 'bg-transparent text-heading hover:bg-raised active:bg-line-input',
  outline:
    'bg-transparent text-brand border border-brand hover:bg-brand-surface-hover active:bg-brand-surface-pressed',
  danger:
    'bg-danger-strong text-on-brand hover:brightness-95 active:brightness-90 shadow-card',
};

const SIZE: Record<ButtonSize, string> = {
  xs: 'h-8 px-3 text-xs gap-1.5 rounded-md',
  sm: 'h-9 px-3.5 text-sm gap-2 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-md',
  lg: 'h-11 px-5 text-sm gap-2 rounded-lg',
  xl: 'h-12 px-6 text-base gap-2.5 rounded-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly loading?: boolean;
  readonly leadingIcon?: ReactNode;
  readonly trailingIcon?: ReactNode;
  readonly fullWidth?: boolean;
}

/**
 * The one button. Every state the design system defines is reachable through
 * variant, size, disabled and loading, so a screen never hand-rolls one.
 *
 * A loading button stays focusable and announces itself as busy rather than
 * disappearing from the tab order.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leadingIcon,
    trailingIcon,
    fullWidth = false,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled === true || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
        'disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:text-disabled-text disabled:border-transparent disabled:shadow-none',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size="sm" aria-hidden /> : leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
});
