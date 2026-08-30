'use client';

import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { Badge } from './badge.js';

export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly count?: number | undefined;
  readonly href?: string | undefined;
  readonly disabled?: boolean;
}

export interface TabsProps {
  readonly items: readonly TabItem[];
  readonly activeId: string;
  readonly onSelect?: (id: string) => void;
  /** Renders links instead of buttons, for tabs that are real routes. */
  readonly linkComponent?: (props: {
    readonly href: string;
    readonly className: string;
    readonly children: ReactNode;
    readonly 'aria-current': 'page' | undefined;
  }) => ReactNode;
  readonly className?: string;
  readonly label?: string;
}

const tabClasses = (active: boolean): string =>
  cn(
    'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
    active ? 'bg-bg-brand-subtle text-text-brand' : 'text-text-secondary hover:bg-bg-surface-raised',
  );

/**
 * The pill tab row from the Figma screens.
 *
 * When a tab is a route it renders as a link with aria-current, which keeps the
 * browser back button working; otherwise it is a tab list with proper roles.
 */
export const Tabs = ({
  items,
  activeId,
  onSelect,
  linkComponent,
  className,
  label = 'Sections',
}: TabsProps) => {
  const isRouted = linkComponent !== undefined && items.every((item) => item.href !== undefined);

  const content = items.map((item) => {
    const active = item.id === activeId;
    const inner = (
      <>
        {item.label}
        {item.count !== undefined && (
          <Badge tone={active ? 'brand' : 'neutral'}>
            {String(item.count).padStart(2, '0')}
          </Badge>
        )}
      </>
    );

    if (isRouted && item.href !== undefined) {
      return (
        <span key={item.id}>
          {linkComponent({
            href: item.href,
            className: tabClasses(active),
            children: inner,
            'aria-current': active ? 'page' : undefined,
          })}
        </span>
      );
    }

    return (
      <button
        key={item.id}
        type="button"
        role="tab"
        id={`tab-${item.id}`}
        aria-selected={active}
        aria-controls={`panel-${item.id}`}
        disabled={item.disabled}
        onClick={() => onSelect?.(item.id)}
        className={cn(tabClasses(active), item.disabled === true && 'cursor-not-allowed opacity-50')}
      >
        {inner}
      </button>
    );
  });

  if (isRouted) {
    return (
      <nav aria-label={label} className={cn('flex flex-wrap items-center gap-1', className)}>
        {content}
      </nav>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('flex flex-wrap items-center gap-1', className)}
    >
      {content}
    </div>
  );
};

export interface TabPanelProps {
  readonly id: string;
  readonly activeId: string;
  readonly children: ReactNode;
  readonly className?: string;
}

export const TabPanel = ({ id, activeId, children, className }: TabPanelProps) =>
  id === activeId ? (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
      className={cn('focus-visible:outline-none', className)}
    >
      {children}
    </div>
  ) : null;
