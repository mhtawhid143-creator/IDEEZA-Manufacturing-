import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_AUTH_CONFIG } from '../src/config.js';
import {
  AccountSuspendedError,
  MembershipRequiredError,
  NoSessionError,
  SessionExpiredError,
  SessionInvalidError,
} from '../src/errors.js';
import { SessionService } from '../src/session.js';
import { hashSessionToken } from '../src/tokens.js';
import { FixedClock, InMemoryIdentityStore, InMemorySessionStore } from './fakes.js';

const config = { ...DEFAULT_AUTH_CONFIG, idleWindowMinutes: 60, absoluteWindowDays: 2 };

let clock: FixedClock;
let identity: InMemoryIdentityStore;
let sessions: InMemorySessionStore;
let service: SessionService;

beforeEach(() => {
  clock = new FixedClock('2026-05-17T10:00:00.000Z');
  identity = new InMemoryIdentityStore([
    { id: 'buyer-1', email: 'buyer@example.test', role: 'buyer' },
    { id: 'ops-1', email: 'ops@example.test', role: 'ops_admin' },
    {
      id: 'member-a',
      email: 'a@example.test',
      role: 'manufacturer',
      manufacturerIds: ['mfr-a'],
    },
    {
      id: 'member-both',
      email: 'both@example.test',
      role: 'manufacturer',
      manufacturerIds: ['mfr-a', 'mfr-b'],
    },
  ]);
  sessions = new InMemorySessionStore();
  service = new SessionService({ sessions, identity, clock, config });
});

describe('issuing a session', () => {
  it('returns the token once and stores only its hash', async () => {
    const { token, session } = await service.issue({ userId: 'buyer-1', role: 'buyer' });

    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(session.tokenHash).toBe(hashSessionToken(token));
    expect(session.tokenHash).not.toBe(token);
    expect(session.activeManufacturerId).toBeNull();
  });

  it('sets an idle window inside an absolute window', async () => {
    const { session } = await service.issue({ userId: 'buyer-1', role: 'buyer' });
    expect(session.idleExpiresAt.getTime()).toBeLessThan(session.absoluteExpiresAt.getTime());
    expect(session.idleExpiresAt.getTime() - session.issuedAt.getTime()).toBe(60 * 60_000);
  });

  it('binds a manufacturer session to the manufacturer it acts for', async () => {
    const { session } = await service.issue({ userId: 'member-a', role: 'manufacturer' });
    expect(session.activeManufacturerId).toBe('mfr-a');
  });

  it('refuses a manufacturer the account is not a member of', async () => {
    await expect(
      service.issue({
        userId: 'member-a',
        role: 'manufacturer',
        activeManufacturerId: 'mfr-b',
      }),
    ).rejects.toThrow(MembershipRequiredError);
  });

  it('refuses to guess when the account belongs to several manufacturers', async () => {
    await expect(
      service.issue({ userId: 'member-both', role: 'manufacturer' }),
    ).rejects.toThrow(MembershipRequiredError);

    const chosen = await service.issue({
      userId: 'member-both',
      role: 'manufacturer',
      activeManufacturerId: 'mfr-b',
    });
    expect(chosen.session.activeManufacturerId).toBe('mfr-b');
  });

  it('refuses to bind a buyer or operations session to a manufacturer', async () => {
    await expect(
      service.issue({ userId: 'buyer-1', role: 'buyer', activeManufacturerId: 'mfr-a' }),
    ).rejects.toThrow(SessionInvalidError);
  });
});

describe('verifying a session', () => {
  it('rejects a missing, malformed or unknown token', async () => {
    await expect(service.verify(undefined)).rejects.toThrow(NoSessionError);
    await expect(service.verify('')).rejects.toThrow(NoSessionError);
    await expect(service.verify('short')).rejects.toThrow(SessionInvalidError);
    await expect(service.verify('a'.repeat(43))).rejects.toThrow(/unknown token/);
  });

  it('slides the idle window forward while the session is used', async () => {
    const { token, session } = await service.issue({ userId: 'buyer-1', role: 'buyer' });

    clock.advanceMinutes(30);
    const refreshed = await service.verify(token);

    expect(refreshed.idleExpiresAt.getTime()).toBeGreaterThan(session.idleExpiresAt.getTime());
    expect(refreshed.lastSeenAt.getTime()).toBe(clock.now().getTime());
  });

  it('never extends the idle window past the absolute window', async () => {
    // A long idle window inside a short absolute window makes the clamp visible.
    const clampService = new SessionService({
      sessions,
      identity,
      clock,
      config: { ...config, idleWindowMinutes: 600, absoluteWindowDays: 1 },
    });
    const { token, session } = await clampService.issue({ userId: 'buyer-1', role: 'buyer' });

    clock.advanceMinutes(500);
    const slid = await clampService.verify(token);
    expect(slid.idleExpiresAt.getTime()).toBe(session.issuedAt.getTime() + 1100 * 60_000);

    clock.advanceMinutes(400);
    const clamped = await clampService.verify(token);
    expect(clamped.idleExpiresAt.getTime()).toBe(session.absoluteExpiresAt.getTime());
  });

  it('expires an unused session', async () => {
    const { token } = await service.issue({ userId: 'buyer-1', role: 'buyer' });
    clock.advanceMinutes(61);
    await expect(service.verify(token)).rejects.toThrow(SessionExpiredError);
  });

  it('expires a session that keeps being used past the absolute window', async () => {
    const shortLived = new SessionService({
      sessions,
      identity,
      clock,
      config: { ...config, idleWindowMinutes: 600, absoluteWindowDays: 1 },
    });
    const { token } = await shortLived.issue({ userId: 'buyer-1', role: 'buyer' });

    // Used regularly, so the idle window never closes.
    // 5 x 300 minutes passes the one day absolute window.
    for (let step = 0; step < 5; step += 1) {
      clock.advanceMinutes(300);
      if (step < 4) await shortLived.verify(token);
    }

    await expect(shortLived.verify(token)).rejects.toThrow(/absolute window/);
  });

  it('rejects a revoked session', async () => {
    const { token } = await service.issue({ userId: 'buyer-1', role: 'buyer' });
    await service.revoke(token, 'signed_out');
    await expect(service.verify(token)).rejects.toThrow(/revoked/);
  });
});

describe('resolving an actor', () => {
  it('carries the role and the manufacturer binding', async () => {
    const { token } = await service.issue({ userId: 'member-a', role: 'manufacturer' });
    const actor = await service.resolveActor(token);

    expect(actor.role).toBe('manufacturer');
    expect(actor.manufacturerId).toBe('mfr-a');
    expect(actor.userId).toBe('member-a');
    expect(actor.email).toBe('a@example.test');
  });

  it('leaves a buyer actor with no manufacturer binding', async () => {
    const { token } = await service.issue({ userId: 'buyer-1', role: 'buyer' });
    const actor = await service.resolveActor(token);
    expect(actor.manufacturerId).toBeUndefined();
  });

  it('refuses and revokes when the account is suspended after sign in', async () => {
    const { token, session } = await service.issue({ userId: 'buyer-1', role: 'buyer' });
    identity.suspend('buyer-1', clock.now());

    await expect(service.resolveActor(token)).rejects.toThrow(AccountSuspendedError);
    expect(sessions.revocations).toEqual([{ id: session.id, reason: 'account_suspended' }]);
  });

  it('refuses and revokes when the account role changes after sign in', async () => {
    const { token } = await service.issue({ userId: 'buyer-1', role: 'buyer' });
    identity.setRole('buyer-1', 'ops_admin');

    await expect(service.resolveActor(token)).rejects.toThrow(/role changed/);
    expect(sessions.revocations).toHaveLength(1);
  });

  it('refuses and revokes when membership is withdrawn after sign in', async () => {
    const { token } = await service.issue({ userId: 'member-a', role: 'manufacturer' });
    identity.setMemberships('member-a', []);

    await expect(service.resolveActor(token)).rejects.toThrow(MembershipRequiredError);
    expect(sessions.revocations).toHaveLength(1);
  });
});

describe('rotation, revocation and cleanup', () => {
  it('rotates to a new token and retires the old one', async () => {
    const first = await service.issue({ userId: 'member-a', role: 'manufacturer' });
    clock.advanceMinutes(5);
    const second = await service.rotate(first.token);

    expect(second.token).not.toBe(first.token);
    expect(second.session.activeManufacturerId).toBe('mfr-a');
    await expect(service.verify(first.token)).rejects.toThrow(/revoked/);
    await expect(service.verify(second.token)).resolves.toBeDefined();
    expect(sessions.revocations.at(-1)?.reason).toBe('rotated');
  });

  it('ends every session for an account at once', async () => {
    const first = await service.issue({ userId: 'buyer-1', role: 'buyer' });
    const second = await service.issue({ userId: 'buyer-1', role: 'buyer' });

    expect(await service.revokeAllForUser('buyer-1', 'password_changed')).toBe(2);
    await expect(service.verify(first.token)).rejects.toThrow(/revoked/);
    await expect(service.verify(second.token)).rejects.toThrow(/revoked/);
  });

  it('ignores a revoke call for a token it never issued', async () => {
    await expect(service.revoke('a'.repeat(43))).resolves.toBeUndefined();
    await expect(service.revoke('nonsense')).resolves.toBeUndefined();
  });

  it('purges sessions whose absolute window has closed', async () => {
    await service.issue({ userId: 'buyer-1', role: 'buyer' });
    expect(sessions.size).toBe(1);

    clock.advanceDays(3);
    expect(await service.purgeExpired()).toBe(1);
    expect(sessions.size).toBe(0);
  });
});
