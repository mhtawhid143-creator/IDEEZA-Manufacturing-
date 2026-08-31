import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  readonly size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Announced to assistive technology unless the spinner is decorative. */
  readonly label?: string;
}

// A20 Spinner, Ring style: the system's SM/MD/LG/XL ramp is 16/20/24/32 with a
// 2/2/2.5/3 stroke. 2.5 has no border-width token, so LG sits on border-2 —
// the nearest step — until the system ships one.
const SIZE = {
  xs: 'h-4 w-4 border-2',
  sm: 'h-5 w-5 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-3',
} as const;

export const Spinner = ({ size = 'md', label, className, ...rest }: SpinnerProps) => (
  <span
    role={label === undefined ? undefined : 'status'}
    aria-label={label}
    className={cn('inline-flex items-center gap-2', className)}
    {...rest}
  >
    {/*
      The Ring draws a full subtle track and a head in the current colour, so a
      caller picks the system's spinner colour with a text-icon-* class.
    */}
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-border-subtle border-t-current',
        SIZE[size],
      )}
    />
    {label !== undefined && <span className="sr-only">{label}</span>}
  </span>
);
