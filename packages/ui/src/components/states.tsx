import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { Button } from './button.js';
import { Spinner } from './spinner.js';
import { Heading, Text } from './typography.js';

export interface EmptyStateProps {
  readonly title: string;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
  readonly icon?: ReactNode;
  /**
   * Whether it draws its own outline. Inside a card the card is already the
   * frame, and a frame inside a frame is two boxes for one absence. The
   * stylesheet takes the outline away in that case either way; saying it here
   * means the markup says it too.
   */
  readonly framed?: boolean | undefined;
  readonly className?: string;
}

/** Nothing here yet, and what to do about it. */
export const EmptyState = ({
  title,
  description,
  action,
  icon,
  framed = true,
  className,
}: EmptyStateProps) => (
  <div
    className={cn(
      'ids-state flex flex-col items-center justify-center gap-3 px-6 text-center',
      framed
        ? 'rounded-xl border border-dashed border-line-strong bg-surface py-12'
        : 'py-8',
      className,
    )}
  >
    {icon !== undefined && <div className="text-muted">{icon}</div>}
    <Heading level={2}>{title}</Heading>
    {description !== undefined && (
      <Text tone="muted" className="max-w-md">
        {description}
      </Text>
    )}
    {action !== undefined && <div className="mt-2">{action}</div>}
  </div>
);

export interface LoadingStateProps {
  readonly label?: string;
  readonly className?: string;
}

export const LoadingState = ({ label = 'Loading', className }: LoadingStateProps) => (
  <div
    className={cn('flex items-center justify-center gap-3 px-6 py-12 text-muted', className)}
    role="status"
    aria-live="polite"
  >
    <Spinner size="md" />
    <span className="text-sm">{label}…</span>
  </div>
);

export interface ErrorStateProps {
  readonly title?: string;
  readonly description?: ReactNode;
  readonly onRetry?: () => void;
  readonly className?: string;
}

export const ErrorState = ({
  title = 'Something went wrong',
  description = 'The page could not be loaded. Try again in a moment.',
  onRetry,
  className,
}: ErrorStateProps) => (
  <div
    role="alert"
    className={cn(
      'ids-state flex flex-col items-center justify-center gap-3 rounded-xl border border-danger/30 bg-danger-weak/40 px-6 py-12 text-center',
      className,
    )}
  >
    <Heading level={2}>{title}</Heading>
    <Text tone="muted" className="max-w-md">
      {description}
    </Text>
    {onRetry !== undefined && (
      <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">
        Try again
      </Button>
    )}
  </div>
);

export interface SkeletonProps {
  readonly className?: string;
  readonly rounded?: 'sm' | 'md' | 'full';
}

export const Skeleton = ({ className, rounded = 'md' }: SkeletonProps) => (
  <span
    aria-hidden
    className={cn(
      'block animate-pulse bg-raised',
      rounded === 'full' ? 'rounded-full' : rounded === 'sm' ? 'rounded-sm' : 'rounded-md',
      className,
    )}
  />
);

export interface SkeletonRowsProps {
  readonly rows?: number;
  readonly className?: string;
}

export const SkeletonRows = ({ rows = 3, className }: SkeletonRowsProps) => (
  <div className={cn('flex flex-col gap-3', className)} role="status" aria-label="Loading">
    {Array.from({ length: rows }, (_, index) => (
      <Skeleton key={index} className="h-14 w-full" />
    ))}
  </div>
);

/**
 * Marks a route that exists so the shell can be navigated, but whose feature is
 * scheduled for a later task. It says so plainly rather than looking finished.
 */
export interface NotBuiltYetProps {
  readonly title: string;
  readonly plannedIn: string;
  readonly children?: ReactNode;
  readonly className?: string;
}

export const NotBuiltYet = ({ title, plannedIn, children, className }: NotBuiltYetProps) => (
  <section
    aria-label={`${title} — not implemented yet`}
    className={cn(
      'rounded-xl border border-dashed border-brand/40 bg-brand-surface px-6 py-10 text-center',
      className,
    )}
  >
    <p className="text-xs font-semibold uppercase tracking-wide text-brand">
      Not implemented yet
    </p>
    <Heading level={2} className="mt-2">
      {title}
    </Heading>
    <Text tone="muted" className="mx-auto mt-2 max-w-lg">
      This screen is part of {plannedIn}. The route and the shell exist so the
      navigation can be reviewed; the feature itself is not built.
    </Text>
    {children !== undefined && <div className="mt-4">{children}</div>}
  </section>
);
