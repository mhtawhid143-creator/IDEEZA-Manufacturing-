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
