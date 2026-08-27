import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export type TimelineState = 'done' | 'current' | 'upcoming';

export interface TimelineItem {
  readonly id: string;
  readonly label: string;
  readonly description?: ReactNode;
  /** Right-hand column: when it happened, or what it is waiting for. */
  readonly meta?: ReactNode;
  readonly state: TimelineState;
  /** Detail that belongs inside the step, such as the tasks it is made of. */
  readonly children?: ReactNode;
}

export interface TimelineProps {
  readonly items: readonly TimelineItem[];
  readonly label?: string;
  readonly className?: string;
}

/**
 * A sequence that has already partly happened.
 *
 * The horizontal Stepper is for a flow the visitor walks; this is for one they
 * watch: a step is done, happening now, or still ahead, and the row carries the
 * date it moved. The marker is decorative — the state is in the text, so it
 * survives a screen reader and a monochrome print alike.
 */
export const Timeline = ({ items, label = 'Progress', className }: TimelineProps) => (
  <ol aria-label={label} className={cn('flex flex-col', className)}>
    {items.map((item, index) => {
      const last = index === items.length - 1;
      return (
        <li key={item.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              aria-hidden
              className={cn(
                'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                item.state === 'done' && 'bg-brand text-on-brand',
                item.state === 'current' && 'bg-brand-weak text-brand ring-2 ring-brand',
                item.state === 'upcoming' && 'border border-line-strong bg-surface text-muted',
              )}
            >
              {item.state === 'done' ? '✓' : index + 1}
            </span>
            {!last && (
              <span
                aria-hidden
                className={cn(
                  'w-px flex-1',
                  item.state === 'done' ? 'bg-brand/40' : 'bg-line',
                )}
              />
            )}
          </div>

          <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-6')}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p
                {...(item.state === 'current' ? { 'aria-current': 'step' as const } : {})}
                className={cn(
                  'text-sm font-semibold',
                  item.state === 'upcoming' ? 'text-muted' : 'text-heading',
                )}
              >
                {item.label}
                <span className="sr-only">
                  {item.state === 'done'
                    ? ' — done'
                    : item.state === 'current'
                      ? ' — happening now'
                      : ' — not started'}
                </span>
              </p>
              {item.meta !== undefined && (
                <span className="text-xs text-muted">{item.meta}</span>
              )}
            </div>
            {item.description !== undefined && (
              <p className="mt-0.5 text-sm text-muted">{item.description}</p>
            )}
            {item.children !== undefined && <div className="mt-2">{item.children}</div>}
          </div>
        </li>
      );
    })}
  </ol>
);
