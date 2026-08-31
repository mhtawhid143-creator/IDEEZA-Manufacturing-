import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

/**
 * The system's badge colours (A17, Subtle style), through its own tokens.
 * Neutral has no badge token of its own in the system: its subtle form is the
 * subtle surface with secondary text, which is what the Figma variant binds.
 */
const TONE: Record<Tone, string> = {
  neutral: 'bg-bg-subtle text-text-secondary',
  brand: 'bg-badge-brand-bg text-badge-brand-text',
  success: 'bg-badge-success-bg text-badge-success-text',
  warning: 'bg-badge-warning-bg text-badge-warning-text',
  danger: 'bg-badge-error-bg text-badge-error-text',
  info: 'bg-badge-blue-bg text-badge-blue-text',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: Tone;
  readonly size?: 'sm' | 'md';
  readonly children: ReactNode;
}

/**
 * Counting or labelling pill — A17 Badge, Subtle. The system sets it in the
 * caption face: 12/16 regular, not bold; SM stands 20 tall, MD 24.
 */
export const Badge = ({ tone = 'neutral', size = 'sm', className, children, ...rest }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center justify-center rounded-full font-normal',
      size === 'sm' ? 'h-5 min-w-5 px-1.5 text-xs' : 'h-6 min-w-6 px-2 text-xs',
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

/**
 * Specification chip: "2-layer", "FR-4", "ENIG", "50 Ω" — A18 Tag, Default.
 * The system draws it on the raised surface with the default border, its label
 * in the caption face at primary strength; the brand form takes the tag's own
 * brand tokens.
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
