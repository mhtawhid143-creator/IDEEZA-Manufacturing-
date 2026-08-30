import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const TONE: Record<Tone, string> = {
  neutral: 'bg-gray-100 text-gray-600',
  brand: 'bg-bg-brand-subtle text-text-brand',
  success: 'bg-green-100 text-text-success',
  warning: 'bg-yellow-100 text-text-warning',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-text-link',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: Tone;
  readonly size?: 'sm' | 'md';
  readonly children: ReactNode;
}

/** Counting or labelling pill, as used beside the Figma tab labels. */
export const Badge = ({ tone = 'neutral', size = 'sm', className, children, ...rest }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center justify-center rounded-full font-semibold',
      size === 'sm' ? 'h-5 min-w-5 px-1.5 text-xs' : 'h-6 min-w-6 px-2 text-sm',
      TONE[tone],
      className,
    )}
    {...rest}
  >
    {children}
  </span>
);

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: Tone;
  readonly children: ReactNode;
}

/** Specification chip: "2-layer", "FR-4", "ENIG", "50 Ω". */
export const Tag = ({ tone = 'neutral', className, children, ...rest }: TagProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full border border-border-subtle bg-bg-surface px-2.5 py-1 text-xs text-text-secondary',
      tone === 'brand' && 'border-border-brand/30 bg-bg-brand-subtle text-text-brand',
      className,
    )}
    {...rest}
  >
    {children}
  </span>
);
