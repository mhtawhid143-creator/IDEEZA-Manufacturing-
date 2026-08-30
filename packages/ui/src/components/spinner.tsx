import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  readonly size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Announced to assistive technology unless the spinner is decorative. */
  readonly label?: string;
}

const SIZE = {
  xs: 'h-3 w-3 border',
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
} as const;

export const Spinner = ({ size = 'md', label, className, ...rest }: SpinnerProps) => (
  <span
    role={label === undefined ? undefined : 'status'}
    aria-label={label}
    className={cn('inline-flex items-center gap-2', className)}
    {...rest}
  >
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-current border-t-transparent opacity-70',
        SIZE[size],
      )}
    />
    {label !== undefined && <span className="sr-only">{label}</span>}
  </span>
);
