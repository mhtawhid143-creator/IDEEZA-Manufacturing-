import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface StepperStep {
  readonly id: string;
  readonly label: string;
  readonly description?: ReactNode;
}

export interface StepperProps {
  readonly steps: readonly StepperStep[];
  /** The step the visitor is on. Everything before it reads as done. */
  readonly currentId: string;
  readonly className?: string;
  readonly label?: string;
}

/**
 * Where you are in a flow that has an order to it.
 *
 * A step that is behind reads as done, the current one is marked as current for
 * assistive technology, and the ones ahead are plainly not reached yet. It is a
 * list, not a set of links: a flow like checkout is walked, not jumped around.
 */
export const Stepper = ({
  steps,
  currentId,
  className,
  label = 'Progress',
}: StepperProps) => {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === currentId),
  );

  return (
    <nav aria-label={label} className={cn('w-full', className)}>
      <ol className="flex flex-wrap items-center gap-2 sm:gap-3">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const current = index === currentIndex;
          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  done && 'bg-bg-success text-text-on-brand',
                  current && 'bg-bg-brand text-text-on-brand',
                  !done && !current && 'border border-border bg-bg-surface text-text-tertiary',
                )}
              >
                {done ? '✓' : index + 1}
              </span>
              <span className="min-w-0">
                <span
                  {...(current ? { 'aria-current': 'step' as const } : {})}
                  className={cn(
                    'block truncate text-sm font-semibold',
                    current ? 'text-text-primary' : done ? 'text-text-secondary' : 'text-text-tertiary',
                  )}
                >
                  {step.label}
                </span>
                {step.description !== undefined && (
                  <span className="block truncate text-xs text-text-tertiary">
                    {step.description}
                  </span>
                )}
              </span>
              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    'hidden h-px flex-1 sm:block',
                    done ? 'bg-bg-success/50' : 'bg-bg-subtle',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
