import { asId, type Actor, type ManufacturerId, type UserId } from '@ideeza/domain';
import type { SessionRecord, UserRecord } from './ports.js';

/**
 * The actor every downstream check is made against.
 *
 * It carries the session it came from so that a permission failure can be traced
 * back to a specific sign-in, and it is the only shape the guards accept: a
 * request cannot invent a role by passing a plain object around, because the
 * actor is always derived from a stored session.
 */
export interface AuthenticatedActor extends Actor {
  readonly sessionId: string;
  readonly userId: UserId;
  readonly email: string;
}

export const actorFromSession = (
  session: SessionRecord,
  user: UserRecord,
): AuthenticatedActor => {
  const base = {
    sessionId: session.id,
    userId: asId<UserId>(user.id),
    email: user.email,
    role: session.role,
  };
  return session.activeManufacturerId === null
    ? Object.freeze({ ...base, manufacturerId: undefined })
    : Object.freeze({
        ...base,
        manufacturerId: asId<ManufacturerId>(session.activeManufacturerId),
      });
};

export const isManufacturerActor = (
  actor: Actor,
): actor is Actor & { readonly manufacturerId: ManufacturerId } =>
  actor.role === 'manufacturer' && actor.manufacturerId !== undefined;
