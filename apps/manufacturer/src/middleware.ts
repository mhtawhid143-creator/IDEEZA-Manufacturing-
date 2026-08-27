import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, resolveRouteRule } from '@ideeza/auth/edge';

/** Header the middleware uses to hand the resolved path to the server layout. */
export const PATH_HEADER = 'x-ideeza-path';

/**
 * A cheap first pass only.
 *
 * The middleware runs on the edge, where the database and node crypto are not
 * available, so it cannot make a permission decision. It does two things: send a
 * visitor with no session straight to sign-in instead of rendering a shell they
 * cannot use, and refuse a path that has no rule at all. The real authentication
 * and authorisation happen in the server layout through requireManufacturer.
 *
 * It lives in `src/` because that is where Next 15 looks when the application
 * has a `src` directory — at the repository root it is silently never bundled.
 */
export const middleware = (request: NextRequest): NextResponse => {
  const { pathname } = request.nextUrl;
  const rule = resolveRouteRule('manufacturer', pathname);

  if (rule === undefined) {
    return NextResponse.rewrite(new URL('/unavailable', request.url));
  }
  if (rule.anonymous === true) return NextResponse.next();

  const hasSession = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (hasSession === undefined || hasSession === '') {
    const target = new URL('/auth/sign-in', request.url);
    target.searchParams.set('next', pathname);
    return NextResponse.redirect(target);
  }

  const forwarded = new Headers(request.headers);
  forwarded.set(PATH_HEADER, pathname);
  return NextResponse.next({ request: { headers: forwarded } });
};

export const config = {
  // Static assets and the Next internals are not routed through the guard.
  matcher: ['/((?!_next/|favicon|robots|images/|fonts/).*)'],
};
