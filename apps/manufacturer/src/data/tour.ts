import { randomBytes } from 'node:crypto';
import { database } from '@/lib/db.js';
import { findTour } from './tours.js';

/**
 * How far a person has walked each tour.
 *
 * Small enough to be one file: a row per person per tour, read as a whole for
 * the index and written one stop at a time by the runner. Every function takes
 * the walker's own `userId` and scopes its first statement by it — progress is
 * personal, and a shop-mate's position is none of anybody's business.
 *
 * The stop index is checked against the tour's real length on the way in rather
 * than trusted. It is read back as an array index by the runner, so an index
 * past the end would not fail loudly: it would render a coachmark with no words
 * in it, which is worse than a refusal.
 */

export interface TourOutcome {
  readonly ok: boolean;
  readonly message?: string | undefined;
}

const ok: TourOutcome = { ok: true };
const no = (message: string): TourOutcome => ({ ok: false, message });

export interface TourPosition {
  readonly stopIndex: number;
  readonly finished: boolean;
  readonly startedAt: Date;
}

/** Progress by tour id. A tour nobody has started is absent, not zero. */
export type TourProgressMap = Readonly<Record<string, TourPosition>>;

const identifier = (): string => `tour_${randomBytes(9).toString('hex')}`;

/**
 * Refuses anything that is not a real stop of a real tour.
 *
 * Returned as a message rather than thrown: this is reached from a server
 * action, and the boundary there answers with a typed state instead of throwing
 * at the person using the panel.
 */
const checkStop = (tourId: string, stopIndex: number): TourOutcome => {
  const tour = findTour(tourId);
  if (tour === undefined) return no('That tour does not exist.');
  if (!Number.isInteger(stopIndex)) return no('A stop is a whole number.');
  if (stopIndex < 0 || stopIndex >= tour.stops.length) {
    return no(`That tour has ${String(tour.stops.length)} stops.`);
  }
  return ok;
};

export const readProgress = async (userId: string): Promise<TourProgressMap> => {
  const rows = await database().tourProgress.findMany({
    where: { userId },
    select: { tourId: true, stopIndex: true, completedAt: true, startedAt: true },
  });

  const progress: Record<string, TourPosition> = {};
  for (const row of rows) {
    const tour = findTour(row.tourId);
    // A tour that has since been rewritten away leaves its rows behind. They are
    // ignored rather than deleted: the walker may have finished it, and a future
    // release renaming a tour back would find their place still there.
    if (tour === undefined) continue;
    progress[row.tourId] = {
      // Clamped as well as checked on the way in, because a tour that loses a
      // stop in a later release leaves rows pointing past its new end.
      stopIndex: Math.min(row.stopIndex, tour.stops.length - 1),
      finished: row.completedAt !== null,
      startedAt: row.startedAt,
    };
  }
  return progress;
};

/**
 * Begins a tour, or begins it again.
 *
 * Starting a finished tour clears the finish and returns to the first stop,
 * because that is what the index's "Take it again" means. It stays one row: the
 * unique index on person and tour is what makes the resume button readable.
 */
export const startTour = async (userId: string, tourId: string): Promise<TourOutcome> => {
  const refusal = checkStop(tourId, 0);
  if (!refusal.ok) return refusal;

  await database().tourProgress.upsert({
    where: { userId_tourId: { userId, tourId } },
    update: { stopIndex: 0, completedAt: null, startedAt: new Date() },
    create: { id: identifier(), userId, tourId, stopIndex: 0 },
  });
  return ok;
};

/**
 * Records the stop somebody has walked to.
 *
 * Written on every move rather than at the end, so closing the tab mid-tour
 * loses one stop at worst. It does not touch `completedAt`: moving back onto an
 * earlier stop of a tour already finished should not un-finish it.
 */
export const saveStop = async (
  userId: string,
  tourId: string,
  stopIndex: number,
): Promise<TourOutcome> => {
  const refusal = checkStop(tourId, stopIndex);
  if (!refusal.ok) return refusal;

  await database().tourProgress.upsert({
    where: { userId_tourId: { userId, tourId } },
    update: { stopIndex },
    create: { id: identifier(), userId, tourId, stopIndex },
  });
  return ok;
};

/** Marks a tour walked to the end, and parks the position on its last stop. */
export const finishTour = async (userId: string, tourId: string): Promise<TourOutcome> => {
  const tour = findTour(tourId);
  if (tour === undefined) return no('That tour does not exist.');
  const lastStop = tour.stops.length - 1;

  await database().tourProgress.upsert({
    where: { userId_tourId: { userId, tourId } },
    update: { stopIndex: lastStop, completedAt: new Date() },
    create: {
      id: identifier(),
      userId,
      tourId,
      stopIndex: lastStop,
      completedAt: new Date(),
    },
  });
  return ok;
};
