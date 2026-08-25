/**
 * Authentication failures are deliberately coarse on the outside and precise on
 * the inside: the message that reaches a caller must not tell an attacker
 * whether an address exists, while the code lets the platform log what happened.
 */
export abstract class AuthError extends Error {
  public abstract readonly code: string;
  /** Safe to show to the person signing in. */
  public abstract readonly publicMessage: string;

  public constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidCredentialsError extends AuthError {
  public override readonly code = 'INVALID_CREDENTIALS';
  public override readonly publicMessage = 'The email address or password is incorrect.';

  public constructor(reason: string) {
    super(`invalid credentials: ${reason}`);
  }
}

export class AccountLockedError extends AuthError {
  public override readonly code = 'ACCOUNT_LOCKED';
  public override readonly publicMessage =
    'Too many failed attempts. Try again later.';

  public constructor(public readonly lockedUntil: Date) {
    super(`account locked until ${lockedUntil.toISOString()}`);
  }
}

export class AccountSuspendedError extends AuthError {
  public override readonly code = 'ACCOUNT_SUSPENDED';
  public override readonly publicMessage = 'This account is suspended.';

  public constructor(userId: string) {
    super(`account ${userId} is suspended`);
  }
}

export class NoSessionError extends AuthError {
  public override readonly code = 'NO_SESSION';
  public override readonly publicMessage = 'Sign in to continue.';

  public constructor(reason = 'no session token was presented') {
    super(reason);
  }
}

export class SessionInvalidError extends AuthError {
  public override readonly code = 'SESSION_INVALID';
  public override readonly publicMessage = 'Your session is no longer valid. Sign in again.';

  public constructor(reason: string) {
    super(`session invalid: ${reason}`);
  }
}

export class SessionExpiredError extends AuthError {
  public override readonly code = 'SESSION_EXPIRED';
  public override readonly publicMessage = 'Your session has expired. Sign in again.';

  public constructor(kind: 'idle' | 'absolute') {
    super(`session expired (${kind} window)`);
  }
}

export class MembershipRequiredError extends AuthError {
  public override readonly code = 'MEMBERSHIP_REQUIRED';
  public override readonly publicMessage =
    'This account is not a member of that manufacturer.';

  public constructor(userId: string, manufacturerId: string) {
    super(`user ${userId} is not a member of manufacturer ${manufacturerId}`);
  }
}

export class RouteForbiddenError extends AuthError {
  public override readonly code = 'ROUTE_FORBIDDEN';
  public override readonly publicMessage = 'You do not have access to this page.';

  public constructor(
    public readonly surface: string,
    public readonly path: string,
    reason: string,
  ) {
    super(`route ${surface}:${path} refused (${reason})`);
  }
}
