import type { ActorRole } from '@ideeza/domain';

export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly role: ActorRole;
  readonly suspendedAt: Date | null;
}

export interface CredentialRecord {
  readonly userId: string;
  readonly passwordHash: string;
  readonly failedAttempts: number;
  readonly lockedUntil: Date | null;
}

export interface SessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly role: ActorRole;
  readonly activeManufacturerId: string | null;
  readonly issuedAt: Date;
  readonly lastSeenAt: Date;
  readonly idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly revokedAt: Date | null;
}

export type SessionRevocationReason =
  | 'signed_out'
  | 'rotated'
  | 'password_changed'
  | 'revoked_by_operations'
  | 'account_suspended';

export interface NewSessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly role: ActorRole;
  readonly activeManufacturerId: string | null;
  readonly issuedAt: Date;
  readonly idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly userAgent?: string | undefined;
  readonly ipAddress?: string | undefined;
}

/** Identity and credential persistence. */
export interface IdentityStore {
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(userId: string): Promise<UserRecord | null>;
  findCredential(userId: string): Promise<CredentialRecord | null>;
  saveCredential(userId: string, passwordHash: string, changedAt: Date): Promise<void>;
  recordFailedAttempt(
    userId: string,
    failedAttempts: number,
    lockedUntil: Date | null,
  ): Promise<void>;
  recordSuccessfulSignIn(userId: string, at: Date): Promise<void>;
  listManufacturerMemberships(userId: string): Promise<readonly string[]>;
}

/** Session persistence. */
export interface SessionStore {
  create(record: NewSessionRecord): Promise<SessionRecord>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  touch(sessionId: string, lastSeenAt: Date, idleExpiresAt: Date): Promise<SessionRecord>;
  revoke(sessionId: string, at: Date, reason: SessionRevocationReason): Promise<void>;
  revokeAllForUser(userId: string, at: Date, reason: SessionRevocationReason): Promise<number>;
  deleteExpiredBefore(cutoff: Date): Promise<number>;
}

/**
 * Read side of the ownership checks. Only the columns an access decision needs
 * are exposed, so a boundary check can never accidentally leak a whole record.
 */
export interface BoundaryStore {
  findRfqOwnership(rfqId: string): Promise<{ readonly id: string; readonly buyerId: string } | null>;
  listRfqRecipients(
    rfqId: string,
  ): Promise<readonly { readonly rfqId: string; readonly manufacturerId: string }[]>;
  findQuoteOwnership(quoteId: string): Promise<
    | {
        readonly id: string;
        readonly rfqId: string;
        readonly manufacturerId: string;
      }
    | null
  >;
  listQuotesForRfq(rfqId: string): Promise<
    readonly {
      readonly id: string;
      readonly rfqId: string;
      readonly manufacturerId: string;
    }[]
  >;
  findOrderOwnership(orderId: string): Promise<
    | {
        readonly id: string;
        readonly buyerId: string;
        readonly manufacturerId: string;
      }
    | null
  >;
  findInventoryOwnership(
    itemId: string,
  ): Promise<{ readonly id: string; readonly manufacturerId: string } | null>;
  findPayoutOwnership(
    payoutId: string,
  ): Promise<{ readonly id: string; readonly manufacturerId: string } | null>;
}

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
