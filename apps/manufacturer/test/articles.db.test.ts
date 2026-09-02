import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { asId, type ManufacturerId } from '@ideeza/domain';
import type * as Articles from '../src/data/articles.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import { startTestDatabase, type TestDatabase } from '../../../packages/db/test-support/index.js';

/**
 * The blog, as a shop writes it.
 *
 * The screen used to keep articles in React state and say so, which also meant
 * the profile's Blog tab — reading the table — showed a shop nothing it had
 * written. These are the tests about that not happening again: what is written
 * is read back, a shop cannot publish itself, and it cannot touch another
 * shop's writing.
 */
let database: TestDatabase;
let prisma: PrismaClient;
let articles: typeof Articles;

const SHOP = asId<ManufacturerId>('seed_mfr_a');
const OTHER = asId<ManufacturerId>('seed_mfr_c');

const draft = {
  title: 'How we read a stack-up before quoting',
  category: 'PCB design',
  tags: ['stack-up', 'impedance', ' ', 'impedance'],
  body:
    'A four layer board quoted from a gerber alone is a guess. We open the stack-up first, because the copper weights and the dielectric decide the impedance, and the impedance decides whether the board works at all.',
  status: 'draft' as const,
};

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  articles = await import('../src/data/articles.js');
});

afterAll(async () => {
  await database?.stop();
});

describe('writing an article', () => {
  it('stores it, and reads it back on the shop’s list', async () => {
    const before = (await articles.listArticles(SHOP)).length;
    expect((await articles.saveArticle(SHOP, draft)).ok).toBe(true);

    const after = await articles.listArticles(SHOP);
    expect(after.length).toBe(before + 1);
    const saved = after.find((row) => row.title === draft.title);
    expect(saved?.status).toBe('draft');
    // Tags are de-duplicated and the blank one dropped: an empty chip on the
    // profile is a tag a buyer cannot read.
    expect(saved?.tags).toEqual(['stack-up', 'impedance']);
    expect(saved?.readMinutes).toBeGreaterThanOrEqual(1);
  });

  it('refuses what a reviewer would only bounce', async () => {
    const before = await prisma.shopArticle.count();
    for (const broken of [
      { ...draft, title: 'No' },
      { ...draft, body: 'Too short to judge anyone on.' },
    ]) {
      expect((await articles.saveArticle(SHOP, broken)).ok).toBe(false);
    }
    expect(await prisma.shopArticle.count()).toBe(before);
  });

  it('sends one to IDEEZA, and clears the reason it was sent back', async () => {
    const rejected = await prisma.shopArticle.findFirst({
      where: { manufacturerId: SHOP, status: 'rejected' },
    });
    expect(rejected).not.toBeNull();
    if (rejected === null) return;
    expect(rejected.rejectReason).toBeTruthy();

    const result = await articles.saveArticle(SHOP, {
      id: rejected.id,
      title: rejected.title,
      category: 'Quality',
      tags: ['rewritten'],
      body:
        'Rewritten so it teaches something: here is the checklist our line runs before a panel is cut, and what each check has caught in the last year.',
      status: 'in_review',
    });
    expect(result.ok).toBe(true);

    const after = await prisma.shopArticle.findUnique({ where: { id: rejected.id } });
    expect(after?.status).toBe('in_review');
    // The old reason was an answer about the version before this one.
    expect(after?.rejectReason).toBeNull();
  });

  it('will not let one shop rewrite or delete another shop’s article', async () => {
    const theirs = await prisma.shopArticle.findFirst({ where: { manufacturerId: OTHER } });
    if (theirs === null) return;

    expect(
      (await articles.saveArticle(SHOP, { ...draft, id: theirs.id, title: 'Mine now' })).ok,
    ).toBe(false);
    expect((await articles.removeArticle(SHOP, theirs.id)).ok).toBe(false);
    expect((await prisma.shopArticle.findUnique({ where: { id: theirs.id } }))?.title).toBe(
      theirs.title,
    );
  });

  it('deletes its own', async () => {
    const mine = await prisma.shopArticle.findFirst({
      where: { manufacturerId: SHOP, title: draft.title },
    });
    expect(mine).not.toBeNull();
    if (mine === null) return;

    expect((await articles.removeArticle(SHOP, mine.id)).ok).toBe(true);
    expect(await prisma.shopArticle.findUnique({ where: { id: mine.id } })).toBeNull();
  });
});
