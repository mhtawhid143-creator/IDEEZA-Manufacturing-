import type { ActorRole } from '@ideeza/domain';
import type {
  BoundaryStore,
  Clock,
  CredentialRecord,
  IdentityStore,
  NewSessionRecord,
  SessionRecord,
  SessionRevocationReason,
  SessionStore,
  UserRecord,
} from '../src/ports.js';

export class FixedClock implements Clock {
  private current: Date;

  public constructor(iso: string) {
    this.current = new Date(iso);
  }

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

export interface FakeUserSeed {
  readonly id: string;
  readonly email: string;
  readonly role: ActorRole;
  readonly suspendedAt?: Date | null;
  readonly passwordHash?: string;
  readonly manufacturerIds?: readonly string[];
}

export class InMemoryIdentityStore implements IdentityStore {
  private readonly users = new Map<string, UserRecord>();
  private readonly credentials = new Map<string, CredentialRecord>();
  private readonly memberships = new Map<string, readonly string[]>();
  public readonly successfulSignIns: string[] = [];

  public constructor(seed: readonly FakeUserSeed[] = []) {
    for (const user of seed) this.add(user);
  }

  public add(user: FakeUserSeed): void {
    this.users.set(user.id, {
      id: user.id,
      email: user.email.toLowerCase(),
      role: user.role,
      suspendedAt: user.suspendedAt ?? null,
    });
    if (user.passwordHash !== undefined) {
      this.credentials.set(user.id, {
        userId: user.id,
        passwordHash: user.passwordHash,
        failedAttempts: 0,
        lockedUntil: null,
      });
    }
    this.memberships.set(user.id, user.manufacturerIds ?? []);
  }

  public suspend(userId: string, at: Date): void {
    const user = this.users.get(userId);
    if (user !== undefined) this.users.set(userId, { ...user, suspendedAt: at });
  }

  public setRole(userId: string, role: ActorRole): void {
    const user = this.users.get(userId);
    if (user !== undefined) this.users.set(userId, { ...user, role });
  }

  public setMemberships(userId: string, manufacturerIds: readonly string[]): void {
    this.memberships.set(userId, manufacturerIds);
  }

  public credentialFor(userId: string): CredentialRecord | undefined {
    return this.credentials.get(userId);
  }

  public async findUserByEmail(email: string): Promise<UserRecord | null> {
    for (const user of this.users.values()) {
      if (user.email === email.toLowerCase()) return user;
    }
    return null;
  }

  public async findUserById(userId: string): Promise<UserRecord | null> {
    return this.users.get(userId) ?? null;
  }

  public async findCredential(userId: string): Promise<CredentialRecord | null> {
    return this.credentials.get(userId) ?? null;
  }

  public async saveCredential(userId: string, passwordHash: string): Promise<void> {
    this.credentials.set(userId, {
      userId,
      passwordHash,
      failedAttempts: 0,
      lockedUntil: null,
    });
  }

  public async recordFailedAttempt(
    userId: string,
    failedAttempts: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    const existing = this.credentials.get(userId);
    if (existing === undefined) return;
    this.credentials.set(userId, { ...existing, failedAttempts, lockedUntil });
  }

  public async recordSuccessfulSignIn(userId: string): Promise<void> {
    this.successfulSignIns.push(userId);
    const existing = this.credentials.get(userId);
    if (existing === undefined) return;
    this.credentials.set(userId, { ...existing, failedAttempts: 0, lockedUntil: null });
  }

  public async listManufacturerMemberships(userId: string): Promise<readonly string[]> {
    return this.memberships.get(userId) ?? [];
  }
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();
  public readonly revocations: { id: string; reason: SessionRevocationReason }[] = [];

  public async create(record: NewSessionRecord): Promise<SessionRecord> {
    const stored: SessionRecord = {
      id: record.id,
      userId: record.userId,
      tokenHash: record.tokenHash,
      role: record.role,
      activeManufacturerId: record.activeManufacturerId,
      issuedAt: record.issuedAt,
      lastSeenAt: record.issuedAt,
      idleExpiresAt: record.idleExpiresAt,
      absoluteExpiresAt: record.absoluteExpiresAt,
      revokedAt: null,
    };
    this.sessions.set(stored.id, stored);
    return stored;
  }

  public async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    for (const session of this.sessions.values()) {
      if (session.tokenHash === tokenHash) return session;
    }
    return null;
  }

  public async touch(
    sessionId: string,
    lastSeenAt: Date,
    idleExpiresAt: Date,
  ): Promise<SessionRecord> {
    const existing = this.sessions.get(sessionId);
    if (existing === undefined) throw new Error(`unknown session ${sessionId}`);
    const updated: SessionRecord = { ...existing, lastSeenAt, idleExpiresAt };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  public async revoke(
    sessionId: string,
    at: Date,
    reason: SessionRevocationReason,
  ): Promise<void> {
    const existing = this.sessions.get(sessionId);
    if (existing === undefined) return;
    this.sessions.set(sessionId, { ...existing, revokedAt: at });
    this.revocations.push({ id: sessionId, reason });
  }

  public async revokeAllForUser(
    userId: string,
    at: Date,
    reason: SessionRevocationReason,
  ): Promise<number> {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.userId !== userId || session.revokedAt !== null) continue;
      this.sessions.set(session.id, { ...session, revokedAt: at });
      this.revocations.push({ id: session.id, reason });
      count += 1;
    }
    return count;
  }

  public async deleteExpiredBefore(cutoff: Date): Promise<number> {
    let count = 0;
    for (const session of [...this.sessions.values()]) {
      if (session.absoluteExpiresAt.getTime() < cutoff.getTime()) {
        this.sessions.delete(session.id);
        count += 1;
      }
    }
    return count;
  }

  public get size(): number {
    return this.sessions.size;
  }
}

/**
 * A small fixture that mirrors the seeded scenario: one request from buyer-1
 * routed to manufacturer A and B, a quote from each, and an order for A.
 */
export const fixtureBoundaryStore = (): BoundaryStore => {
  const recipients = [
    { rfqId: 'rfq-1', manufacturerId: 'mfr-a' },
    { rfqId: 'rfq-1', manufacturerId: 'mfr-b' },
  ];
  const quotes = [
    { id: 'quote-a', rfqId: 'rfq-1', manufacturerId: 'mfr-a' },
    { id: 'quote-b', rfqId: 'rfq-1', manufacturerId: 'mfr-b' },
  ];

  return {
    findRfqOwnership: async (rfqId) =>
      rfqId === 'rfq-1' ? { id: 'rfq-1', buyerId: 'buyer-1' } : null,
    listRfqRecipients: async (rfqId) => recipients.filter((row) => row.rfqId === rfqId),
    findQuoteOwnership: async (quoteId) => quotes.find((row) => row.id === quoteId) ?? null,
    listQuotesForRfq: async (rfqId) => quotes.filter((row) => row.rfqId === rfqId),
    findOrderOwnership: async (orderId) =>
      orderId === 'order-1'
        ? { id: 'order-1', buyerId: 'buyer-1', manufacturerId: 'mfr-a' }
        : null,
    findInventoryOwnership: async (itemId) =>
      itemId === 'inv-a' ? { id: 'inv-a', manufacturerId: 'mfr-a' } : null,
    findPayoutOwnership: async (payoutId) =>
      payoutId === 'payout-1' ? { id: 'payout-1', manufacturerId: 'mfr-a' } : null,
  };
};
