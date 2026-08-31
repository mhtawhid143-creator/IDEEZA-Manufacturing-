'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Button as DsButton } from '@ideeza/ds/button';
import { cn } from '@ideeza/ds/cn';
import { type ButtonSize, type ButtonVariant } from '../lib/button-appearance.js';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly loading?: boolean;
  readonly leadingIcon?: ReactNode;
  readonly trailingIcon?: ReactNode;
  readonly fullWidth?: boolean;
}

/** This repository's size names sit one step above the system's (xs = SM 32). */
const DS_SIZE: Record<ButtonSize, 'sm' | 'md' | 'lg' | 'xl' | '2xl'> = {
  xs: 'sm',
  sm: 'md',
  md: 'lg',
  lg: 'xl',
  xl: '2xl',
};

/**
 * The one button — the design system's A01 Button (`@ideeza/ds`), wearing this
 * repository's prop names so no screen changes. Loading comes from the system:
 * the spinner replaces the leading icon, the colours stay the hierarchy's own,
 * and the control announces itself busy while blocking input rather than
 * greying out and leaving the tab order.
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
    onClick,
    ...rest
  },
  ref,
) {
  return (
    <DsButton
      {...rest}
      ref={ref}
      type={type}
      variant={variant}
      size={DS_SIZE[size]}
      loading={loading}
      disabled={disabled}
      leftIcon={leadingIcon}
      rightIcon={trailingIcon}
      // The system blocks a loading button with pointer-events; the handler is
      // dropped as well so the promise "refuses clicks while busy" holds even
      // where styles are not computed (tests, unstyled render).
      onClick={loading ? undefined : onClick}
      className={cn(fullWidth && 'w-full', className)}
    >
      {children}
    </DsButton>
  );
});
