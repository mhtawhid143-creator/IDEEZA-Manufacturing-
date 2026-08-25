'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthError, SESSION_COOKIE_NAME } from '@ideeza/auth';
import { authServices } from '@/lib/auth.js';

export interface SignInState {
  readonly error?: string;
  /**
   * React resets an uncontrolled form once its action completes, so the address
   * is handed back and re-applied: a failed attempt should not make the visitor
   * retype it.
   */
  readonly email?: string;
}

const isSafeNext = (value: string | null): value is string =>
  value !== null && value.startsWith('/') && !value.startsWith('//');

/**
 * Signs in with the T03 service and stores the session token in an HttpOnly
 * cookie. The token never reaches client JavaScript, and the refusal message is
 * the public one, so an unknown address and a wrong password read the same.
 */
export const signInAction = async (
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> => {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const nextPath = formData.get('next');
  const target = isSafeNext(typeof nextPath === 'string' ? nextPath : null)
    ? String(nextPath)
    : '/manufacturing';

  if (email === '' || password === '') {
    return { error: 'Enter your email address and password.', email };
  }

  try {
    const services = authServices();
    const result = await services.authentication.signIn({ email, password });

    const store = await cookies();
    store.set(SESSION_COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: result.session.absoluteExpiresAt,
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: error.publicMessage, email };
    throw error;
  }

  redirect(target);
};

export const signOutAction = async (): Promise<void> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (token !== undefined && token !== '') {
    try {
      await authServices().authentication.signOut(token);
    } catch (error) {
      if (!(error instanceof AuthError)) throw error;
    }
  }
  store.delete(SESSION_COOKIE_NAME);
  redirect('/auth/sign-in');
};
