import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@ideeza/auth';
import { authServices } from '@/lib/auth.js';
import {
  REVIEW_TOKEN_COOKIE_NAME,
  directSignInAccounts,
  directSignInAdmitted,
} from '@/lib/direct-sign-in.js';

/**
 * Review mode's way in: no form, no password, straight to the panel.
 *
 * `?as=<email>` names the shop member to enter as; without it the account with the
 * most to read is used. `?next=` is where to land, and only an in-app path is
 * accepted so this cannot be turned into an open redirect.
 *
 * When `REVIEW_DIRECT_SIGN_IN` is not set this route does not exist — it answers
 * 404 exactly as an unbuilt path would, rather than explaining itself. Off the
 * local machine it also answers 404 unless the request carries the review token
 * (`?token=`, or the cookie a tokened visit leaves behind); see
 * `directSignInAdmitted`.
 */
export const dynamic = 'force-dynamic';

const safeNext = (value: string | null): string =>
  value !== null && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const admission = directSignInAdmitted({
    hostname: request.nextUrl.hostname,
    token: request.nextUrl.searchParams.get('token'),
    cookieToken: request.cookies.get(REVIEW_TOKEN_COOKIE_NAME)?.value,
  });
  if (!admission.admitted) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Review mode is served over plain http on localhost, where a secure cookie
  // would be dropped by the browser and the redirect would loop; a hosted
  // review deployment is https, where the cookie should be secure. Follow the
  // request rather than fixing either.
  const secure = request.nextUrl.protocol === 'https:';

  const asked = request.nextUrl.searchParams.get('as');
  const next = safeNext(request.nextUrl.searchParams.get('next'));
  const accounts = await directSignInAccounts();

  const account =
    asked === null
      ? accounts[0]
      : accounts.find((row) => row.email.toLowerCase() === asked.toLowerCase());

  if (account === undefined) {
    // Either the database has no shop member, or the address is not one of them. Both
    // are answered on the chooser rather than by guessing.
    const chooser = NextResponse.redirect(new URL('/auth/sign-in?pick=1', request.url));
    if (admission.setCookie !== undefined) {
      chooser.cookies.set(REVIEW_TOKEN_COOKIE_NAME, admission.setCookie, {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
      });
    }
    return chooser;
  }

  const issued = await authServices().sessionService.issue({
    userId: account.userId,
    role: 'manufacturer',
  });

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(SESSION_COOKIE_NAME, issued.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    expires: issued.session.absoluteExpiresAt,
  });
  if (admission.setCookie !== undefined) {
    response.cookies.set(REVIEW_TOKEN_COOKIE_NAME, admission.setCookie, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
    });
  }
  return response;
};
