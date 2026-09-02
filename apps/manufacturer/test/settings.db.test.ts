import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { asId, type ManufacturerId } from '@ideeza/domain';
import type * as Settings from '../src/data/settings.js';
import { seedDatabase } from '../../../packages/db/prisma/seed.js';
import { startTestDatabase, type TestDatabase } from '../../../packages/db/test-support/index.js';

/**
 * The ten settings panes, from below.
 *
 * What is worth pinning here is not that a switch flips — it is that the
 * switches which must not flip do not, that a secret is never stored in the
 * clear, that only the last four characters of an account or tax number are
 * kept, and that one shop cannot reach another's payout method.
 */
let database: TestDatabase;
let prisma: PrismaClient;
let settings: typeof Settings;

const SHOP = asId<ManufacturerId>('seed_mfr_a');
const OTHER = asId<ManufacturerId>('seed_mfr_c');
let userId = '';

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  process.env['DATABASE_URL'] = database.url;
  await seedDatabase(prisma);
  settings = await import('../src/data/settings.js');

  const member = await prisma.manufacturerMember.findFirst({ where: { manufacturerId: SHOP } });
  userId = member?.userId ?? '';
  expect(userId).not.toBe('');
});

afterAll(async () => {
  await database?.stop();
});

describe('the person', () => {
  it('keeps the whole name in step with its halves', async () => {
    expect((await settings.saveProfileName(userId, { firstName: ' Ada ', lastName: ' Byron ' })).ok)
      .toBe(true);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.firstName).toBe('Ada');
    expect(user?.lastName).toBe('Byron');
    // One name, so no screen can introduce this person differently from another.
    expect(user?.displayName).toBe('Ada Byron');
  });

  it('refuses a half-written name', async () => {
    expect((await settings.saveProfileName(userId, { firstName: '', lastName: 'Byron' })).ok).toBe(
      false,
    );
    expect((await settings.saveProfileName(userId, { firstName: 'Ada', lastName: ' ' })).ok).toBe(
      false,
    );
  });

  it('changes an email only with the code for that address', async () => {
    const target = 'ada@precisioncircuit.test';
    const wrong = await settings.changeEmail(userId, target, '000000');
    expect(wrong.ok).toBe(false);

    // A code made for a different address must not open this one.
    const other = settings.verificationCode(userId, 'someone-else@example.test');
    expect((await settings.changeEmail(userId, target, other)).ok).toBe(false);

    const right = settings.verificationCode(userId, target);
    expect((await settings.changeEmail(userId, target, right)).ok).toBe(true);
    expect((await prisma.user.findUnique({ where: { id: userId } }))?.email).toBe(target);
  });

  it('will not take an address another account already uses', async () => {
    const someone = await prisma.user.findFirst({ where: { NOT: { id: userId } } });
    expect(someone).not.toBeNull();
    if (someone === null) return;

    const code = settings.verificationCode(userId, someone.email);
    expect((await settings.changeEmail(userId, someone.email, code)).ok).toBe(false);
  });

  it('verifies a number, and forgets it on request', async () => {
    const phone = '+8801711223344';
    const code = settings.verificationCode(userId, phone);
    expect((await settings.changePhone(userId, phone, code)).ok).toBe(true);
    const withPhone = await prisma.user.findUnique({ where: { id: userId } });
    expect(withPhone?.phone).toBe(phone);
    expect(withPhone?.phoneVerifiedAt).not.toBeNull();

    expect((await settings.removePhone(userId)).ok).toBe(true);
    const without = await prisma.user.findUnique({ where: { id: userId } });
    expect(without?.phone).toBeNull();
    expect(without?.phoneVerifiedAt).toBeNull();
  });
});

describe('security', () => {
  it('stores a security answer as a hash, never as the answer', async () => {
    expect(
      (await settings.setSecurityQuestion(userId, 'What was your first machine?', ' Bridgeport '))
        .ok,
    ).toBe(true);

    const row = await prisma.userSecurity.findUnique({ where: { userId } });
    expect(row?.securityQuestion).toBe('What was your first machine?');
    expect(row?.securityAnswerHash).toBeTruthy();
    // The answer itself must not be findable in the row.
    expect(row?.securityAnswerHash?.toLowerCase()).not.toContain('bridgeport');

    // Case and spacing are ignored, because a person retyping an answer months
    // later will not reproduce either.
    expect(await settings.checkSecurityAnswer(userId, 'bridgeport')).toBe(true);
    expect(await settings.checkSecurityAnswer(userId, 'Colchester')).toBe(false);
  });

  it('refuses SMS as a second step until a number is verified', async () => {
    await settings.removePhone(userId);
    expect((await settings.setTwoStep(userId, true, 'sms')).ok).toBe(false);

    const phone = '+8801711223344';
    await settings.changePhone(userId, phone, settings.verificationCode(userId, phone));
    expect((await settings.setTwoStep(userId, true, 'sms')).ok).toBe(true);
    expect((await settings.readSecurity(userId)).twoStepMethod).toBe('sms');
  });

  it('will not sign out the device asking', async () => {
    const session = await prisma.session.findFirst({ where: { userId, revokedAt: null } });
    if (session === null) return;
    expect((await settings.signOutDevice(userId, session.id, session.id)).ok).toBe(false);
    expect((await prisma.session.findUnique({ where: { id: session.id } }))?.revokedAt).toBeNull();
  });

  it('will not sign out somebody else’s device', async () => {
    const theirs = await prisma.session.findFirst({
      where: { revokedAt: null, NOT: { userId } },
    });
    if (theirs === null) return;
    expect((await settings.signOutDevice(userId, theirs.id, null)).ok).toBe(false);
    expect((await prisma.session.findUnique({ where: { id: theirs.id } }))?.revokedAt).toBeNull();
  });

  it('dates a deactivation and its return, and takes both back', async () => {
    expect((await settings.deactivateAccount(userId, 'Taking the summer off', 30)).ok).toBe(true);
    const off = await settings.readSecurity(userId);
    expect(off.deactivatedAt).not.toBeNull();
    expect(off.reactivateAfter).not.toBeNull();

    expect((await settings.deactivateAccount(userId, 'no', 30)).ok).toBe(false);
    expect((await settings.deactivateAccount(userId, 'A good enough reason', 400)).ok).toBe(false);

    expect((await settings.reactivateAccount(userId)).ok).toBe(true);
    expect((await settings.readSecurity(userId)).deactivatedAt).toBeNull();
  });

  it('records a deletion as a request, because ops answers it', async () => {
    expect((await settings.requestDeletion(userId, 'Closing the shop')).ok).toBe(true);
    expect((await settings.readSecurity(userId)).deletionRequestedAt).not.toBeNull();
    // The account is still there: money in escrow cannot be abandoned.
    expect(await prisma.user.findUnique({ where: { id: userId } })).not.toBeNull();

    expect((await settings.withdrawDeletion(userId)).ok).toBe(true);
    expect((await settings.readSecurity(userId)).deletionRequestedAt).toBeNull();
  });
});

describe('preferences and notifications', () => {
  it('refuses a language nothing could format a date in', async () => {
    expect((await settings.savePreferences(userId, { language: 'not-a-language!' })).ok).toBe(
      false,
    );
    expect((await settings.savePreferences(userId, { language: 'bn-BD' })).ok).toBe(true);
    expect((await settings.readPreferences(userId)).language).toBe('bn-BD');
  });

  it('defaults every notification on, and keeps the mandatory ones on', async () => {
    const choices = await settings.readNoticeChoices(userId);
    expect(choices.length).toBe(18);
    expect(choices.every((row) => row.enabled)).toBe(true);

    // A shop may switch off email about a dispute; it may not switch off being
    // told at all, or the platform cannot keep its own promises.
    expect((await settings.setNoticeChoice(userId, 'dispute', 'email', false)).ok).toBe(true);
    expect((await settings.setNoticeChoice(userId, 'dispute', 'web', false)).ok).toBe(false);

    const after = await settings.readNoticeChoices(userId);
    expect(after.find((row) => row.topic === 'dispute' && row.channel === 'email')?.enabled).toBe(
      false,
    );
    expect(after.find((row) => row.topic === 'dispute' && row.channel === 'web')?.enabled).toBe(
      true,
    );
  });

  it('refuses a topic or channel it does not know', async () => {
    expect((await settings.setNoticeChoice(userId, 'weather', 'email', false)).ok).toBe(false);
    expect((await settings.setNoticeChoice(userId, 'blog', 'pigeon', false)).ok).toBe(false);
  });
});

describe('identity', () => {
  it('submits level one for review, and never approves it itself', async () => {
    const bad = await settings.submitKycLevelOne(userId, {
      fullLegalName: 'Ada Byron',
      contactEmail: 'ada@precisioncircuit.test',
      mobileNumber: '+8801711223344',
      countryOfResidence: 'BD',
      agreedToTerms: false,
    });
    expect(bad.ok).toBe(false);

    const good = await settings.submitKycLevelOne(userId, {
      fullLegalName: 'Ada Byron',
      contactEmail: 'ada@precisioncircuit.test',
      mobileNumber: '+8801711223344',
      countryOfResidence: 'BD',
      agreedToTerms: true,
    });
    expect(good.ok).toBe(true);

    const levels = await settings.readKyc(userId);
    expect(levels.length).toBe(3);
    expect(levels[0]?.status).toBe('in_review');
    // Nothing a shop does approves its own identity check.
    expect(levels.some((row) => row.status === 'approved')).toBe(false);
  });

  it('will not take level two before level one is approved', async () => {
    const early = await settings.submitKycHigher(userId, {
      level: 2,
      dateOfBirth: '1990-01-01',
      residentialAddress: '20/3, Sector 9, Uttara, Dhaka',
      taxResidencyCountry: 'BD',
      documentNames: ['passport.pdf'],
    });
    expect(early.ok).toBe(false);

    // IDEEZA approving level one is what opens level two.
    await prisma.kycSubmission.update({
      where: { userId_level: { userId, level: 1 } },
      data: { status: 'approved', decidedAt: new Date() },
    });

    const now = await settings.submitKycHigher(userId, {
      level: 2,
      dateOfBirth: '1990-01-01',
      residentialAddress: '20/3, Sector 9, Uttara, Dhaka',
      taxResidencyCountry: 'BD',
      documentNames: ['passport.pdf', ' '],
    });
    expect(now.ok).toBe(true);
    const levels = await settings.readKyc(userId);
    // The blank name is dropped rather than recorded as a document.
    expect(levels[1]?.documentNames).toEqual(['passport.pdf']);
  });

  it('refuses level two with no document at all', async () => {
    const none = await settings.submitKycHigher(userId, {
      level: 2,
      dateOfBirth: '1990-01-01',
      residentialAddress: '20/3, Sector 9, Uttara, Dhaka',
      taxResidencyCountry: 'BD',
      documentNames: [' ', ''],
    });
    expect(none.ok).toBe(false);
  });
});

describe('getting paid', () => {
  it('keeps only the last four digits of an account, and defaults the first one', async () => {
    expect(
      (
        await settings.addPayoutMethod(SHOP, {
          kind: 'direct_bank',
          label: '',
          accountName: 'PrecisionCircuit Manufacturing Ltd.',
          accountNumber: '4321 8765 0099 1234',
          bankName: 'Bank of China',
          swiftCode: '',
          countryCode: 'CN',
        })
      ).ok,
    ).toBe(true);

    const [method] = await settings.readPayoutMethods(SHOP);
    expect(method?.accountLast4).toBe('1234');
    expect(method?.isDefault).toBe(true);

    // What is not stored cannot leak: the row must not hold the whole number.
    const raw = await prisma.payoutMethod.findFirst({ where: { manufacturerId: SHOP } });
    expect(JSON.stringify(raw)).not.toContain('432187650099');
  });

  it('asks a SWIFT method for a SWIFT code, and a bank one for a bank', async () => {
    expect(
      (
        await settings.addPayoutMethod(SHOP, {
          kind: 'swift',
          label: 'International',
          accountName: 'PrecisionCircuit Manufacturing Ltd.',
          accountNumber: '99887766',
          bankName: '',
          swiftCode: 'BAD',
          countryCode: 'CN',
        })
      ).ok,
    ).toBe(false);

    expect(
      (
        await settings.addPayoutMethod(SHOP, {
          kind: 'direct_bank',
          label: '',
          accountName: 'PrecisionCircuit Manufacturing Ltd.',
          accountNumber: '99887766',
          bankName: '',
          swiftCode: '',
          countryCode: 'CN',
        })
      ).ok,
    ).toBe(false);
  });

  it('will not let one shop touch another shop’s method', async () => {
    await settings.addPayoutMethod(OTHER, {
      kind: 'swift',
      label: 'Theirs',
      accountName: 'AdditiveWorks Studio BV',
      accountNumber: '12345678',
      bankName: '',
      swiftCode: 'ABNANL2A',
      countryCode: 'NL',
    });
    const [theirs] = await settings.readPayoutMethods(OTHER);
    expect(theirs).toBeDefined();
    if (theirs === undefined) return;

    expect((await settings.setDefaultPayoutMethod(SHOP, theirs.id)).ok).toBe(false);
    expect((await settings.removePayoutMethod(SHOP, theirs.id)).ok).toBe(false);
    expect(await prisma.payoutMethod.findUnique({ where: { id: theirs.id } })).not.toBeNull();
  });

  it('never leaves a shop with methods but no default', async () => {
    await settings.addPayoutMethod(SHOP, {
      kind: 'swift',
      label: 'Second',
      accountName: 'PrecisionCircuit Manufacturing Ltd.',
      accountNumber: '55554444',
      bankName: '',
      swiftCode: 'BKCHCNBJ',
      countryCode: 'CN',
    });
    const before = await settings.readPayoutMethods(SHOP);
    const theDefault = before.find((row) => row.isDefault);
    expect(theDefault).toBeDefined();
    if (theDefault === undefined) return;

    expect((await settings.removePayoutMethod(SHOP, theDefault.id)).ok).toBe(true);
    const after = await settings.readPayoutMethods(SHOP);
    expect(after.length).toBeGreaterThan(0);
    expect(after.some((row) => row.isDefault)).toBe(true);
  });

  it('keeps only the last four of a tax number', async () => {
    expect((await settings.saveTaxResidence(userId, 'BD', false)).ok).toBe(true);
    expect((await settings.saveTaxIdentification(userId, 'tin', '123-45-6789')).ok).toBe(true);

    const tax = await settings.readTaxProfile(userId);
    expect(tax.residenceCountry).toBe('BD');
    expect(tax.taxIdLast4).toBe('6789');

    const raw = await prisma.taxProfile.findUnique({ where: { userId } });
    expect(JSON.stringify(raw)).not.toContain('123456789');
  });
});

describe('what has happened', () => {
  it('reads activity from the platform’s own events, not a second log', async () => {
    const rows = await settings.readActivity(userId);
    for (const row of rows) {
      expect(row.kind).toBeTruthy();
      expect(row.at instanceof Date).toBe(true);
    }
    // Every row has to be an event this account was the actor of.
    const ids = rows.map((row) => row.id);
    if (ids.length > 0) {
      const events = await prisma.domainEvent.findMany({ where: { id: { in: ids } } });
      expect(events.every((event) => event.actorUserId === userId)).toBe(true);
    }
  });

  it('reads disputes through the order, which is what ties one to a shop', async () => {
    const rows = await settings.readDisputes(SHOP, userId);
    for (const row of rows) {
      const order = await prisma.manufacturingOrder.findUnique({ where: { id: row.orderId } });
      expect(order?.manufacturerId).toBe(SHOP);
    }
  });
});
