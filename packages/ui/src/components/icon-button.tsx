'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { IconButton as DsIconButton } from '@ideeza/ds';
import { cn } from '@ideeza/ds/cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon-only control must still say what it does. */
  readonly label: string;
  readonly icon: ReactNode;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly variant?: 'ghost' | 'surface' | 'brand' | 'danger';
  readonly badge?: number | undefined;
}

/**
 * This repository's names against the system's A02 Icon Button: `surface` is
 * its Secondary bordered form, `brand` its Primary fill; the sizes name the
 * same 32/40/44 pixel heights the system names literally.
 */
const DS_VARIANT = {
  ghost: 'ghost',
  surface: 'secondary',
  brand: 'primary',
  danger: 'danger',
} as const;

const DS_SIZE = { sm: 32, md: 40, lg: 44 } as const;

/**
 * An icon-only button — the design system's A02 (`@ideeza/ds`) wearing this
 * repository's prop names. The unread-count badge is this repository's own
 * addition (the system's A02 carries none): a small error-filled pill pinned
 * to the corner, aria-hidden because the accessible name already carries the
 * meaning.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, icon, size = 'md', variant = 'ghost', badge, className, type = 'button', ...rest },
    ref,
  ) {
    return (
      <DsIconButton
        {...rest}
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        variant={DS_VARIANT[variant]}
        size={DS_SIZE[size]}
        className={cn('relative', className)}
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
      </DsIconButton>
    );
  },
);
