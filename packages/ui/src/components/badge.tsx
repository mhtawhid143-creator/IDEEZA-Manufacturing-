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

/**
 * One tone the system's badge gets wrong, and the system's own answer for it.
 *
 * A17 Subtle binds `bg-{tone}-subtle` with `text-{tone}`. Measured on the
 * rendered page, five of the six tones clear AA in both themes — brand
 * 7.16/6.65, neutral 9.85/9.45, blue 8.15/6.16, success 5.23/6.81, warning
 * 5.66/6.62 (dark/light). The error tone does not: in dark mode it puts
 * red-400 on red-900, which measures 3.62:1 against the 4.5 a 12px label
 * needs. Light is fine at 5.91, which is why it went unnoticed.
 *
 * The system also ships a badge-specific error pair for the same role, and
 * that measures 6.93 dark and 5.91 light — so the fix is the system's own
 * token, not a colour invented here. Recorded in `docs/DESIGN-SYSTEM.md` §11
 * for the design team; when the compound variant is corrected upstream this
 * table goes away.
 */
const TONE_OVERRIDE: Partial<Record<Tone, string>> = {
  danger: 'bg-badge-error-bg text-badge-error-text',
};

/** The correction above, for a component that draws its own badge frame. */
export const badgeToneOverride = (tone: Tone): string | undefined => TONE_OVERRIDE[tone];

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
  <DsBadge
    {...rest}
    variant="subtle"
    color={DS_COLOR[tone]}
    size={size}
    className={cn(TONE_OVERRIDE[tone], className)}
  >
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
