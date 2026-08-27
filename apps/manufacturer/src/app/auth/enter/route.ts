import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@ideeza/auth';
import { authServices } from '@/lib/auth.js';
import { directSignInAccounts, directSignInEnabled } from '@/lib/direct-sign-in.js';

/**
 * Review mode's way in: no form, no password, straight to the panel.
 *
 * `?as=<email>` names the member to enter as; without it the first seeded shop
 * owner is used. `?next=` is where to land, and only an in-app path is accepted
 * so this cannot be turned into an open redirect.
 *
 * When `REVIEW_DIRECT_SIGN_IN` is not set this route does not exist — it answers
 * 404 exactly as an unbuilt path would, rather than explaining itself.
 */
export const dynamic = 'force-dynamic';

const safeNext = (value: string | null): string =>
  value !== null && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  if (!directSignInEnabled()) {
    return new NextResponse('Not found', { status: 404 });
  }

  const asked = request.nextUrl.searchParams.get('as');
  const next = safeNext(request.nextUrl.searchParams.get('next'));
  const accounts = await directSignInAccounts();

  const account =
    asked === null
      ? accounts[0]
      : accounts.find((row) => row.email.toLowerCase() === asked.toLowerCase());

  if (account === undefined) {
    // Either the database has no shop members, or the address is not one of
    // them. Both are answered on the chooser rather than by guessing.
    return NextResponse.redirect(new URL('/auth/sign-in?pick=1', request.url));
  }

  const issued = await authServices().sessionService.issue({
    userId: account.userId,
    role: 'manufacturer',
  });

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(SESSION_COOKIE_NAME, issued.token, {
    httpOnly: true,
    sameSite: 'lax',
    // Review mode is served over plain http on localhost, so a secure cookie
    // would be dropped by the browser and the redirect would loop. The password
    // path keeps its production setting; this route only exists in review mode.
    secure: false,
    path: '/',
    expires: issued.session.absoluteExpiresAt,
  });
  return response;
};
