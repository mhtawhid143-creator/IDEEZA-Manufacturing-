/**
 * Prints the accounts a review environment can be entered as, as JSON.
 *
 * It runs as its own short-lived process on purpose: the review environment
 * itself must not hold a Prisma client open for hours, because the engine binary
 * it loads cannot then be replaced by `prisma generate` on Windows.
 *
 *   DATABASE_URL=… node --import tsx tools/review-accounts.ts
 */
import { createDatabaseClient } from '@ideeza/db';

const main = async (): Promise<void> => {
  const database = createDatabaseClient();

  try {
    const [buyers, members] = await Promise.all([
      database.user.findMany({
        where: { role: 'buyer', suspendedAt: null },
        select: {
          email: true,
          displayName: true,
          _count: { select: { rfqs: true, ordersAsBuyer: true } },
        },
        take: 8,
      }),
      database.manufacturerMember.findMany({
        where: { user: { role: 'manufacturer', suspendedAt: null } },
        include: {
          user: { select: { email: true, displayName: true } },
          manufacturer: { select: { displayName: true } },
        },
        orderBy: [{ isOwner: 'desc' }, { createdAt: 'asc' }],
        take: 8,
      }),
    ]);

    process.stdout.write(
      `${JSON.stringify({
        buyers: buyers
          .map((buyer) => ({
            email: buyer.email,
            who: `${buyer.displayName} — ${buyer._count.rfqs} requests, ${buyer._count.ordersAsBuyer} orders`,
            weight: buyer._count.rfqs + buyer._count.ordersAsBuyer,
          }))
          .sort((left, right) => right.weight - left.weight)
          .map(({ email, who }) => ({ email, who })),
        shops: members.map((member) => ({
          email: member.user.email,
          who: `${member.manufacturer.displayName}${member.isOwner ? ' (owner)' : ''} — ${member.user.displayName}`,
        })),
      })}\n`,
    );
  } finally {
    await database.$disconnect();
  }
};

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}
`);
  process.exit(1);
});
