import { database } from './db.js';

/**
 * Signing in without a password, for looking at the panel.
 *
 * A review session should not cost a copied password on every window, so the
 * review environment sets `REVIEW_DIRECT_SIGN_IN=1` and this panel then lets a
 * seeded shop member in on sight. Three things keep it from becoming a hole:
 *
 * - it is off unless that variable is exactly `1`, and nothing in the app, the
 *   build or the deployment sets it — only `tools/review-environment.mjs` does;
 * - it can only enter an account that already exists in the database with the
 *   manufacturer role and a shop membership. It creates nothing, grants nothing
 *   and cannot be pointed at an arbitrary address;
 * - the session it issues is an ordinary one, from the same service the password
 *   path uses, so every guard, capability and shop scoping still applies.
 *
 * If the variable is ever set on a real deployment, that deployment has handed
 * its panel away — which is why it is named for what it is and why the screen
 * says out loud that it is in review mode.
 */
export const directSignInEnabled = (): boolean =>
  process.env['REVIEW_DIRECT_SIGN_IN'] === '1';

export interface DirectSignInAccount {
  readonly userId: string;
  readonly email: string;
  readonly memberName: string;
  readonly shopName: string;
  readonly owner: boolean;
}

/**
 * The shop members this panel can be entered as, owners first so the default is
 * the account with the most to look at.
 */
export const directSignInAccounts = async (): Promise<readonly DirectSignInAccount[]> => {
  if (!directSignInEnabled()) return [];

  const members = await database().manufacturerMember.findMany({
    where: { user: { role: 'manufacturer', suspendedAt: null } },
    include: {
      user: { select: { id: true, email: true, displayName: true } },
      manufacturer: { select: { displayName: true } },
    },
    orderBy: [{ isOwner: 'desc' }, { createdAt: 'asc' }],
  });

  return members.map((member) => ({
    userId: member.user.id,
    email: member.user.email,
    memberName: member.user.displayName,
    shopName: member.manufacturer.displayName,
    owner: member.isOwner,
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
