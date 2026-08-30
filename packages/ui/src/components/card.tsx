import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { Heading, Text } from './typography.js';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly padded?: boolean;
  readonly interactive?: boolean;
  readonly selected?: boolean;
  readonly tone?: 'default' | 'warning' | 'danger' | 'brand';
}

const TONE = {
  default: 'border-border-subtle',
  warning: 'border-border-warning/40 bg-yellow-100/40',
  danger: 'border-border-error/40 bg-red-100/40',
  brand: 'border-border-brand/40 bg-bg-brand-subtle',
} as const;

/** The white rounded panel every Figma screen is built out of. */
export const Card = ({
  padded = true,
  interactive = false,
  selected = false,
  tone = 'default',
  className,
  children,
  ...rest
}: CardProps) => (
  <div
    className={cn(
      'ui-card rounded-xl border bg-bg-surface shadow-1',
      TONE[tone],
      padded && 'p-5 md:p-6',
      interactive &&
        'transition-shadow duration-150 hover:shadow-3 focus-within:ring-4 focus-within:ring-focus',
      selected && 'border-border-brand ring-2 ring-border-brand/30',
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

export interface CardHeaderProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  readonly className?: string;
  /**
   * Where this card sits in the page outline. A card directly under the page
   * title is a level 2; one nested inside another section is a 3. Screen
   * readers navigate by these, so a skipped level is a broken outline.
   */
  readonly level?: 2 | 3 | 4;
}

export const CardHeader = ({
  title,
  description,
  actions,
  className,
  level = 2,
}: CardHeaderProps) => (
  <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
    <div className="min-w-0">
      {typeof title === 'string' ? <Heading level={level}>{title}</Heading> : title}
      {description !== undefined && (
        <Text tone="muted" className="mt-1">
          {description}
        </Text>
      )}
    </div>
    {actions !== undefined && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>
);

export const CardBody = ({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-4', className)} {...rest}>
    {children}
  </div>
);

export const CardFooter = ({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle pt-4', className)}
    {...rest}
  >
    {children}
  </div>
);
