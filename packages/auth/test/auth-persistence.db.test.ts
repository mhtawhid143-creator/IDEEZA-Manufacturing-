import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@ideeza/db';
import { seedDatabase } from '../../db/prisma/seed.js';
import { startTestDatabase, type TestDatabase } from '../../db/test-support/index.js';
import { DEFAULT_AUTH_CONFIG } from '../src/config.js';
import { MembershipRequiredError } from '../src/errors.js';
import {
  authorizeInventoryAccess,
  authorizeOrderAccess,
  authorizeQuoteAccess,
  authorizeRfqAccess,
  listVisibleQuotes,
} from '../src/boundaries.js';
import { createAuthServices, type AuthServices } from '../src/prisma-stores.js';
import type { Clock } from '../src/ports.js';

/** A clock the test can move, so session expiry is exercised without waiting. */
class TestClock implements Clock {
  private current = new Date('2026-05-17T10:00:00.000Z');
  public now(): Date {
    return new Date(this.current);
  }
  public advanceMinutes(count: number): void {
    this.current = new Date(this.current.getTime() + count * 60_000);
  }
  public advanceDays(count: number): void {
    this.advanceMinutes(count * 24 * 60);
  }
}

const config = { ...DEFAULT_AUTH_CONFIG, scryptCostLog2: 12, idleWindowMinutes: 60 };
const PASSWORD = 'a-long-enough-password';

let database: TestDatabase;
let prisma: PrismaClient;
let clock: TestClock;
let services: AuthServices;

beforeAll(async () => {
  database = await startTestDatabase('ideeza_auth_test');
  prisma = database.prisma;
  await seedDatabase(prisma);

  clock = new TestClock();
  services = createAuthServices(prisma, { clock, config });

  // Credentials are never seeded; they are provisioned explicitly.
  for (const userId of ['seed_user_buyer', 'seed_user_ops', 'seed_user_member_a', 'seed_user_member_b']) {
    await services.authentication.setPassword(userId, PASSWORD);
  }
});

afterAll(async () => {
  await database?.stop();
});

describe('credentials are stored apart from the account', () => {
  it('writes a scrypt hash and never the password', async () => {
    const credential = await prisma.userCredential.findUniqueOrThrow({
      where: { userId: 'seed_user_buyer' },
    });

    expect(credential.algorithm).toBe('scrypt');
    expect(credential.passwordHash.startsWith('scrypt$')).toBe(true);
    expect(credential.passwordHash).not.toContain(PASSWORD);
    expect(credential.failedAttempts).toBe(0);
  });

  it('keeps the hash out of a user read', async () => {
    const user = await services.identity.findUserById('seed_user_buyer');
    expect(user).not.toBeNull();
    expect(Object.keys(user ?? {})).toEqual(['id', 'email', 'role', 'suspendedAt']);
  });
});

describe('sign in persists a session', () => {
  it('stores only the token hash, with both expiry windows', async () => {
    const result = await services.authentication.signIn({
      email: 'buyer@example.test',
      password: PASSWORD,
      userAgent: 'vitest',
      ipAddress: '127.0.0.1',
    });

    const stored = await prisma.session.findUniqueOrThrow({
      where: { id: result.session.id },
    });

    expect(stored.tokenHash).not.toBe(result.token);
    expect(stored.role).toBe('buyer');
    expect(stored.activeManufacturerId).toBeNull();
    expect(stored.idleExpiresAt.getTime()).toBeLessThan(stored.absoluteExpiresAt.getTime());
    expect(stored.userAgent).toBe('vitest');
    expect(stored.revokedAt).toBeNull();

    await services.sessionService.revoke(result.token, 'signed_out');
  });

  it('binds a manufacturer session to the manufacturer, and resolves the actor from it', async () => {
    const result = await services.authentication.signIn({
      email: 'ops@precisioncircuit.test',
      password: PASSWORD,
    });

    expect(result.session.activeManufacturerId).toBe('seed_mfr_a');

    const actor = await services.sessionService.resolveActor(result.token);
    expect(actor.role).toBe('manufacturer');
    expect(actor.manufacturerId).toBe('seed_mfr_a');

    await services.sessionService.revoke(result.token, 'signed_out');
  });

  it('refuses a manufacturer the account is not a member of', async () => {
    await expect(
      services.authentication.signIn({
        email: 'ops@precisioncircuit.test',
        password: PASSWORD,
        activeManufacturerId: 'seed_mfr_b',
      }),
    ).rejects.toThrow(MembershipRequiredError);
  });
});

describe('the database itself refuses an impossible session', () => {
  it('refuses a manufacturer session with no manufacturer', async () => {
    await expect(
      prisma.$executeRawUnsafe(`
        INSERT INTO "Session" (id, "userId", "tokenHash", role, "issuedAt", "idleExpiresAt", "absoluteExpiresAt", "lastSeenAt")
        VALUES ('test_unbound', 'seed_user_member_a', 'hash_unbound', 'manufacturer',
                now(), now() + interval '1 hour', now() + interval '1 day', now())
      `),
    ).rejects.toThrow(/session_manufacturer_binding/);
  });

  it('refuses a buyer session that claims a manufacturer', async () => {
    await expect(
      prisma.$executeRawUnsafe(`
        INSERT INTO "Session" (id, "userId", "tokenHash", role, "activeManufacturerId", "issuedAt", "idleExpiresAt", "absoluteExpiresAt", "lastSeenAt")
        VALUES ('test_buyer_bound', 'seed_user_buyer', 'hash_buyer_bound', 'buyer', 'seed_mfr_a',
                now(), now() + interval '1 hour', now() + interval '1 day', now())
      `),
    ).rejects.toThrow(/session_manufacturer_binding/);
  });

  it('refuses an idle window that outlives the absolute window', async () => {
    await expect(
      prisma.$executeRawUnsafe(`
        INSERT INTO "Session" (id, "userId", "tokenHash", role, "issuedAt", "idleExpiresAt", "absoluteExpiresAt", "lastSeenAt")
        VALUES ('test_bad_window', 'seed_user_buyer', 'hash_bad_window', 'buyer',
                now(), now() + interval '10 days', now() + interval '1 day', now())
      `),
    ).rejects.toThrow(/session_expiry_window_ordered/);
  });

  it('refuses a revoked session with no reason', async () => {
    await expect(
      prisma.$executeRawUnsafe(`
        INSERT INTO "Session" (id, "userId", "tokenHash", role, "issuedAt", "idleExpiresAt", "absoluteExpiresAt", "lastSeenAt", "revokedAt")
        VALUES ('test_no_reason', 'seed_user_buyer', 'hash_no_reason', 'buyer',
                now(), now() + interval '1 hour', now() + interval '1 day', now(), now())
      `),
    ).rejects.toThrow(/session_revocation_is_explained/);
  });

  it('refuses two sessions with the same token hash', async () => {
    const first = await services.authentication.signIn({
      email: 'buyer@example.test',
      password: PASSWORD,
    });
    const existing = await prisma.session.findUniqueOrThrow({ where: { id: first.session.id } });

    await expect(
      prisma.session.create({
        data: {
          id: 'test_duplicate_hash',
          userId: 'seed_user_buyer',
          tokenHash: existing.tokenHash,
          role: 'buyer',
          issuedAt: clock.now(),
          idleExpiresAt: new Date(clock.now().getTime() + 3_600_000),
          absoluteExpiresAt: new Date(clock.now().getTime() + 86_400_000),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await services.sessionService.revoke(first.token, 'signed_out');
  });
});

describe('session lifecycle against the database', () => {
  it('slides the idle window and then expires', async () => {
    const { token, session } = await services.authentication.signIn({
      email: 'buyer@example.test',
      password: PASSWORD,
    });

    clock.advanceMinutes(30);
    const slid = await services.sessionService.verify(token);
    expect(slid.idleExpiresAt.getTime()).toBeGreaterThan(session.idleExpiresAt.getTime());

    clock.advanceMinutes(61);
    await expect(services.sessionService.verify(token)).rejects.toThrow(/expired/);
  });

  it('revokes with a reason that is written to the row', async () => {
    const { token, session } = await services.authentication.signIn({
      email: 'buyer@example.test',
      password: PASSWORD,
    });
    await services.authentication.signOut(token);

    const stored = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });
    expect(stored.revokedAt).not.toBeNull();
    expect(stored.revocationReason).toBe('signed_out');
  });

  it('ends every session for the account when the password changes', async () => {
    const first = await services.authentication.signIn({
      email: 'buyer@example.test',
      password: PASSWORD,
    });
    const second = await services.authentication.signIn({
      email: 'buyer@example.test',
      password: PASSWORD,
    });

    await services.authentication.changePassword({
      userId: 'seed_user_buyer',
      currentPassword: PASSWORD,
      newPassword: 'a-second-long-password',
    });

    for (const token of [first.token, second.token]) {
      await expect(services.sessionService.verify(token)).rejects.toThrow(/revoked/);
    }
    const reasons = await prisma.session.findMany({
      where: { userId: 'seed_user_buyer', revocationReason: 'password_changed' },
      select: { id: true },
    });
    expect(reasons.length).toBeGreaterThanOrEqual(2);

    // put the original password back for the remaining tests
    await services.authentication.setPassword('seed_user_buyer', PASSWORD);
  });

  it('purges sessions whose absolute window has closed', async () => {
    await services.authentication.signIn({ email: 'buyer@example.test', password: PASSWORD });
    const before = await prisma.session.count();

    clock.advanceDays(DEFAULT_AUTH_CONFIG.absoluteWindowDays + 1);
    const purged = await services.sessionService.purgeExpired();

    expect(purged).toBeGreaterThan(0);
    expect(await prisma.session.count()).toBe(before - purged);
  });
});

describe('domain boundaries against the seeded scenario', () => {
  const actorFor = async (email: string): Promise<Awaited<ReturnType<typeof signInActor>>> =>
    signInActor(email);

  const signInActor = async (email: string) => {
    const result = await services.authentication.signIn({ email, password: PASSWORD });
    return result.actor;
  };

  it('lets the buyer reach its own request and the manufacturers reach it through routing', async () => {
    const buyer = await actorFor('buyer@example.test');
    const memberA = await actorFor('ops@precisioncircuit.test');
    const memberB = await actorFor('ops@shenzhenboards.test');

    await expect(
      authorizeRfqAccess(buyer, services.boundaries, 'seed_rfq_1'),
    ).resolves.toBeDefined();
    await expect(
      authorizeRfqAccess(memberA, services.boundaries, 'seed_rfq_1'),
    ).resolves.toBeDefined();
    await expect(
      authorizeRfqAccess(memberB, services.boundaries, 'seed_rfq_1'),
    ).resolves.toBeDefined();
  });

  it('keeps one manufacturer out of the other manufacturer quote', async () => {
    const memberA = await actorFor('ops@precisioncircuit.test');
    const memberB = await actorFor('ops@shenzhenboards.test');

    await expect(
      authorizeQuoteAccess(memberA, services.boundaries, 'seed_quote_a'),
    ).resolves.toBeDefined();
    await expect(
      authorizeQuoteAccess(memberA, services.boundaries, 'seed_quote_b'),
    ).rejects.toThrow(/only read its own quotes/);
    await expect(
      authorizeQuoteAccess(memberB, services.boundaries, 'seed_quote_a'),
    ).rejects.toThrow(/only read its own quotes/);
  });

  it('shows the buyer both quotes and each manufacturer only its own', async () => {
    const buyer = await actorFor('buyer@example.test');
    const memberA = await actorFor('ops@precisioncircuit.test');
    const memberB = await actorFor('ops@shenzhenboards.test');

    expect(
      (await listVisibleQuotes(buyer, services.boundaries, 'seed_rfq_1')).map((q) => q.id),
    ).toEqual(['seed_quote_a', 'seed_quote_b']);
    expect(
      (await listVisibleQuotes(memberA, services.boundaries, 'seed_rfq_1')).map((q) => q.id),
    ).toEqual(['seed_quote_a']);
    expect(
      (await listVisibleQuotes(memberB, services.boundaries, 'seed_rfq_1')).map((q) => q.id),
    ).toEqual(['seed_quote_b']);
  });

  it('limits the order to its two counterparties', async () => {
    const buyer = await actorFor('buyer@example.test');
    const memberA = await actorFor('ops@precisioncircuit.test');
    const memberB = await actorFor('ops@shenzhenboards.test');
    const ops = await actorFor('ops@example.test');

    await expect(
      authorizeOrderAccess(buyer, services.boundaries, 'seed_order_1'),
    ).resolves.toBeDefined();
    await expect(
      authorizeOrderAccess(memberA, services.boundaries, 'seed_order_1'),
    ).resolves.toBeDefined();
    await expect(
      authorizeOrderAccess(ops, services.boundaries, 'seed_order_1'),
    ).resolves.toBeDefined();
    await expect(
      authorizeOrderAccess(memberB, services.boundaries, 'seed_order_1'),
    ).rejects.toThrow(/not visible/);
  });

  it('keeps stock private to its owner and invisible to the buyer', async () => {
    const buyer = await actorFor('buyer@example.test');
    const memberA = await actorFor('ops@precisioncircuit.test');
    const memberB = await actorFor('ops@shenzhenboards.test');

    await expect(
      authorizeInventoryAccess(memberA, services.boundaries, 'seed_inventory_a1'),
    ).resolves.toBeDefined();
    await expect(
      authorizeInventoryAccess(memberB, services.boundaries, 'seed_inventory_a1'),
    ).rejects.toThrow(/not visible/);
    await expect(
      authorizeInventoryAccess(buyer, services.boundaries, 'seed_inventory_a1'),
    ).rejects.toThrow(/inventory.read/);
  });

  it('revokes the session when membership is withdrawn', async () => {
    const result = await services.authentication.signIn({
      email: 'ops@shenzhenboards.test',
      password: PASSWORD,
    });
    await expect(services.sessionService.resolveActor(result.token)).resolves.toBeDefined();

    await prisma.manufacturerMember.delete({ where: { id: 'seed_membership_b' } });

    await expect(services.sessionService.resolveActor(result.token)).rejects.toThrow(
      MembershipRequiredError,
    );
    const stored = await prisma.session.findUniqueOrThrow({ where: { id: result.session.id } });
    expect(stored.revokedAt).not.toBeNull();

    await prisma.manufacturerMember.create({
      data: {
        id: 'seed_membership_b',
        manufacturerId: 'seed_mfr_b',
        userId: 'seed_user_member_b',
        isOwner: true,
      },
    });
  });

  it('revokes the session when the account is suspended', async () => {
    const result = await services.authentication.signIn({
      email: 'buyer@example.test',
      password: PASSWORD,
    });
    await prisma.user.update({
      where: { id: 'seed_user_buyer' },
      data: { suspendedAt: clock.now() },
    });

    await expect(services.sessionService.resolveActor(result.token)).rejects.toThrow(
      /suspended/,
    );

    await prisma.user.update({
      where: { id: 'seed_user_buyer' },
      data: { suspendedAt: null },
    });
  });
});
