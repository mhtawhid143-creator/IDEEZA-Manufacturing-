import type { ActorRole } from '@ideeza/domain';
import { actorFromSession, type AuthenticatedActor } from './actor.js';
import { authConfigFromEnvironment, type AuthConfig } from './config.js';
import {
  AccountSuspendedError,
  MembershipRequiredError,
  NoSessionError,
  SessionExpiredError,
  SessionInvalidError,
} from './errors.js';
import {
  systemClock,
  type Clock,
  type IdentityStore,
  type SessionRecord,
  type SessionRevocationReason,
  type SessionStore,
} from './ports.js';
import { createSessionToken, hashSessionToken, looksLikeSessionToken, newSessionId } from './tokens.js';

export interface IssueSessionInput {
  readonly userId: string;
  readonly role: ActorRole;
  readonly activeManufacturerId?: string | undefined;
  readonly userAgent?: string | undefined;
  readonly ipAddress?: string | undefined;
}

export interface IssuedSession {
  /** Returned once. Only its hash is stored. */
  readonly token: string;
  readonly session: SessionRecord;
}

export interface SessionServiceDeps {
  readonly sessions: SessionStore;
  readonly identity: IdentityStore;
  readonly clock?: Clock;
  readonly config?: AuthConfig;
  readonly generateId?: () => string;
  readonly generateToken?: () => string;
}

const minutes = (count: number): number => count * 60_000;
const days = (count: number): number => count * 24 * 60 * 60_000;

export class SessionService {
  private readonly sessions: SessionStore;
  private readonly identity: IdentityStore;
  private readonly clock: Clock;
  private readonly config: AuthConfig;
  private readonly generateId: () => string;
  private readonly generateToken: () => string;

  public constructor(deps: SessionServiceDeps) {
    this.sessions = deps.sessions;
    this.identity = deps.identity;
    this.clock = deps.clock ?? systemClock;
    this.config = deps.config ?? authConfigFromEnvironment();
    this.generateId = deps.generateId ?? newSessionId;
    this.generateToken = deps.generateToken ?? createSessionToken;
  }

  /**
   * Issues a session. A manufacturer session must name the manufacturer it acts
   * for and the membership is verified here, not trusted from the caller.
   */
  public async issue(input: IssueSessionInput): Promise<IssuedSession> {
    const now = this.clock.now();
    const activeManufacturerId = await this.resolveManufacturerBinding(
      input.userId,
      input.role,
      input.activeManufacturerId,
    );

    const token = this.generateToken();
    const session = await this.sessions.create({
      id: this.generateId(),
      userId: input.userId,
      tokenHash: hashSessionToken(token),
      role: input.role,
      activeManufacturerId,
      issuedAt: now,
      idleExpiresAt: new Date(now.getTime() + minutes(this.config.idleWindowMinutes)),
      absoluteExpiresAt: new Date(now.getTime() + days(this.config.absoluteWindowDays)),
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });

    return { token, session };
  }

  /**
   * Verifies a presented token and slides the idle window forward.
   *
   * The absolute window is never extended, so a stolen token cannot be kept
   * alive indefinitely by using it.
   */
  public async verify(token: string | undefined): Promise<SessionRecord> {
    if (token === undefined || token === '') throw new NoSessionError();
    if (!looksLikeSessionToken(token)) throw new SessionInvalidError('malformed token');

    const found = await this.sessions.findByTokenHash(hashSessionToken(token));
    if (found === null) throw new SessionInvalidError('unknown token');
    if (found.revokedAt !== null) throw new SessionInvalidError('revoked');

    const now = this.clock.now();
    if (now.getTime() >= found.absoluteExpiresAt.getTime()) {
      throw new SessionExpiredError('absolute');
    }
    if (now.getTime() >= found.idleExpiresAt.getTime()) {
      throw new SessionExpiredError('idle');
    }

    const sinceLastSeen = now.getTime() - found.lastSeenAt.getTime();
    if (sinceLastSeen < this.config.touchIntervalSeconds * 1000) return found;

    const slidTo = Math.min(
      now.getTime() + minutes(this.config.idleWindowMinutes),
      found.absoluteExpiresAt.getTime(),
    );
    return this.sessions.touch(found.id, now, new Date(slidTo));
  }

  /**
   * Verifies the token and turns it into an actor, re-checking everything that
   * can change after a session is issued: suspension, the account role and
   * manufacturer membership.
   */
  public async resolveActor(token: string | undefined): Promise<AuthenticatedActor> {
    const session = await this.verify(token);
    const user = await this.identity.findUserById(session.userId);

    if (user === null) {
      await this.sessions.revoke(session.id, this.clock.now(), 'revoked_by_operations');
      throw new SessionInvalidError('the account no longer exists');
    }
    if (user.suspendedAt !== null) {
      await this.sessions.revoke(session.id, this.clock.now(), 'account_suspended');
      throw new AccountSuspendedError(user.id);
    }
    if (user.role !== session.role) {
      await this.sessions.revoke(session.id, this.clock.now(), 'revoked_by_operations');
      throw new SessionInvalidError('the account role changed since sign in');
    }
    if (session.activeManufacturerId !== null) {
      const memberships = await this.identity.listManufacturerMemberships(user.id);
      if (!memberships.includes(session.activeManufacturerId)) {
        await this.sessions.revoke(session.id, this.clock.now(), 'revoked_by_operations');
        throw new MembershipRequiredError(user.id, session.activeManufacturerId);
      }
    }

    return actorFromSession(session, user);
  }

  /** Replaces a live session with a fresh one, keeping the same binding. */
  public async rotate(token: string): Promise<IssuedSession> {
    const current = await this.verify(token);
    const issued = await this.issue({
      userId: current.userId,
      role: current.role,
      activeManufacturerId: current.activeManufacturerId ?? undefined,
    });
    await this.sessions.revoke(current.id, this.clock.now(), 'rotated');
    return issued;
  }

  public async revoke(
    token: string,
    reason: SessionRevocationReason = 'signed_out',
  ): Promise<void> {
    if (!looksLikeSessionToken(token)) return;
    const found = await this.sessions.findByTokenHash(hashSessionToken(token));
    if (found === null || found.revokedAt !== null) return;
    await this.sessions.revoke(found.id, this.clock.now(), reason);
  }

  public async revokeAllForUser(
    userId: string,
    reason: SessionRevocationReason,
  ): Promise<number> {
    return this.sessions.revokeAllForUser(userId, this.clock.now(), reason);
  }

  /** Removes sessions whose absolute window closed before the cutoff. */
  public async purgeExpired(): Promise<number> {
    return this.sessions.deleteExpiredBefore(this.clock.now());
  }

  private async resolveManufacturerBinding(
    userId: string,
    role: ActorRole,
    requested: string | undefined,
  ): Promise<string | null> {
    if (role !== 'manufacturer') {
      if (requested !== undefined) {
        throw new SessionInvalidError(
          'only a manufacturer session may act for a manufacturer',
        );
      }
      return null;
    }

    const memberships = await this.identity.listManufacturerMemberships(userId);
    if (requested !== undefined) {
      if (!memberships.includes(requested)) {
        throw new MembershipRequiredError(userId, requested);
      }
      return requested;
    }
    const only = memberships.length === 1 ? memberships[0] : undefined;
    if (only === undefined) {
      throw new MembershipRequiredError(
        userId,
        memberships.length === 0 ? '(none)' : '(ambiguous)',
      );
    }
    return only;
  }
}
