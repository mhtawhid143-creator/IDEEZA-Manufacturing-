'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon-only control must still say what it does. */
  readonly label: string;
  readonly icon: ReactNode;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly variant?: 'ghost' | 'surface' | 'brand';
  readonly badge?: number | undefined;
}

const SIZE = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-11 w-11' } as const;

const VARIANT = {
  ghost: 'text-body hover:bg-raised',
  surface: 'bg-surface border border-line text-body hover:bg-raised',
  brand: 'bg-brand text-on-brand hover:bg-brand-hover',
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
          'relative inline-flex items-center justify-center rounded-md transition-colors',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
          'disabled:cursor-not-allowed disabled:text-disabled-text',
          SIZE[size],
          VARIANT[variant],
          className,
        )}
        {...rest}
      >
        {icon}
        {badge !== undefined && badge > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white"
            aria-hidden
          >
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>
    );
  },
);
