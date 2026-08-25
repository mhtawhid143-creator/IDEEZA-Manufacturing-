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
import { PermissionDeniedError } from '@ideeza/domain';
import { database } from './db.js';

/** The surface this app serves. Everything here is checked against it. */
export const SURFACE = 'user' as const;

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

/**
 * The gate every page inside the shell passes through.
 *
 * Authentication and authorisation both happen here on the server: the
 * middleware only checks that a cookie exists, which is not a permission
 * decision. A path with no rule in the shared table is refused, so adding a page
 * without deciding who may see it fails closed.
 */
export const requireBuyer = async (path: string): Promise<AuthenticatedActor> => {
  const actor = await currentActor();
  if (actor === null) redirect(signInHref(path));

  try {
    assertRouteAccess(SURFACE, path, actor);
  } catch (error) {
    if (error instanceof PermissionDeniedError || error instanceof AuthError) {
      // A manufacturer or operations account has no business on this surface.
      redirect('/forbidden');
    }
    throw error;
  }

  return actor;
};
