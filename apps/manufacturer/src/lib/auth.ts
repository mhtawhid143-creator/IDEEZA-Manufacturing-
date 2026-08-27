import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  AuthError,
  SESSION_COOKIE_NAME,
  assertRouteAccess,
  createAuthServices,
  type AuthServices,
  type AuthenticatedActor,
} from '@ideeza/auth';
import { PermissionDeniedError, type ManufacturerId } from '@ideeza/domain';
import { database } from './db.js';

/** The surface this app serves. Everything here is checked against it. */
export const SURFACE = 'manufacturer' as const;

export const authServices = (): AuthServices => createAuthServices(database());

/** Reads the actor for the current request, or null when there is no session. */
export const currentActor = async (): Promise<AuthenticatedActor | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (token === undefined || token === '') return null;
  try {
    return await authServices().sessionService.resolveActor(token);
  } catch (error) {
    if (error instanceof AuthError) return null;
    throw error;
  }
};

const signInHref = (path: string): string =>
  `/auth/sign-in?next=${encodeURIComponent(path)}`;

export interface ManufacturerActor extends AuthenticatedActor {
  /** The shop this member is acting for. Every read is scoped to it. */
  readonly manufacturerId: ManufacturerId;
}

/**
 * The gate every page inside the shell passes through.
 *
 * Two things have to hold, and they are different things: the account is a
 * manufacturer account with the capability the route needs, and it is acting for
 * a particular shop. Without the second there is nothing to scope a query to —
 * an account with no membership would otherwise read the whole platform — so it
 * is refused here rather than defended in every query.
 */
export const requireManufacturer = async (path: string): Promise<ManufacturerActor> => {
  const actor = await currentActor();
  if (actor === null) redirect(signInHref(path));

  try {
    assertRouteAccess(SURFACE, path, actor);
  } catch (error) {
    if (error instanceof PermissionDeniedError || error instanceof AuthError) {
      // A buyer or operations account has no business on this surface.
      redirect('/forbidden');
    }
    throw error;
  }

  if (actor.manufacturerId === undefined) {
    redirect('/forbidden');
  }

  return actor as ManufacturerActor;
};
