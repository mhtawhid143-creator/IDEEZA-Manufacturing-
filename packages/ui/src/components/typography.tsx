import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export type HeadingLevel = 1 | 2 | 3 | 4;

const HEADING_SIZE: Record<HeadingLevel, string> = {
  1: 'text-2xl font-semibold',
  2: 'text-xl font-semibold',
  3: 'text-lg font-semibold',
  4: 'text-base font-semibold',
};

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  readonly level?: HeadingLevel;
  /** Renders a different tag without changing the visual level. */
  readonly as?: ElementType;
  readonly children: ReactNode;
}

export const Heading = ({ level = 2, as, className, children, ...rest }: HeadingProps) => {
  const Tag = (as ?? (`h${level}` as ElementType)) as ElementType;
  return (
    <Tag className={cn('text-text-primary', HEADING_SIZE[level], className)} {...rest}>
      {children}
    </Tag>
  );
};

export type TextTone = 'default' | 'muted' | 'heading' | 'brand' | 'danger' | 'success';
export type TextSize = 'xs' | 'sm' | 'base' | 'lg';

const TONE: Record<TextTone, string> = {
  default: 'text-text-secondary',
  muted: 'text-text-tertiary',
  heading: 'text-text-primary',
  brand: 'text-text-brand',
  danger: 'text-text-error',
  success: 'text-text-success',
};

export interface TextProps extends HTMLAttributes<HTMLElement> {
  readonly as?: ElementType;
  readonly size?: TextSize;
  readonly tone?: TextTone;
  readonly weight?: 'regular' | 'medium' | 'semibold';
  readonly children: ReactNode;
}

const WEIGHT = {
  regular: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
} as const;

// Written out rather than composed, so the Tailwind scanner can see them.
const SIZE: Record<TextSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
};

export const Text = ({
  as = 'p',
  size = 'sm',
  tone = 'default',
  weight = 'regular',
  className,
  children,
  ...rest
}: TextProps) => {
  const Tag = as as ElementType;
  return (
    <Tag
      className={cn('max-w-measure', SIZE[size], TONE[tone], WEIGHT[weight], className)}
      {...rest}
    >
      {children}
    </Tag>
  );
};

/** Small uppercase label used above values in the Figma cards. */
export const FieldLabel = ({ className, children, ...rest }: HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn('text-xs font-medium uppercase tracking-wide text-text-tertiary', className)}
    {...rest}
  >
    {children}
  </span>
);
