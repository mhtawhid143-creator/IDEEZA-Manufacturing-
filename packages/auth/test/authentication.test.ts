import { beforeEach, describe, expect, it } from 'vitest';
import { AuthenticationService } from '../src/authentication.js';
import { DEFAULT_AUTH_CONFIG } from '../src/config.js';
import {
  AccountLockedError,
  AccountSuspendedError,
  InvalidCredentialsError,
  MembershipRequiredError,
} from '../src/errors.js';
import { hashPassword } from '../src/password.js';
import { SessionService } from '../src/session.js';
import { FixedClock, InMemoryIdentityStore, InMemorySessionStore } from './fakes.js';

const config = { ...DEFAULT_AUTH_CONFIG, scryptCostLog2: 12, maxFailedAttempts: 3, lockMinutes: 15 };
const PASSWORD = 'a-long-enough-password';

let clock: FixedClock;
let identity: InMemoryIdentityStore;
let sessions: InMemorySessionStore;
let sessionService: SessionService;
let auth: AuthenticationService;

beforeEach(async () => {
  clock = new FixedClock('2026-05-17T10:00:00.000Z');
  const passwordHash = await hashPassword(PASSWORD, config.scryptCostLog2);
  identity = new InMemoryIdentityStore([
    { id: 'buyer-1', email: 'Buyer@Example.test', role: 'buyer', passwordHash },
    {
      id: 'member-a',
      email: 'a@example.test',
      role: 'manufacturer',
      passwordHash,
      manufacturerIds: ['mfr-a'],
    },
    { id: 'no-password', email: 'nopass@example.test', role: 'buyer' },
  ]);
  sessions = new InMemorySessionStore();
  sessionService = new SessionService({ sessions, identity, clock, config });
  auth = new AuthenticationService({ identity, sessionService, clock, config });
});

describe('sign in', () => {
  it('accepts the right password and returns a bound actor', async () => {
    const result = await auth.signIn({ email: 'buyer@example.test', password: PASSWORD });

    expect(result.actor.role).toBe('buyer');
    expect(result.actor.userId).toBe('buyer-1');
    expect(result.token).toBeTypeOf('string');
    expect(identity.successfulSignIns).toEqual(['buyer-1']);
    await expect(sessionService.verify(result.token)).resolves.toBeDefined();
  });

  it('matches the address case insensitively', async () => {
    await expect(
      auth.signIn({ email: '  BUYER@example.TEST ', password: PASSWORD }),
    ).resolves.toBeDefined();
  });

  it('gives the same refusal for an unknown address and a wrong password', async () => {
    const unknown = await auth
      .signIn({ email: 'nobody@example.test', password: PASSWORD })
      .catch((error: unknown) => error);
    const wrong = await auth
      .signIn({ email: 'buyer@example.test', password: 'wrong-password-here' })
      .catch((error: unknown) => error);

    expect(unknown).toBeInstanceOf(InvalidCredentialsError);
    expect(wrong).toBeInstanceOf(InvalidCredentialsError);
    expect((unknown as InvalidCredentialsError).publicMessage).toBe(
      (wrong as InvalidCredentialsError).publicMessage,
    );
  });

  it('refuses an account with no password set', async () => {
    await expect(
      auth.signIn({ email: 'nopass@example.test', password: PASSWORD }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('refuses a suspended account even with the right password', async () => {
    identity.suspend('buyer-1', clock.now());
    await expect(
      auth.signIn({ email: 'buyer@example.test', password: PASSWORD }),
    ).rejects.toThrow(AccountSuspendedError);
  });

  it('binds a manufacturer sign in to the manufacturer', async () => {
    const result = await auth.signIn({ email: 'a@example.test', password: PASSWORD });
    expect(result.actor.manufacturerId).toBe('mfr-a');
    expect(result.session.activeManufacturerId).toBe('mfr-a');
  });

  it('refuses a manufacturer the account does not belong to', async () => {
    await expect(
      auth.signIn({
        email: 'a@example.test',
        password: PASSWORD,
        activeManufacturerId: 'mfr-b',
      }),
    ).rejects.toThrow(MembershipRequiredError);
  });
});

describe('failed attempts', () => {
  it('counts failures and locks the account, then refuses even the right password', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(
        auth.signIn({ email: 'buyer@example.test', password: 'wrong-password-here' }),
      ).rejects.toThrow(InvalidCredentialsError);
    }

    expect(identity.credentialFor('buyer-1')?.failedAttempts).toBe(3);
    expect(identity.credentialFor('buyer-1')?.lockedUntil).not.toBeNull();

    await expect(
      auth.signIn({ email: 'buyer@example.test', password: PASSWORD }),
    ).rejects.toThrow(AccountLockedError);
  });

  it('lets the account in again once the lock has expired, and resets the counter', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await auth
        .signIn({ email: 'buyer@example.test', password: 'wrong-password-here' })
        .catch(() => undefined);
    }

    clock.advanceMinutes(16);
    await expect(
      auth.signIn({ email: 'buyer@example.test', password: PASSWORD }),
    ).resolves.toBeDefined();
    expect(identity.credentialFor('buyer-1')?.failedAttempts).toBe(0);
    expect(identity.credentialFor('buyer-1')?.lockedUntil).toBeNull();
  });
});

describe('sign out and password changes', () => {
  it('ends the presented session on sign out', async () => {
    const { token } = await auth.signIn({ email: 'buyer@example.test', password: PASSWORD });
    await auth.signOut(token);
    await expect(sessionService.verify(token)).rejects.toThrow(/revoked/);
  });

  it('ends every session when the password changes', async () => {
    const first = await auth.signIn({ email: 'buyer@example.test', password: PASSWORD });
    const second = await auth.signIn({ email: 'buyer@example.test', password: PASSWORD });

    await auth.changePassword({
      userId: 'buyer-1',
      currentPassword: PASSWORD,
      newPassword: 'another-long-password',
    });

    await expect(sessionService.verify(first.token)).rejects.toThrow(/revoked/);
    await expect(sessionService.verify(second.token)).rejects.toThrow(/revoked/);
    expect(sessions.revocations.every((entry) => entry.reason === 'password_changed')).toBe(true);
  });

  it('refuses a password change without the current password', async () => {
    await expect(
      auth.changePassword({
        userId: 'buyer-1',
        currentPassword: 'not-the-password',
        newPassword: 'another-long-password',
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('accepts the new password afterwards and refuses the old one', async () => {
    await auth.changePassword({
      userId: 'buyer-1',
      currentPassword: PASSWORD,
      newPassword: 'another-long-password',
    });

    await expect(
      auth.signIn({ email: 'buyer@example.test', password: 'another-long-password' }),
    ).resolves.toBeDefined();
    await expect(
      auth.signIn({ email: 'buyer@example.test', password: PASSWORD }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('can provision a password without knowing the old one', async () => {
    await auth.setPassword('no-password', 'provisioned-password');
    await expect(
      auth.signIn({ email: 'nopass@example.test', password: 'provisioned-password' }),
    ).resolves.toBeDefined();
  });
});
