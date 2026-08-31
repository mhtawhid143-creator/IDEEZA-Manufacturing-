import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { Button } from './button.js';
import { Icon } from './icon.js';
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

/**
 * Nothing here yet, and what to do about it. M48 frames the absence in the
 * plain card surface — a solid subtle border, not an error — with the icon
 * held in an 80px neutral circle.
 */
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
      'ui-state flex flex-col items-center justify-center gap-2.5 px-6 text-center',
      framed
        ? 'rounded-md border border-border-subtle bg-bg-surface py-12'
        : 'py-8',
      className,
    )}
  >
    {icon !== undefined && (
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-bg-subtle text-icon">
        {icon}
      </div>
    )}
    <div className="flex flex-col items-center gap-1">
      <Heading level={2} className="text-2xl">
        {title}
      </Heading>
      {description !== undefined && (
        <Text className="max-w-md">
          {description}
        </Text>
      )}
    </div>
    {action !== undefined && <div className="mt-2">{action}</div>}
  </div>
);

export interface LoadingStateProps {
  readonly label?: string;
  readonly className?: string;
}

export const LoadingState = ({ label = 'Loading', className }: LoadingStateProps) => (
  <div
    className={cn('flex items-center justify-center gap-3 px-6 py-12 text-text-tertiary', className)}
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

/**
 * M49 keeps the card itself neutral — the failure lives in the error-subtle
 * icon badge, not in the frame, so a failed panel does not shout across the
 * whole page. Retry is the primary action because it is the way forward.
 */
export const ErrorState = ({
  title = 'Something went wrong',
  description = 'The page could not be loaded. Try again in a moment.',
  onRetry,
  className,
}: ErrorStateProps) => (
  <div
    role="alert"
    className={cn(
      'ui-state flex flex-col items-center justify-center gap-2.5 rounded-md border border-border-subtle bg-bg-surface px-6 py-12 text-center',
      className,
    )}
  >
    <div aria-hidden className="flex h-20 w-20 items-center justify-center rounded-full bg-bg-error-subtle text-icon-error">
      <Icon name="alert" size={40} />
    </div>
    <div className="flex flex-col items-center gap-1">
      <Heading level={2} className="text-2xl">
        {title}
      </Heading>
      <Text className="max-w-md">
        {description}
      </Text>
    </div>
    {onRetry !== undefined && (
      <Button variant="primary" onClick={onRetry} className="mt-2">
        Try again
      </Button>
    )}
  </div>
);

export interface SkeletonProps {
  readonly className?: string;
  readonly rounded?: 'sm' | 'md' | 'full';
}

// A21 Skeleton is the subtle surface in the system's shapes: a text line sits
// on the small radius, a block on the large one, an avatar on the circle.
export const Skeleton = ({ className, rounded = 'md' }: SkeletonProps) => (
  <span
    aria-hidden
    className={cn(
      'block animate-pulse bg-bg-subtle',
      rounded === 'full' ? 'rounded-full' : rounded === 'sm' ? 'rounded' : 'rounded-lg',
      className,
    )}
  />
);

export interface SkeletonRowsProps {
  readonly rows?: number;
  readonly className?: string;
}

/**
 * The list-item layout of M51: each row is a bordered surface card holding an
 * avatar circle, two text lines and a trailing control, so a loading list has
 * the same rhythm as the list it stands in for.
 */
export const SkeletonRows = ({ rows = 3, className }: SkeletonRowsProps) => (
  <div className={cn('flex flex-col gap-3', className)} role="status" aria-label="Loading">
    {Array.from({ length: rows }, (_, index) => (
      <div
        key={index}
        className="flex items-center gap-3 rounded-md border border-border-subtle bg-bg-surface px-4 py-3"
      >
        <Skeleton rounded="full" className="h-8 w-8 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton rounded="sm" className="h-3 w-2/5" />
          <Skeleton rounded="sm" className="h-2 w-1/5" />
        </div>
        <Skeleton rounded="full" className="h-6 w-6 shrink-0" />
      </div>
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
      'rounded-xl border border-dashed border-border-brand bg-bg-brand-subtle px-6 py-10 text-center',
      className,
    )}
  >
    <p className="text-xs font-semibold uppercase tracking-caps text-text-brand">
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
