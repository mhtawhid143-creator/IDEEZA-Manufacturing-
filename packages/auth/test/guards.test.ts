import { beforeEach, describe, expect, it } from 'vitest';
import {
  PermissionDeniedError,
  asId,
  type ManufacturerId,
  type UserId,
} from '@ideeza/domain';
import type { AuthenticatedActor } from '../src/actor.js';
import { SESSION_COOKIE_NAME, DEFAULT_AUTH_CONFIG } from '../src/config.js';
import { NoSessionError } from '../src/errors.js';
import {
  authenticateRequest,
  guardRequest,
  parseCookies,
  readSessionToken,
  requireAnyCapability,
  requireCapability,
  requireRole,
  requireSelf,
} from '../src/guards.js';
import { SessionService } from '../src/session.js';
import { FixedClock, InMemoryIdentityStore, InMemorySessionStore } from './fakes.js';

const makeActor = (
  role: AuthenticatedActor['role'],
  userId: string,
  manufacturerId?: string,
): AuthenticatedActor => ({
  sessionId: 'sess_1',
  userId: asId<UserId>(userId),
  email: `${userId}@example.test`,
  role,
  manufacturerId:
    manufacturerId === undefined ? undefined : asId<ManufacturerId>(manufacturerId),
});

const buyer = makeActor('buyer', 'user-1');
const manufacturer = makeActor('manufacturer', 'member-a', 'mfr-a');
const ops = makeActor('ops_admin', 'ops-1');

describe('reading the session token from a request', () => {
  it('reads a bearer token', () => {
    expect(readSessionToken({ headers: { authorization: 'Bearer abc123' } })).toBe('abc123');
    expect(readSessionToken({ headers: { Authorization: 'bearer abc123' } })).toBe('abc123');
  });

  it('reads the session cookie', () => {
    const token = readSessionToken({
      headers: { cookie: `other=1; ${SESSION_COOKIE_NAME}=abc123; more=2` },
    });
    expect(token).toBe('abc123');
  });

  it('works with a Headers style bag', () => {
    const headers = new Map([['authorization', 'Bearer abc123']]);
    const token = readSessionToken({
      headers: { get: (name: string) => headers.get(name) ?? null },
    });
    expect(token).toBe('abc123');
  });

  it('ignores anything else, including a token in the url', () => {
    expect(readSessionToken({ headers: {} })).toBeUndefined();
    expect(readSessionToken({ headers: { authorization: 'Basic abc' } })).toBeUndefined();
    expect(
      readSessionToken({ headers: {}, url: '/page?token=abc123' }),
    ).toBeUndefined();
  });

  it('parses cookies without tripping over spacing or encoding', () => {
    expect(parseCookies('a=1;b=two%20words')).toEqual({ a: '1', b: 'two words' });
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('=novalue')).toEqual({});
  });
});

describe('capability and role guards', () => {
  it('lets a buyer do buyer things and refuses manufacturer things', () => {
    expect(() => requireCapability(buyer, 'rfq.create')).not.toThrow();
    expect(() => requireCapability(buyer, 'quote.create')).toThrow(PermissionDeniedError);
    expect(() => requireCapability(buyer, 'inventory.read')).toThrow(PermissionDeniedError);
  });

  it('lets a manufacturer quote and refuses it buyer things', () => {
    expect(() => requireCapability(manufacturer, 'quote.create')).not.toThrow();
    expect(() => requireCapability(manufacturer, 'rfq.decline')).not.toThrow();
    expect(() => requireCapability(manufacturer, 'quote.accept')).toThrow(PermissionDeniedError);
    expect(() => requireCapability(manufacturer, 'checkout.pay')).toThrow(PermissionDeniedError);
  });

  it('reserves the operations decisions for operations', () => {
    for (const capability of [
      'payout.release',
      'dispute.resolve',
      'refund.decide',
      'cancellation.decide',
    ] as const) {
      expect(() => requireCapability(ops, capability)).not.toThrow();
      expect(() => requireCapability(buyer, capability)).toThrow(PermissionDeniedError);
      expect(() => requireCapability(manufacturer, capability)).toThrow(PermissionDeniedError);
    }
  });

  it('refuses a manufacturer actor with no manufacturer binding', () => {
    const unbound = makeActor('manufacturer', 'member-a');
    expect(() => requireCapability(unbound, 'quote.create')).toThrow(
      /must carry the manufacturer/,
    );
  });

  it('checks roles and any-of capabilities', () => {
    expect(() => requireRole(buyer, ['buyer'])).not.toThrow();
    expect(() => requireRole(buyer, ['manufacturer', 'ops_admin'])).toThrow(
      PermissionDeniedError,
    );
    expect(() => requireAnyCapability(buyer, ['quote.create', 'rfq.create'])).not.toThrow();
    expect(() => requireAnyCapability(buyer, ['quote.create', 'inventory.write'])).toThrow(
      PermissionDeniedError,
    );
  });

  it('keeps an actor out of another account own data, but lets operations through', () => {
    expect(() => requireSelf(buyer, 'user-1')).not.toThrow();
    expect(() => requireSelf(buyer, 'someone-else')).toThrow(PermissionDeniedError);
    expect(() => requireSelf(ops, 'someone-else')).not.toThrow();
  });
});

describe('guarding a whole request', () => {
  const config = { ...DEFAULT_AUTH_CONFIG, idleWindowMinutes: 60 };
  let sessionService: SessionService;
  let token: string;

  beforeEach(async () => {
    const clock = new FixedClock('2026-05-17T10:00:00.000Z');
    const identity = new InMemoryIdentityStore([
      { id: 'buyer-1', email: 'buyer@example.test', role: 'buyer' },
    ]);
    sessionService = new SessionService({
      sessions: new InMemorySessionStore(),
      identity,
      clock,
      config,
    });
    token = (await sessionService.issue({ userId: 'buyer-1', role: 'buyer' })).token;
  });

  it('authenticates, then applies role and capability', async () => {
    const request = { headers: { authorization: `Bearer ${token}` } };

    const resolved = await guardRequest(request, sessionService, {
      roles: ['buyer'],
      capability: 'rfq.create',
    });
    expect(resolved.userId).toBe('buyer-1');

    await expect(
      guardRequest(request, sessionService, { capability: 'quote.create' }),
    ).rejects.toThrow(PermissionDeniedError);
    await expect(
      guardRequest(request, sessionService, { roles: ['manufacturer'] }),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('refuses a request with no token at all', async () => {
    await expect(authenticateRequest({ headers: {} }, sessionService)).rejects.toThrow(
      NoSessionError,
    );
  });
});
