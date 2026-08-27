'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import {
  buttonAppearance,
  type ButtonSize,
  type ButtonVariant,
} from '../lib/button-appearance.js';
import { Spinner } from './spinner.js';

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
      className={buttonAppearance({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading ? <Spinner size="sm" aria-hidden /> : leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
});
