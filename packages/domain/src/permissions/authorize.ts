import { PermissionDeniedError } from '../errors.js';
import type { ManufacturerId, UserId } from '../ids.js';
import type { ActorRole } from '../status/index.js';
import type { Capability } from './capabilities.js';
import { PERMISSION_MATRIX } from './matrix.js';

export interface Actor {
  readonly role: ActorRole;
  readonly userId?: UserId | undefined;
  /** Present when the actor acts on behalf of a manufacturer organisation. */
  readonly manufacturerId?: ManufacturerId | undefined;
}

/** Deny by default. An unknown capability is refused rather than allowed. */
export const can = (role: ActorRole, capability: Capability): boolean => {
  const allowed = PERMISSION_MATRIX[capability];
  if (allowed === undefined) return false;
  return allowed.includes(role);
};

export const assertCan = (actor: Actor, capability: Capability): void => {
  if (!can(actor.role, capability)) {
    throw new PermissionDeniedError(capability, actor.role);
  }
  if (actor.role === 'manufacturer' && actor.manufacturerId === undefined) {
    throw new PermissionDeniedError(
      capability,
      actor.role,
      'a manufacturer actor must carry the manufacturer it acts for',
    );
  }
};
