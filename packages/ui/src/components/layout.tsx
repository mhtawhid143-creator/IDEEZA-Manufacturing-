import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { Heading, Text } from './typography.js';

export const Container = ({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mx-auto w-full max-w-content px-4 md:px-gutter', className)} {...rest}>
    {children}
  </div>
);

export interface PageHeaderProps {
  readonly title: string;
  readonly description?: ReactNode;
  readonly breadcrumbs?: ReactNode;
  readonly actions?: ReactNode;
  readonly className?: string;
}

export const PageHeader = ({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) => (
  <header className={cn('flex flex-col gap-3', className)}>
    {breadcrumbs}
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <Heading level={1}>{title}</Heading>
        {description !== undefined && (
          <Text tone="muted" className="mt-1">
            {description}
          </Text>
        )}
      </div>
      {actions !== undefined && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  </header>
);

export interface AvatarProps {
  readonly name: string;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly imageUrl?: string | undefined;
  readonly className?: string;
}

const AVATAR_SIZE = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-base' } as const;

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter((part) => part !== '')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export const Avatar = ({ name, size = 'md', imageUrl, className }: AvatarProps) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-brand-subtle font-semibold text-text-brand',
      AVATAR_SIZE[size],
      className,
    )}
  >
    {imageUrl === undefined ? (
      <span aria-hidden>{initialsOf(name)}</span>
    ) : (
      // A plain img keeps the design system independent of any framework
      // image component; the app supplies an already sized avatar url.
      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
    )}
    <span className="sr-only">{name}</span>
  </span>
);

export interface PaginationProps {
  readonly page: number;
  readonly pageCount: number;
  readonly onChange?: (page: number) => void;
  readonly className?: string;
}

/** The numbered pager under the Figma tables. */
export const Pagination = ({ page, pageCount, onChange, className }: PaginationProps) => {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1).filter(
    (candidate) =>
      candidate === 1 ||
      candidate === pageCount ||
      Math.abs(candidate - page) <= 1,
  );

  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-end gap-1', className)}>
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onChange?.(page - 1)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-bg-surface-raised disabled:cursor-not-allowed disabled:text-text-disabled"
      >
        ‹
      </button>
      {pages.map((candidate, index) => {
        const previous = pages[index - 1];
        const gap = previous !== undefined && candidate - previous > 1;
        return (
          <span key={candidate} className="flex items-center gap-1">
            {gap && <span className="px-1 text-text-tertiary">…</span>}
            <button
              type="button"
              aria-current={candidate === page ? 'page' : undefined}
              onClick={() => onChange?.(candidate)}
              className={cn(
                'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm',
                candidate === page
                  ? 'bg-bg-brand-subtle font-semibold text-text-brand'
                  : 'text-text-secondary hover:bg-bg-surface-raised',
              )}
            >
              {candidate}
            </button>
          </span>
        );
      })}
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onChange?.(page + 1)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-bg-surface-raised disabled:cursor-not-allowed disabled:text-text-disabled"
      >
        ›
      </button>
    </nav>
  );
};

export const Divider = ({ className, ...rest }: HTMLAttributes<HTMLHRElement>) => (
  <hr className={cn('border-0 border-t border-border-subtle', className)} {...rest} />
);
