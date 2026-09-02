import Link from 'next/link';
import { Accordion, Alert, Badge, buttonAppearance, Card, Icon, Text, Timeline } from '@ideeza/ui';
import { restartTourAction } from '@/app/(app)/tour/actions.js';
import { TOURS, stopHref, type Tour } from '@/data/tours.js';
import type { TourProgressMap } from '@/data/tour.js';

/**
 * The tour index: five walks, with where you are up to on each.
 *
 * Deliberately not a grid of equal cards. A tour is a route, so each row shows
 * the route — its stops in order, marked with the ones already walked — and the
 * single action that makes sense for the state it is in. The stops are what
 * somebody is choosing between, so they are the content of the row rather than a
 * count of them.
 */

const stateOf = (
  tour: Tour,
  progress: TourProgressMap,
): { readonly label: string; readonly action: string; readonly at: number } => {
  const position = progress[tour.id];
  if (position === undefined) {
    return { label: 'Not started', action: 'Start the tour', at: 0 };
  }
  if (position.finished) return { label: 'Finished', action: 'Walk it again', at: 0 };
  return {
    label: `Stop ${String(position.stopIndex + 1)} of ${String(tour.stops.length)}`,
    action: 'Continue',
    at: position.stopIndex,
  };
};

const TourRow = ({
  tour,
  progress,
}: {
  readonly tour: Tour;
  readonly progress: TourProgressMap;
}) => {
  const state = stateOf(tour, progress);
  const position = progress[tour.id];
  const finished = position?.finished === true;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <span
            aria-hidden
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-brand-subtle text-icon-brand"
          >
            <Icon name={tour.icon} size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text-primary">{tour.title}</h2>
            <Text size="sm" tone="muted" className="mt-0.5">
              {tour.promise}
            </Text>
            <p className="mt-2 text-xs text-text-tertiary">
              {tour.stops.length} stops · about {tour.minutes} minutes
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {finished ? (
            <Badge tone="success" size="md">
              <span className="inline-flex items-center gap-1">
                <Icon name="check" size={12} />
                Finished
              </span>
            </Badge>
          ) : (
            <Badge tone={position === undefined ? 'neutral' : 'brand'} size="md">
              {state.label}
            </Badge>
          )}

          {/* Walking a finished tour again has to clear the finish, which only
              the server can do, so that one is a form. Starting or resuming is
              just an address, and an address should be a link: it opens in a new
              tab, it can be sent to a colleague, and it needs no JavaScript. */}
          {finished ? (
            <form action={restartTourAction}>
              <input type="hidden" name="tourId" value={tour.id} />
              <button type="submit" className={buttonAppearance({ variant: 'secondary', size: 'sm' })}>
                {state.action}
              </button>
            </form>
          ) : (
            <Link
              href={stopHref(tour, state.at)}
              className={buttonAppearance({
                variant: position === undefined ? 'primary' : 'secondary',
                size: 'sm',
              })}
            >
              {state.action}
            </Link>
          )}
        </div>
      </div>

      <Accordion
        label={`${tour.title} stops`}
        {...(position !== undefined && !finished ? { initiallyOpen: [tour.id] } : {})}
        items={[
          {
            id: tour.id,
            title: `The ${String(tour.stops.length)} stops`,
            content: (
              <Timeline
                label={`Stops on ${tour.title}`}
                items={tour.stops.map((stop, index) => ({
                  id: stop.id,
                  label: stop.title,
                  description: (
                    <Link
                      href={stopHref(tour, index)}
                      className="text-xs text-text-link hover:underline"
                    >
                      Start here
                    </Link>
                  ),
                  state: finished
                    ? 'done'
                    : position === undefined
                      ? 'upcoming'
                      : index < position.stopIndex
                        ? 'done'
                        : index === position.stopIndex
                          ? 'current'
                          : 'upcoming',
                }))}
              />
            ),
          },
        ]}
      />
    </Card>
  );
};

export const TourIndex = ({
  progress,
  finishedJustNow,
}: {
  readonly progress: TourProgressMap;
  readonly finishedJustNow?: Tour | undefined;
}) => {
  // The one thing to do next, if there is one: a tour left part way through.
  const inProgress = TOURS.filter(
    (tour) => progress[tour.id] !== undefined && progress[tour.id]?.finished === false,
  );
  const resume = inProgress[0];
  const finishedCount = TOURS.filter((tour) => progress[tour.id]?.finished === true).length;

  return (
    <div className="flex flex-col gap-6">
      {finishedJustNow !== undefined && (
        <Alert
          tone="success"
          title={`That is ${finishedJustNow.title} walked.`}
          actions={
            <Link
              href="/tutorial"
              className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
            >
              Read the tutorial
            </Link>
          }
        >
          {finishedCount === TOURS.length
            ? 'That is every tour. The tutorial goes deeper on the parts you want in writing.'
            : 'Pick another below whenever you want it — your place in each one is kept.'}
        </Alert>
      )}

      {resume !== undefined && (
        <Card tone="brand">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-text-primary">
                You are part way through {resume.title}
              </h2>
              <Text size="sm" tone="muted" className="mt-1">
                Next:{' '}
                {resume.stops[progress[resume.id]?.stopIndex ?? 0]?.title ?? resume.stops[0]?.title}
              </Text>
            </div>
            <Link
              href={stopHref(resume, progress[resume.id]?.stopIndex ?? 0)}
              className={buttonAppearance({ variant: 'primary', size: 'md' })}
            >
              Pick it up
            </Link>
          </div>
        </Card>
      )}

      <ul className="flex flex-col gap-4">
        {TOURS.map((tour) => (
          <li key={tour.id}>
            <TourRow tour={tour} progress={progress} />
          </li>
        ))}
      </ul>
    </div>
  );
};
