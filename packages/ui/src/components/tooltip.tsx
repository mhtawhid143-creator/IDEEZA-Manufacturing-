'use client';

import { useId, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface TooltipProps {
  readonly content: ReactNode;
  readonly children: ReactNode;
  readonly side?: 'top' | 'bottom';
  readonly className?: string;
}

/**
 * Hover and focus both open it, so the hint is reachable from the keyboard. The
 * trigger keeps the description through aria-describedby rather than relying on
 * the tooltip being seen.
 */
export const Tooltip = ({ content, children, side = 'top', className }: TooltipProps) => {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className={cn('relative inline-flex', className)}>
      <span
        aria-describedby={id}
        tabIndex={0}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
      >
        {children}
      </span>
      <span
        role="tooltip"
        id={id}
        className={cn(
          'pointer-events-none absolute left-1/2 z-popover w-max max-w-64 -translate-x-1/2 rounded-lg bg-bg-inverse px-3 py-2 text-xs font-medium text-text-inverse shadow-2 transition-opacity',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          open ? 'opacity-100' : 'opacity-0',
        )}
        hidden={!open}
      >
        {content}
      </span>
    </span>
  );
};
