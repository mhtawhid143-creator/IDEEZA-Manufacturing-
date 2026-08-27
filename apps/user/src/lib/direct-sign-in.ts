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
    take: 8,
  });

  return buyers
    .map((buyer) => ({
      userId: buyer.id,
      email: buyer.email,
      displayName: buyer.displayName,
      requestCount: buyer._count.rfqs,
      orderCount: buyer._count.ordersAsBuyer,
    }))
    .sort(
      (left, right) =>
        right.requestCount + right.orderCount - (left.requestCount + left.orderCount),
    );
};
