import { Fragment, type ReactNode } from 'react';
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

/**
 * What an order's own state does to the track it is drawn on.
 *
 * `running` is ordinary progress, `finished` is the whole pipeline walked,
 * `late` is past the date the shop quoted, `held` is a case open on the order
 * so work is paused, and `stopped` is cancelled or refunded — nothing more will
 * happen. The last three are not decoration: an order that has stopped must not
 * read like one that is progressing.
 */
export type StageTrackState = 'running' | 'finished' | 'late' | 'held' | 'stopped';

export interface StageTrackProps {
  /** How many stages this order's own pipeline has. */
  readonly total: number;
  /** How many of them are behind it. */
  readonly completed: number;
  /** The stage it is on, or null once there is none left. */
  readonly stageLabel: string | null;
  readonly state?: StageTrackState;
  readonly className?: string;
}

/** The words that go with each state, so the state is never colour alone. */
const TRACK_STATE: Record<
  StageTrackState,
  { readonly word: string | null; readonly spoken: string | null; readonly fill: string }
> = {
  running: { word: null, spoken: null, fill: 'bg-bg-brand' },
  finished: { word: null, spoken: null, fill: 'bg-bg-success' },
  late: { word: 'late', spoken: 'past the quoted date', fill: 'bg-bg-error' },
  held: { word: 'held', spoken: 'held while a case is open', fill: 'bg-bg-warning' },
  stopped: { word: 'stopped', spoken: 'work has stopped', fill: 'bg-icon' },
};

/**
 * Where one order has got to — M33 Stepper, horizontal dotted: 12px full-radius
 * dots joined by 2px connectors, the dots behind and the current one filled,
 * the ones ahead on the subtle surface behind the default border.
 *
 * One dot per stage in *this* order's pipeline, so a six-stage print job and a
 * ten-stage board cannot look alike at the same fill; and the count is written
 * out beside it, because a length on its own has no scale. A continuous bar
 * could say neither thing.
 */
export const StageTrack = ({
  total,
  completed,
  stageLabel,
  state = 'running',
  className,
}: StageTrackProps) => {
  // Nothing can be past the end of a pipeline, and a pipeline with no stages
  // has nothing done in it — a bad row must not draw a negative track.
  const steps = Math.max(0, Math.trunc(total));
  const done = Math.min(Math.max(0, Math.trunc(completed)), steps);
  const tone = TRACK_STATE[state];
  /*
   * An order with no stage left is finished; an order with no stage *yet* is
   * not. A held order has neither, and calling it "Finished · 0/10" was the
   * kind of false reassurance the whole ticket is about.
   */
  const stage = stageLabel ?? (done >= steps && steps > 0 ? 'Finished' : 'Not started');
  const count = `${done}/${steps}`;
  const caption = tone.word === null ? `${stage} · ${count}` : `${stage} · ${count} · ${tone.word}`;

  return (
    <div className={cn('min-w-[156px]', className)}>
      <div
        role="img"
        aria-label={
          tone.spoken === null
            ? `${stage}, stage ${done} of ${steps}`
            : `${stage}, stage ${done} of ${steps}, ${tone.spoken}`
        }
        className="flex items-center gap-1.5"
      >
        {Array.from({ length: steps }, (_unused, index) => {
          const passed = index < done;
          const current = index === done;
          return (
            <Fragment key={index}>
              {index > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    'h-0.5 min-w-1 flex-1 rounded-xs',
                    passed ? tone.fill : 'bg-border',
                  )}
                />
              )}
              <span
                aria-hidden
                data-step={passed ? 'done' : current ? 'current' : 'upcoming'}
                className={cn(
                  'h-3 w-3 shrink-0 rounded-full',
                  passed || current ? tone.fill : 'border border-border bg-bg-subtle',
                )}
              />
            </Fragment>
          );
        })}
      </div>
      <span className="mt-1 block text-xs text-text-tertiary">{caption}</span>
    </div>
  );
};
