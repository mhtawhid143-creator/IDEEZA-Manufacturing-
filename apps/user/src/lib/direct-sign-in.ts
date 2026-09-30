import { database } from './db.js';

/**
 * Signing in without a password, for looking at the panel.
 *
 * The review environment sets `REVIEW_DIRECT_SIGN_IN=1` so both panels can be
 * opened side by side without copying a password into each window. Three things
 * keep it from becoming a hole:
 *
 * - it is off unless that variable is exactly `1`, and nothing in the app, the
 *   build or the deployment sets it — only `tools/review-environment.mjs` does;
 * - it can only enter a buyer account that already exists in the database. It
 *   creates nothing, grants nothing and cannot be pointed at an arbitrary
 *   address;
 * - the session it issues is an ordinary one, from the same service the password
 *   path uses, so every guard and capability still applies.
 */
export const directSignInEnabled = (): boolean =>
  process.env['REVIEW_DIRECT_SIGN_IN'] === '1';

export interface DirectSignInAccount {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly requestCount: number;
  readonly orderCount: number;
}

/**
 * The buyer accounts this panel can be entered as, the one with the most
 * requests first so the default account is the one with something to read.
 */
export const directSignInAccounts = async (): Promise<readonly DirectSignInAccount[]> => {
  if (!directSignInEnabled()) return [];

  const buyers = await database().user.findMany({
    where: { role: 'buyer', suspendedAt: null },
    select: {
      id: true,
      email: true,
      displayName: true,
      _count: { select: { rfqs: true, ordersAsBuyer: true } },
    },
    // Ranked in the database, so the eight taken are the eight busiest rather
    // than eight arbitrary rows sorted afterwards.
    orderBy: [{ rfqs: { _count: 'desc' } }, { ordersAsBuyer: { _count: 'desc' } }],
    take: 8,
  });

  return buyers.map((buyer) => ({
    userId: buyer.id,
    email: buyer.email,
    displayName: buyer.displayName,
    requestCount: buyer._count.rfqs,
    orderCount: buyer._count.ordersAsBuyer,
  }));
};

/**
 * Whether this request may use the password-less entry.
 *
 * On the machine running the review environment (`localhost`) the variable is
 * enough. Anywhere else — a hosted review deployment — the variable alone is
 * not: `REVIEW_DIRECT_SIGN_IN_TOKEN` must also be set, and the request must
 * carry it, either as `?token=` on the first visit or as the cookie that visit
 * sets. A hosted panel with the variable on and no token stays closed, so
 * turning review mode on can never by itself hand the panel to whoever finds
 * the address.
 */
export const REVIEW_TOKEN_COOKIE_NAME = 'ideeza_review';

/**
 * How long a reviewer stays admitted without the token in the address again.
 *
 * Thirty days, matching the session's own absolute window: shorter and a
 * reviewer coming back after a weekend is met by a bare 404 with nothing to
 * explain it, which is the one failure this entry has produced in practice.
 * The cookie carries the token, so it is exactly as strong as the link that
 * set it, and rotating the variable still kills both at once.
 */
export const REVIEW_TOKEN_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;


export const directSignInAdmitted = (request: {
  readonly hostname: string;
  readonly token: string | null;
  readonly cookieToken: string | undefined;
}): { readonly admitted: boolean; readonly setCookie: string | undefined } => {
  if (!directSignInEnabled()) return { admitted: false, setCookie: undefined };

  const local =
    request.hostname === 'localhost' ||
    request.hostname === '127.0.0.1' ||
    request.hostname === '::1' ||
    request.hostname === '[::1]';
  if (local) return { admitted: true, setCookie: undefined };

  // An open review, declared rather than defaulted into. A link that needs
  // nothing appended is the only kind a reviewer reliably keeps: the tokened
  // one is correct, and it is also the one that gets bookmarked without its
  // token and then reads as a dead panel. Setting this says the operator
  // accepts that anyone with the address is in.
  if (process.env['REVIEW_DIRECT_SIGN_IN_OPEN'] === '1') {
    return { admitted: true, setCookie: undefined };
  }

  // Without that, a missing or too-short token still refuses everything:
  // forgetting a variable must never be the thing that opens the door.
  const expected = process.env['REVIEW_DIRECT_SIGN_IN_TOKEN'];
  if (expected === undefined || expected.length < 16) {
    return { admitted: false, setCookie: undefined };
  }
  if (request.token !== null && request.token === expected) {
    return { admitted: true, setCookie: expected };
  }
  if (request.cookieToken === expected) return { admitted: true, setCookie: undefined };
  return { admitted: false, setCookie: undefined };
};
