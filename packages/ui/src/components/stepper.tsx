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
 * Where you are in a flow that has an order to it — M33 Stepper, horizontal
 * numbered: a 32px brand circle above each label, joined by 2px connectors
 * that only turn brand once the step before them is done. Steps ahead sit on
 * the subtle surface behind the default border.
 *
 * A step that is behind reads as done, the current one is marked as current
 * for assistive technology, and the ones ahead are plainly not reached yet.
 * It is a list, not a set of links: a flow like checkout is walked, not
 * jumped around.
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
      <ol className="flex items-start gap-1.5">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const current = index === currentIndex;
          return (
            <li
              key={step.id}
              className={cn(
                'flex min-w-0 items-start gap-1.5',
                index < steps.length - 1 && 'flex-1',
              )}
            >
              <span className="flex min-w-0 flex-col items-center gap-1 text-center">
                <span
                  aria-hidden
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-fast',
                    done || current
                      ? 'bg-bg-brand text-text-on-brand'
                      : 'border border-border bg-bg-subtle text-text-secondary',
                  )}
                >
                  {done ? '\u2713' : index + 1}
                </span>
                <span
                  {...(current ? { 'aria-current': 'step' as const } : {})}
                  className={cn(
                    'block max-w-full truncate text-sm',
                    current
                      ? 'font-semibold text-text-primary'
                      : done
                        ? 'font-medium text-text-primary'
                        : 'font-medium text-text-secondary',
                  )}
                >
                  {step.label}
                </span>
                {step.description !== undefined && (
                  <span className="block max-w-full truncate text-xs text-text-tertiary">
                    {step.description}
                  </span>
                )}
              </span>
              {/* The connector is centred on the 32px circle and, like the
                  circle, only reads done once the step before it is done. */}
              {index < steps.length - 1 && (
                <span aria-hidden className="hidden h-8 min-w-6 flex-1 items-center sm:flex">
                  <span
                    className={cn(
                      'h-0.5 w-full rounded-full',
                      done ? 'bg-bg-brand' : 'bg-border',
                    )}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
