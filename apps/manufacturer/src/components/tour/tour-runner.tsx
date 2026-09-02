'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button, Icon, Spotlight, Text } from '@ideeza/ui';
import { findTour, stopHref, type Tour } from '@/data/tours.js';
import { finishTourAction, recordStopAction } from '@/app/(app)/tour/actions.js';

/**
 * The tour, running over the real panel.
 *
 * Two things decide the shape of this component.
 *
 * The first is that it is mounted in the shell, above whatever screen the tour
 * has walked to, and it must never take that screen over: a stop that says
 * "open one of your orders" has to let somebody open one. So the dimming lets
 * the pointer through and this panel is the only part of it that takes a click.
 *
 * The second is how a stop moves. A stop standing on a different screen is a
 * navigation and goes through the router. A stop on the screen already showing
 * is not one: it is the same page with the light on something else, so it is a
 * state change here, and the address bar is corrected to match. That split is
 * not a preference. A router navigation whose only change is the query string
 * does not commit from a component in the shell — it fetched its payload and
 * left the address alone, which left Next and Back doing nothing at all for
 * most of the tour, whether they were buttons or real links. Holding the
 * position here is both what works and what should have been the design: the
 * walk is one continuous thing, and only the stops that change screen are
 * navigations.
 *
 * The address stays truthful either way, so a stop can be linked to and a
 * refresh keeps its place — and correcting it rather than pushing it keeps the
 * back button meaning "the screen before the tour" instead of littering the
 * history with one entry per sentence read.
 */
const positionFrom = (
  tourId: string | null,
  stopParameter: string | null,
): { readonly tour: Tour | undefined; readonly index: number } => {
  const tour = tourId === null ? undefined : findTour(tourId);
  if (tour === undefined) return { tour: undefined, index: 0 };
  const asked = Number.parseInt(stopParameter ?? '0', 10);
  const index = Number.isInteger(asked) ? Math.min(Math.max(asked, 0), tour.stops.length - 1) : 0;
  return { tour, index };
};

export const TourRunner = () => {
  const router = useRouter();
  const pathname = usePathname();
  const parameters = useSearchParams();

  const [walking, setWalking] = useState(() =>
    positionFrom(parameters.get('tour'), parameters.get('stop')),
  );

  // The address wins whenever it names somewhere else: that is how a stop on
  // another screen arrives, and how a link into the middle of a tour lands.
  const addressKey = `${parameters.get('tour') ?? ''}:${parameters.get('stop') ?? ''}`;
  const adopted = useRef(addressKey);
  useEffect(() => {
    if (adopted.current === addressKey) return;
    adopted.current = addressKey;
    setWalking(positionFrom(parameters.get('tour'), parameters.get('stop')));
  }, [addressKey, parameters]);

  const { tour, index } = walking;

  // Every arrival at a stop is written down, so closing the tab loses at most
  // the stop being read. Guarded so React's development double-render does not
  // write the same stop twice.
  const written = useRef('');
  useEffect(() => {
    if (tour === undefined) return;
    const at = `${tour.id}:${String(index)}`;
    if (written.current === at) return;
    written.current = at;
    void recordStopAction(tour.id, index);
  }, [tour, index]);

  const addressOf = useCallback(
    // A stop with no path of its own happens wherever the walker already
    // stands: the tour asked them to open one of their own orders, and it
    // cannot know which one.
    (target: number): string => (tour === undefined ? pathname : stopHref(tour, target, pathname)),
    [tour, pathname],
  );

  const leave = useCallback(() => {
    setWalking({ tour: undefined, index: 0 });
    const search = new URLSearchParams(parameters.toString());
    search.delete('tour');
    search.delete('stop');
    const query = search.toString();
    window.history.replaceState({}, '', query === '' ? pathname : `${pathname}?${query}`);
  }, [parameters, pathname]);

  const go = useCallback(
    (target: number) => {
      if (tour === undefined || target < 0) return;

      if (target >= tour.stops.length) {
        // Recorded before leaving, so the guide it lands on already knows.
        void finishTourAction(tour.id).then(() => {
          router.push(`/tour?finished=${tour.id}`);
        });
        return;
      }

      const address = addressOf(target);
      const [path] = address.split('?');
      if (path !== pathname) {
        router.push(address);
        return;
      }

      setWalking({ tour, index: target });
      window.history.replaceState({}, '', address);
    },
    [tour, addressOf, pathname, router],
  );

  // The arrow keys, because a tour is a sequence and that is what they are for.
  // Ignored while somebody is typing, so a tour left open does not eat the keys
  // meant for a form on the screen behind it.
  useEffect(() => {
    if (tour === undefined) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (event.target as HTMLElement | null)?.tagName ?? '',
      );
      if (inField) return;
      if (event.key === 'ArrowRight') go(index + 1);
      if (event.key === 'ArrowLeft') go(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tour, index, go]);

  const stop = tour?.stops[index];
  if (tour === undefined || stop === undefined) return null;

  const last = index === tour.stops.length - 1;
  const walked = ((index + 1) / tour.stops.length) * 100;

  return (
    <Spotlight
      target={stop.target}
      {...(stop.place === undefined ? {} : { place: stop.place })}
      label={`${tour.title}, stop ${String(index + 1)} of ${String(tour.stops.length)}`}
      onDismiss={leave}
    >
      {(found) => (
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            {/* Which tour and where in it, on one line. Not styled as a label
                above the heading: it is the answer to "where am I", which is a
                fact somebody mid-tour needs, so it reads as a sentence. */}
            <p className="min-w-0 text-2xs text-text-tertiary">
              {tour.title} · stop {index + 1} of {tour.stops.length}
            </p>
            <button
              type="button"
              aria-label="Leave the tour"
              onClick={leave}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-icon-secondary transition-colors duration-fast hover:bg-bg-subtle hover:text-icon focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus"
            >
              <Icon name="close" size={16} />
            </button>
          </div>

          {/* How far along, as a measure rather than a decoration: it is the one
              thing somebody mid-tour wants to know that the words do not say. */}
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={tour.stops.length}
            aria-valuenow={index + 1}
            aria-label="Tour progress"
            className="h-1 w-full overflow-hidden rounded-full bg-bg-subtle"
          >
            <div
              className="h-full rounded-full bg-bg-brand transition-all duration-slow ease-decelerate motion-reduce:transition-none"
              style={{ width: `${String(walked)}%` }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <h2 className="text-base font-semibold text-text-primary">{stop.title}</h2>
            <Text size="sm" tone="muted">
              {stop.body}
            </Text>

            {/* The honest state: the stop points at something this shop has not
                got yet, or at a panel behind a tab nobody has opened. Saying
                which, and what would be there, teaches what the light would
                have taught. */}
            {!found && stop.whenMissing !== undefined && (
              <div className="mt-1 flex gap-2 rounded-lg bg-bg-info-subtle p-3">
                <Icon name="info" size={16} className="mt-0.5 shrink-0 text-icon-blue" />
                <Text size="xs" tone="muted">
                  {stop.whenMissing}
                </Text>
              </div>
            )}
          </div>

          <div className="mt-1 flex items-center justify-between gap-2">
            {/* Said once, quietly: the arrow keys work, and somebody reading six
                stops with the mouse will not discover that on their own. */}
            <p className="hidden text-2xs text-text-tertiary sm:block">Arrow keys move</p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => go(index - 1)}
                disabled={index === 0}
              >
                Back
              </Button>
              <Button
                variant="primary"
                size="xs"
                onClick={() => go(index + 1)}
                {...(last ? { trailingIcon: <Icon name="check" size={14} /> } : {})}
              >
                {last ? 'Finish' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Spotlight>
  );
};
