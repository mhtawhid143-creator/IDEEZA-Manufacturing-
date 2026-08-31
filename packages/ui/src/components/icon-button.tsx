'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon-only control must still say what it does. */
  readonly label: string;
  readonly icon: ReactNode;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly variant?: 'ghost' | 'surface' | 'brand' | 'danger';
  readonly badge?: number | undefined;
}

// A02's size ramp carries its radius with it: 32 takes the md radius, 40 the
// lg, 44 the xl.
const SIZE = { sm: 'h-8 w-8 rounded-md', md: 'h-10 w-10 rounded-lg', lg: 'h-11 w-11 rounded-xl' } as const;

// A02 Icon Button hierarchies, in the button tokens the system binds: ghost is
// bare, surface is the Secondary bordered form, brand the Primary fill and
// danger the Danger fill. Disabled is its own paint, never an opacity.
const VARIANT = {
  ghost: 'text-icon hover:bg-button-ghost-bg-hover disabled:bg-button-disabled-bg',
  surface:
    'border-1.5 border-button-secondary-border bg-button-secondary-bg text-icon hover:bg-button-secondary-bg-hover active:bg-button-secondary-bg-pressed disabled:border-button-disabled-bg disabled:bg-button-disabled-bg',
  brand:
    'bg-button-primary-bg text-icon-on-brand hover:bg-button-primary-bg-hover active:bg-button-primary-bg-pressed disabled:bg-button-disabled-bg',
  danger:
    'bg-button-danger-bg text-icon-on-brand hover:bg-button-danger-bg-hover active:bg-button-danger-bg-pressed disabled:bg-button-disabled-bg',
} as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, icon, size = 'md', variant = 'ghost', badge, className, type = 'button', ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn(
          'relative inline-flex items-center justify-center transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus',
          'disabled:cursor-not-allowed disabled:text-icon-disabled',
          SIZE[size],
          VARIANT[variant],
          className,
        )}
        {...rest}
      >
        {icon}
        {badge !== undefined && badge > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bg-error px-1 text-3xs font-semibold text-text-on-brand"
            aria-hidden
          >
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>
    );
  },
);
