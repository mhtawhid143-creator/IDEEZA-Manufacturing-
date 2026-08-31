import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { Badge as DsBadge } from '../ds/components/Badge/index.js';

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

/** The colour names the system's badge accepts. */
export type BadgeColour = 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'blue';


/**
 * This repository's tone names, in the system's own colour names.
 *
 * The two vocabularies differ in two places and nowhere else: what is called
 * `danger` here is `error` in the system, and `info` here is `blue` there. The
 * table is the whole translation, so a screen keeps saying `tone="danger"` and
 * the system still decides what danger looks like.
 */
const COLOUR: Record<Tone, BadgeColour> = {
  neutral: 'neutral',
  brand: 'brand',
  success: 'success',
  warning: 'warning',
  danger: 'error',
  info: 'blue',
};

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  readonly tone?: Tone;
  readonly size?: 'sm' | 'md';
  readonly children: ReactNode;
}

/**
 * Counting or labelling pill — the system's A17 Badge, Subtle.
 *
 * The pill itself is the system's component: its heights, padding, radius,
 * type face and every tone's colours come from there, not from classes written
 * here. What this wrapper adds is the tone vocabulary above and one measure the
 * system's badge has no reason to carry — a minimum width equal to the height,
 * so a badge holding a single digit is a circle rather than a narrow lozenge.
 * That matters because most badges in these panels are counts.
 */
export const Badge = ({
  tone = 'neutral',
  size = 'sm',
  className,
  children,
  ...rest
}: BadgeProps) => (
  <DsBadge
    variant="subtle"
    color={COLOUR[tone] ?? 'neutral'}
    size={size}
    className={cn('justify-center', size === 'sm' ? 'min-w-5' : 'min-w-6', className)}
    {...rest}
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
 * The system draws it on the raised surface with the default border, its label
 * in the caption face at primary strength; the brand form takes the tag's own
 * brand tokens. The system does not publish a Tag component yet, so this one is
 * built here from the tag's own tokens and moves when it arrives there.
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
