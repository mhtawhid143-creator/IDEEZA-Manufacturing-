/** Base class for every rule violation raised by the domain layer. */
export abstract class DomainError extends Error {
  public abstract readonly code: string;

  public constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** A status change that the relevant state machine does not allow. */
export class InvalidTransitionError extends DomainError {
  public override readonly code = 'INVALID_TRANSITION';

  public constructor(
    public readonly machine: string,
    public readonly from: string,
    public readonly to: string,
    reason?: string,
  ) {
    super(
      `${machine}: transition ${from} -> ${to} is not allowed${reason ? ` (${reason})` : ''}.`,
    );
  }
}

/** A business rule from the approved business model that must always hold. */
export class InvariantViolationError extends DomainError {
  public override readonly code = 'INVARIANT_VIOLATION';

  public constructor(
    public readonly invariant: string,
    message: string,
  ) {
    super(`${invariant}: ${message}`);
  }
}

/** The actor is not allowed to perform the requested capability. */
export class PermissionDeniedError extends DomainError {
  public override readonly code = 'PERMISSION_DENIED';

  public constructor(
    public readonly capability: string,
    public readonly role: string,
    reason?: string,
  ) {
    super(
      `Role "${role}" may not perform "${capability}"${reason ? ` (${reason})` : ''}.`,
    );
  }
}
