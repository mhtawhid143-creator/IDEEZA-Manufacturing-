import { asId, PACKAGE_KIND_LABEL, type ManufacturerId, type UserId } from '@ideeza/domain';
import { database } from '@/lib/db.js';

export interface ClientProfile {
  readonly userId: UserId;
  readonly displayName: string;
  readonly memberSince: Date;
  /** Requests this buyer has actually sent out, drafts excluded. */
  readonly requestsSent: number;
  readonly ordersCompleted: number;
  /** Orders this buyer has placed with the shop that is reading the screen. */
  readonly ordersWithThisShop: number;
  /** The kinds of work this buyer asks for, in the platform's words. */
  readonly worksOn: readonly string[];
  /**
   * Whether this buyer follows through, from what actually happened (UIUX-145).
   *
   * The ticket asks for a star rating. There is none to show: nobody rates a
   * buyer on this platform, and inventing a score out of these counts would be
   * a number with no meaning behind it. What a shop is really asking before it
   * spends an afternoon pricing is whether quoting this buyer leads anywhere,
   * and that is answerable from the record: how many of the requests they put
   * out to quote they went on to accept, and how many of those they paid for.
   *
   * `quoted` is the denominator rather than every request they ever sent,
   * because a request nobody quoted says nothing about the buyer.
   */
  readonly requestsQuoted: number;
  readonly requestsAccepted: number;
  /** Accepted quotes that reached a secured payment, so an order exists. */
  readonly acceptedAndPaid: number;
}

/**
 * Who the buyer is, from what the platform actually knows.
 *
 * The design's client panel carries a job title, a skill list and a project
 * count. A buyer account has none of those: there is no title field, and
 * "skills" belong to a shop, not to the person asking for work. What a shop
 * genuinely needs before pricing is whether this buyer follows through — so the
 * counts here are their record on the platform, and the "works on" list is the
 * kinds of work they have actually requested.
 */
export const getClientProfile = async (
  buyerId: UserId,
  manufacturerId: ManufacturerId,
): Promise<ClientProfile | null> => {
  const buyer = await database().user.findUnique({
    where: { id: buyerId },
    select: { id: true, displayName: true, createdAt: true },
  });
  if (buyer === null) return null;

  const [
    requestsSent,
    ordersCompleted,
    ordersWithThisShop,
    kinds,
    requestsQuoted,
    requestsAccepted,
    acceptedAndPaid,
  ] = await Promise.all([
    database().rfq.count({ where: { buyerId, status: { not: 'draft' } } }),
    database().manufacturingOrder.count({ where: { buyerId, status: 'completed' } }),
    database().manufacturingOrder.count({ where: { buyerId, manufacturerId } }),
    database().rfq.findMany({
      where: { buyerId, status: { not: 'draft' } },
      select: { package: { select: { kind: true } } },
      distinct: ['packageId'],
    }),
    // Requests that got at least one real quote — the only ones the buyer had
    // anything to decide about.
    database().rfq.count({
      where: {
        buyerId,
        status: { not: 'draft' },
        quotes: { some: { status: { not: 'draft' } } },
      },
    }),
    database().rfq.count({
      where: { buyerId, quotes: { some: { status: 'accepted' } } },
    }),
    // An order exists only against a secured payment in this domain, so its
    // existence is the payment having gone through.
    database().manufacturingOrder.count({ where: { buyerId } }),
  ]);

  const worksOn = [...new Set(kinds.map((row) => PACKAGE_KIND_LABEL[row.package.kind]))];

  return {
    userId: asId<UserId>(buyer.id),
    displayName: buyer.displayName,
    memberSince: buyer.createdAt,
    requestsSent,
    ordersCompleted,
    ordersWithThisShop,
    worksOn,
    requestsQuoted,
    requestsAccepted,
    acceptedAndPaid,
  };
};
