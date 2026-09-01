import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { asId, type UserId } from '@ideeza/domain';
import type { SubmitProblemReport } from '@ideeza/types';
import type * as ProblemReports from '../src/data/problem-report.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import { startTestDatabase, type TestDatabase } from '../../../packages/db/test-support/index.js';

/**
 * A reported problem has to land somewhere.
 *
 * The dialog's whole promise is that someone will read this later, so the test
 * that matters is not that the form validated — it is that a row exists
 * afterwards, attached to the person who wrote it, carrying the page they were
 * on. A form that says "thank you" and drops the report is the failure this
 * guards against.
 */
let database: TestDatabase;
let prisma: PrismaClient;
let reports: typeof ProblemReports;

const MEMBER = asId<UserId>('seed_user_member_a');

const report = {
  title: 'The quote total does not match the line items',
  kind: 'technical_bug',
  frustration: 'blocking',
  detail: 'I priced six volumes and the header showed the third one twice.',
  extra: 'It happened again after a reload.',
  pageName: '/quotes/quote_1',
  attachments: [],
} satisfies SubmitProblemReport;

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  reports = await import('../src/data/problem-report.js');
});

afterAll(async () => {
  await database?.stop();
});

describe('reporting a problem', () => {
  it('stores the report against the person who wrote it', async () => {
    const result = await reports.submitProblemReport(MEMBER, report);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await prisma.problemReport.findUnique({ where: { id: result.reportId } });
    expect(row).not.toBeNull();
    expect(row?.reportedById).toBe(MEMBER);
    expect(row?.kind).toBe('technical_bug');
    expect(row?.frustration).toBe('blocking');
    expect(row?.title).toBe(report.title);
    expect(row?.detail).toBe(report.detail);
    expect(row?.extra).toBe(report.extra);
    // The one field the reporter does not type, and the one most worth having.
    expect(row?.pageName).toBe('/quotes/quote_1');
  });

  it('keeps what was attached, so a later reader knows there were screenshots', async () => {
    const result = await reports.submitProblemReport(MEMBER, {
      ...report,
      attachments: [{ name: 'totals.png', sizeBytes: 20_481, contentType: 'image/png' }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await prisma.problemReport.findUnique({ where: { id: result.reportId } });
    expect(row?.attachments).toEqual([
      { name: 'totals.png', sizeBytes: 20_481, contentType: 'image/png' },
    ]);
  });

  it('refuses a report that could not be acted on, and writes nothing', async () => {
    const before = await prisma.problemReport.count();

    for (const broken of [
      { ...report, title: '   ' },
      { ...report, detail: '' },
      { ...report, kind: 'not_a_kind' },
      { ...report, frustration: 'mildly cross' },
      { ...report, pageName: '' },
      { ...report, title: 'x'.repeat(201) },
    ]) {
      const result = await reports.submitProblemReport(MEMBER, broken as never);
      expect(result.ok).toBe(false);
    }

    expect(await prisma.problemReport.count()).toBe(before);
  });

  it('refuses a reporter the database does not know', async () => {
    const result = await reports.submitProblemReport(asId<UserId>('user_who_is_not_here'), report);
    expect(result.ok).toBe(false);
  });
});
