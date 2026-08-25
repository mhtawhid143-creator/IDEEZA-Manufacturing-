import { authConfigFromEnvironment, type AuthConfig } from './config.js';
import {
  AccountLockedError,
  AccountSuspendedError,
  InvalidCredentialsError,
} from './errors.js';
import { hashPassword, passwordNeedsRehash, verifyPassword } from './password.js';
import { systemClock, type Clock, type IdentityStore } from './ports.js';
import type { AuthenticatedActor } from './actor.js';
import { actorFromSession } from './actor.js';
import type { SessionService } from './session.js';
import type { SessionRecord } from './ports.js';

/**
 * A hash of a value nobody knows, used to spend the same time on an unknown
 * address as on a known one. Without it, response time alone would reveal which
 * addresses have accounts.
 */
const DECOY_HASH =
  'scrypt$15$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export interface SignInInput {
  readonly email: string;
  readonly password: string;
  /** Required when the account belongs to more than one manufacturer. */
  readonly activeManufacturerId?: string | undefined;
  readonly userAgent?: string | undefined;
  readonly ipAddress?: string | undefined;
}

export interface SignInResult {
  readonly token: string;
  readonly session: SessionRecord;
  readonly actor: AuthenticatedActor;
}

export interface AuthenticationServiceDeps {
  readonly identity: IdentityStore;
  readonly sessionService: SessionService;
  readonly clock?: Clock;
  readonly config?: AuthConfig;
}

export class AuthenticationService {
  private readonly identity: IdentityStore;
  private readonly sessionService: SessionService;
  private readonly clock: Clock;
  private readonly config: AuthConfig;

  public constructor(deps: AuthenticationServiceDeps) {
    this.identity = deps.identity;
    this.sessionService = deps.sessionService;
    this.clock = deps.clock ?? systemClock;
    this.config = deps.config ?? authConfigFromEnvironment();
  }

  public async signIn(input: SignInInput): Promise<SignInResult> {
    const now = this.clock.now();
    const email = input.email.trim().toLowerCase();
    const user = await this.identity.findUserByEmail(email);

    if (user === null) {
      await verifyPassword(input.password, DECOY_HASH);
      throw new InvalidCredentialsError('no account for this address');
    }

    const credential = await this.identity.findCredential(user.id);
    if (credential === null) {
      await verifyPassword(input.password, DECOY_HASH);
      throw new InvalidCredentialsError('the account has no password set');
    }

    if (credential.lockedUntil !== null && credential.lockedUntil.getTime() > now.getTime()) {
      throw new AccountLockedError(credential.lockedUntil);
    }

    if (user.suspendedAt !== null) {
      throw new AccountSuspendedError(user.id);
    }

    const matches = await verifyPassword(input.password, credential.passwordHash);
    if (!matches) {
      const attempts = credential.failedAttempts + 1;
      const lockedUntil =
        attempts >= this.config.maxFailedAttempts
          ? new Date(now.getTime() + this.config.lockMinutes * 60_000)
          : null;
      await this.identity.recordFailedAttempt(user.id, attempts, lockedUntil);
      throw new InvalidCredentialsError('password mismatch');
    }

    await this.identity.recordSuccessfulSignIn(user.id, now);

    if (passwordNeedsRehash(credential.passwordHash, this.config.scryptCostLog2)) {
      await this.identity.saveCredential(
        user.id,
        await hashPassword(input.password, this.config.scryptCostLog2),
        now,
      );
    }

    const issued = await this.sessionService.issue({
      userId: user.id,
      role: user.role,
      activeManufacturerId: input.activeManufacturerId,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });

    return {
      token: issued.token,
      session: issued.session,
      actor: actorFromSession(issued.session, user),
    };
  }

  public async signOut(token: string): Promise<void> {
    await this.sessionService.revoke(token, 'signed_out');
  }

  /**
   * Changing a password ends every other session for that account, because the
   * usual reason to change it is that the old one may be known to someone else.
   */
  public async changePassword(input: {
    readonly userId: string;
    readonly currentPassword: string;
    readonly newPassword: string;
  }): Promise<void> {
    const credential = await this.identity.findCredential(input.userId);
    if (credential === null) throw new InvalidCredentialsError('no password is set');

    const matches = await verifyPassword(input.currentPassword, credential.passwordHash);
    if (!matches) throw new InvalidCredentialsError('current password mismatch');

    const now = this.clock.now();
    await this.identity.saveCredential(
      input.userId,
      await hashPassword(input.newPassword, this.config.scryptCostLog2),
      now,
    );
    await this.sessionService.revokeAllForUser(input.userId, 'password_changed');
  }

  /** Sets a password without knowing the old one; for provisioning and support. */
  public async setPassword(userId: string, newPassword: string): Promise<void> {
    const now = this.clock.now();
    await this.identity.saveCredential(
      userId,
      await hashPassword(newPassword, this.config.scryptCostLog2),
      now,
    );
    await this.sessionService.revokeAllForUser(userId, 'password_changed');
  }
}
