import { Card, PageHeader, Text } from '@ideeza/ui';
import { PayoutList } from '@/components/payout/payout-list.js';
import { earningsSummary, listPayouts } from '@/data/payouts.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const day = (value: Date): string => value.toISOString().slice(0, 10);
const major = (minor: number): string => (minor / 100).toFixed(2);

const dateOf = (value: string | undefined, endOfDay: boolean): Date | undefined => {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const pageNumber = (value: string | undefined): number => {
  const parsed = Number(value ?? '1');
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
};

const Counter = ({
  value,
  label,
  note,
}: {
  readonly value: string;
  readonly label: string;
  readonly note: string;
}) => (
  <Card>
    <p className="text-2xl font-bold text-heading">{value}</p>
    <Text size="sm" className="mt-0.5 block font-medium text-body">
      {label}
    </Text>
    <Text tone="muted" size="xs" className="mt-0.5 block">
      {note}
    </Text>
  </Card>
);

/**
 * Payouts and earnings: what the platform owes this shop, and why.
 *
 * The figure that matters is not a balance somebody typed but the sum of payouts
 * released against documented events. What is held is held for a reason, and the
 * screen names it.
 */
const PayoutsPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const actor = await requireManufacturer('/payouts');
  const query = await searchParams;
  const single = (key: string): string | undefined => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const status = single('status') ?? 'all';
  const search = single('q') ?? '';
  const from = dateOf(single('from'), false);
  const to = dateOf(single('to'), true);

  const [summary, payouts] = await Promise.all([
    earningsSummary(actor.manufacturerId),
    listPayouts(actor.manufacturerId, {
      status,
      search,
      ...(from === undefined ? {} : { from }),
      ...(to === undefined ? {} : { to }),
      page: pageNumber(single('page')),
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payouts & earnings"
        description="What is held, what has been released, and the event that released it."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Counter
          value={`${summary.currency} ${major(summary.pendingReleaseMinor)}`}
          label="Pending release"
          note="Held by IDEEZA against live orders"
        />
        <Counter
          value={`${summary.currency} ${major(summary.releasedMinor)}`}
          label="Released"
          note={`${summary.currency} ${major(summary.platformFeesMinor)} platform fees across all orders`}
        />
        <Counter
          value={`${summary.currency} ${major(summary.refundedMinor + summary.disputedMinor)}`}
          label="Refunded or disputed"
          note={`${summary.currency} ${major(summary.disputedMinor)} in open cases`}
        />
      </div>

      <Card padded={false}>
        <div className="flex flex-col gap-4 p-4 md:p-6">
          <PayoutList
            currency={summary.currency}
            availableMajor={major(summary.availableMinor)}
            page={payouts.page}
            pageCount={payouts.pageCount}
            filtered={
              status !== 'all' ||
              search.trim() !== '' ||
              from !== undefined ||
              to !== undefined
            }
            rows={payouts.rows.map((row) => ({
              id: row.id,
              orderId: row.orderId,
              productName: row.productName,
              buyerName: row.buyerName,
              status: row.status,
              currency: row.currency,
              orderAmountMajor: major(row.orderAmountMinor),
              platformFeeMajor: major(row.platformFeeMinor),
              netAmountMajor: major(row.netAmountMinor),
              dateOn: day(row.releasedAt ?? row.createdAt),
              releaseTrigger: row.releaseTriggerKind,
            }))}
          />
        </div>
      </Card>

      <Card tone="brand">
        <p className="text-sm font-semibold text-heading">
          Why a payout is held, and what lets it go
        </p>
        <Text size="sm" className="mt-2 block">
          IDEEZA takes the buyer&rsquo;s money before production starts and holds it. It
          is released against a documented event and nothing else: the buyer confirming
          delivery, the review window closing without a claim, or a case being resolved.
          That is what makes it safe for you to start building, and it is why no screen
          — including this one — offers to release it early.
        </Text>
      </Card>
    </div>
  );
};

export default PayoutsPage;
