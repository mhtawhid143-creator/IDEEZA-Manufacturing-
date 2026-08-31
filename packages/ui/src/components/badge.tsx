import type { HTMLAttributes, ReactNode } from 'react';
import { Badge as DsBadge } from '@ideeza/ds';
import { cn } from '../lib/cn.js';

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

/** This repository's tone names against the system's A17 colour names. */
const DS_COLOR: Record<Tone, 'neutral' | 'brand' | 'blue' | 'success' | 'warning' | 'error'> = {
  neutral: 'neutral',
  brand: 'brand',
  success: 'success',
  warning: 'warning',
  danger: 'error',
  info: 'blue',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: Tone;
  readonly size?: 'sm' | 'md';
  readonly children: ReactNode;
}

/**
 * Counting or labelling pill — the design system's A17 Badge (`@ideeza/ds`)
 * in its Subtle style, wearing this repository's tone names. `danger` is the
 * system's `error`, `info` its `blue`.
 */
export const Badge = ({ tone = 'neutral', size = 'sm', className, children, ...rest }: BadgeProps) => (
  <DsBadge {...rest} variant="subtle" color={DS_COLOR[tone]} size={size} className={className}>
    {children}
  </DsBadge>
);

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: Tone;
  readonly children: ReactNode;
}

/**
 * Specification chip: "2-layer", "FR-4", "ENIG", "50 Ω" — A18 Tag, Default.
 * The system publishes no Tag component yet, so this stays this repository's
 * own, drawn to the A18 spec: the raised surface with the default border, its
 * label in the caption face at primary strength; the brand form takes the
 * tag's own brand tokens. It becomes a wrapper when the system ships one.
 */
export const Tag = ({ tone = 'neutral', className, children, ...rest }: TagProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-surface-raised px-2.5 py-1.5 text-xs font-normal text-text-primary',
      tone === 'brand' && 'border-border-brand bg-tag-brand-bg text-tag-brand-text',
      className,
    )}
    {...rest}
  >
    {children}
  </span>
);
