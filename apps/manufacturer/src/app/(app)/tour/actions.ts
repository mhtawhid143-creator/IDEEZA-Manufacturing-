'use server';

import { redirect } from 'next/navigation';
import { tourMoveSchema } from '@ideeza/types';
import { finishTour, saveStop, startTour } from '@/data/tour.js';
import { findTour, stopHref } from '@/data/tours.js';
import { requireManufacturer } from '@/lib/auth.js';

/**
 * The three things walking a tour writes down.
 *
 * The runner calls `recordStopAction` on every move rather than once at the
 * end, so somebody who closes the tab in the middle of a tour comes back to
 * where they were and not to the beginning.
 *
 * The gate is `requireManufacturer` like every other action here, and progress
 * is written against `actor.userId` — never against an id the browser sent, or
 * one person could park another person's tour on stop one.
 */

export interface TourState {
  readonly saved: boolean;
  readonly error?: string | undefined;
}

const done: TourState = { saved: true };

export const startTourAction = async (tourId: string): Promise<TourState> => {
  const actor = await requireManufacturer('/tour');
  const parsed = tourMoveSchema.safeParse({ tourId, stopIndex: 0 });
  if (!parsed.success) return { saved: false, error: 'That is not a tour.' };

  const result = await startTour(actor.userId, parsed.data.tourId);
  return result.ok ? done : { saved: false, error: result.message };
};

/**
 * Walks a finished tour again, from a form on the index.
 *
 * A form rather than a link because starting again has to clear the finish, and
 * a link that changed stored state would be a link the browser could follow by
 * itself. It ends on the first stop, which is where the walker expects to be.
 */
export const restartTourAction = async (form: FormData): Promise<void> => {
  const actor = await requireManufacturer('/tour');
  const asked = form.get('tourId');
  const parsed = tourMoveSchema.safeParse({
    tourId: typeof asked === 'string' ? asked : '',
    stopIndex: 0,
  });
  if (!parsed.success) redirect('/tour');

  const result = await startTour(actor.userId, parsed.data.tourId);
  if (!result.ok) redirect('/tour');

  const tour = findTour(parsed.data.tourId);
  redirect(tour === undefined ? '/tour' : stopHref(tour, 0));
};

export const recordStopAction = async (
  tourId: string,
  stopIndex: number,
): Promise<TourState> => {
  const actor = await requireManufacturer('/tour');
  const parsed = tourMoveSchema.safeParse({ tourId, stopIndex });
  if (!parsed.success) return { saved: false, error: 'That is not a stop on a tour.' };

  const result = await saveStop(actor.userId, parsed.data.tourId, parsed.data.stopIndex);
  return result.ok ? done : { saved: false, error: result.message };
};

export const finishTourAction = async (tourId: string): Promise<TourState> => {
  const actor = await requireManufacturer('/tour');
  const parsed = tourMoveSchema.safeParse({ tourId, stopIndex: 0 });
  if (!parsed.success) return { saved: false, error: 'That is not a tour.' };

  const result = await finishTour(actor.userId, parsed.data.tourId);
  return result.ok ? done : { saved: false, error: result.message };
};
