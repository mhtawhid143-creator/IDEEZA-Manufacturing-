import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import type * as Tour from '../src/data/tour.js';
import { TOURS } from '../src/data/tours.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import { startTestDatabase, type TestDatabase } from '../../../packages/db/test-support/index.js';

/**
 * How far somebody has walked a tour, from below.
 *
 * The things worth pinning: progress is one row per person per tour and never a
 * second row; a stop index can only ever name a stop the tour actually has,
 * because the runner reads it back as an array index and an index past the end
 * would show an empty coachmark; finishing and standing on the last stop stay
 * distinguishable; and one person's progress is invisible to another, which is
 * the same ownership rule every other read in this app follows.
 */
let database: TestDatabase;
let prisma: PrismaClient;
let tour: typeof Tour;

const FIRST = TOURS[0]?.id ?? 'shop-setup';
const LAST_STOP = (TOURS[0]?.stops.length ?? 1) - 1;

let walker = '';
let somebodyElse = '';

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  tour = await import('../src/data/tour.js');

  const member = await prisma.manufacturerMember.findFirst({
    where: { manufacturerId: 'seed_mfr_a' },
  });
  walker = member?.userId ?? '';
  // Anybody who is not the walker. Not a member of another shop on purpose:
  // progress belongs to the person, so the rule under test holds between any
  // two accounts and does not depend on which shop either of them is in.
  const other = await prisma.user.findFirst({ where: { id: { not: walker } } });
  somebodyElse = other?.id ?? '';
  expect(walker).not.toBe('');
  expect(somebodyElse).not.toBe('');
  expect(somebodyElse).not.toBe(walker);
});

afterAll(async () => {
  await database?.stop();
});

describe('walking a tour', () => {
  it('starts at the first stop and keeps one row however often it is started', async () => {
    const started = await tour.startTour(walker, FIRST);
    expect(started.ok).toBe(true);

    const again = await tour.startTour(walker, FIRST);
    expect(again.ok).toBe(true);

    expect(await prisma.tourProgress.count({ where: { userId: walker, tourId: FIRST } })).toBe(1);
    const progress = await tour.readProgress(walker);
    expect(progress[FIRST]?.stopIndex).toBe(0);
    expect(progress[FIRST]?.finished).toBe(false);
  });

  it('moves to a stop and remembers it', async () => {
    expect((await tour.saveStop(walker, FIRST, 2)).ok).toBe(true);
    expect((await tour.readProgress(walker))[FIRST]?.stopIndex).toBe(2);
  });

  it('refuses a stop the tour does not have, and an unknown tour', async () => {
    expect((await tour.saveStop(walker, FIRST, LAST_STOP + 1)).ok).toBe(false);
    expect((await tour.saveStop(walker, FIRST, -1)).ok).toBe(false);
    expect((await tour.saveStop(walker, 'no-such-tour', 0)).ok).toBe(false);
    expect((await tour.startTour(walker, 'no-such-tour')).ok).toBe(false);

    // The refusals left the last good position alone.
    expect((await tour.readProgress(walker))[FIRST]?.stopIndex).toBe(2);
    expect(await prisma.tourProgress.count({ where: { tourId: 'no-such-tour' } })).toBe(0);
  });

  it('finishing is its own state, not merely the last stop', async () => {
    await tour.saveStop(walker, FIRST, LAST_STOP);
    expect((await tour.readProgress(walker))[FIRST]?.finished).toBe(false);

    expect((await tour.finishTour(walker, FIRST)).ok).toBe(true);
    const done = (await tour.readProgress(walker))[FIRST];
    expect(done?.finished).toBe(true);
    expect(done?.stopIndex).toBe(LAST_STOP);

    // Walking it again clears the finish rather than adding a second row.
    expect((await tour.startTour(walker, FIRST)).ok).toBe(true);
    const restarted = (await tour.readProgress(walker))[FIRST];
    expect(restarted?.finished).toBe(false);
    expect(restarted?.stopIndex).toBe(0);
    expect(await prisma.tourProgress.count({ where: { userId: walker, tourId: FIRST } })).toBe(1);
  });

  it('shows nobody else’s progress', async () => {
    await tour.saveStop(walker, FIRST, 1);
    expect((await tour.readProgress(somebodyElse))[FIRST]).toBeUndefined();

    // And writing as somebody else does not touch this walker's row.
    await tour.startTour(somebodyElse, FIRST);
    await tour.saveStop(somebodyElse, FIRST, 3);
    expect((await tour.readProgress(walker))[FIRST]?.stopIndex).toBe(1);
  });

  it('ignores a stored row whose tour has since been rewritten away', async () => {
    await prisma.tourProgress.create({
      data: { id: 'tour_progress_stale', userId: walker, tourId: 'retired-tour', stopIndex: 0 },
    });
    expect((await tour.readProgress(walker))['retired-tour']).toBeUndefined();
    await prisma.tourProgress.delete({ where: { id: 'tour_progress_stale' } });
  });
});
