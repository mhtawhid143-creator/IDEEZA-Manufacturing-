import { Card, PageHeader, Text, majorAmount as major } from '@ideeza/ui';
import { ORDER_STATUSES, type OrderStatus } from '@ideeza/domain';
import { OrderList } from '@/components/order/order-list.js';
import { listOrders, orderCounters } from '@/data/orders.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const day = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);


const statusFilter = (
  value: string | undefined,
): OrderStatus | 'all' | 'in_flight' | 'late' => {
  if (value === undefined) return 'all';
  if (value === 'in_flight' || value === 'late') return value;
  return (ORDER_STATUSES as readonly string[]).includes(value)
    ? (value as OrderStatus)
    : 'all';
};

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
  tone = 'neutral',
}: {
  readonly value: number;
  readonly label: string;
  readonly note: string;
  readonly tone?: 'neutral' | 'danger';
}) => (
  <Card className={tone === 'danger' ? 'border-border-error' : undefined}>
    <p data-numeric className="text-3xl font-semibold tracking-near text-text-primary">
      {value}
    </p>
    <Text size="sm" className="mt-0.5 block font-medium text-text-secondary">
      {label}
    </Text>
    <Text
      tone={tone === 'danger' ? 'danger' : 'muted'}
      size="xs"
      className="mt-0.5 block"
    >
      {note}
    </Text>
  </Card>
);

/**
 * My Orders: everything this shop is building or has built.
 *
 * The states are the buyer's own — an order that is "awaiting payment" says so on
 * both panels — and what counts as late is the lead time this shop quoted.
 */
const OrdersPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const actor = await requireManufacturer('/orders');
  const query = await searchParams;
  const single = (key: string): string | undefined => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const status = statusFilter(single('status'));
  const search = single('q') ?? '';
  const from = dateOf(single('from'), false);
  const to = dateOf(single('to'), true);

  const [counters, orders] = await Promise.all([
    orderCounters(actor.manufacturerId),
    listOrders(actor.manufacturerId, {
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
        title="My orders"
        description="What you are building, where each one has got to, and what is waiting on somebody."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Counter
          value={counters.total}
          label="Orders"
          note={`${counters.completed} finished`}
        />
        <Counter
          value={counters.inFlight}
          label="In flight"
          note={
            counters.awaitingFunding === 0
              ? 'All funded'
              : `${counters.awaitingFunding} not funded yet`
          }
        />
        <Counter
          value={counters.late}
          label="Past the quoted date"
          note="Against the lead time you quoted"
          tone={counters.late === 0 ? 'neutral' : 'danger'}
        />
        <Counter
          value={counters.inTrouble}
          label="Needing attention"
          note="Cancellations, refunds and disputes"
          tone={counters.inTrouble === 0 ? 'neutral' : 'danger'}
        />
      </div>

      <Card padded={false} data-tour="order-list">
        <div className="flex flex-col gap-4 p-4 md:p-6">
          <OrderList
            page={orders.page}
            pageCount={orders.pageCount}
            filtered={
              status !== 'all' ||
              search.trim() !== '' ||
              from !== undefined ||
              to !== undefined
            }
            rows={orders.rows.map((row) => ({
              orderId: row.orderId,
              productName: row.productName,
              buyerName: row.buyerName,
              status: row.status,
              disputeId: row.disputeId,
              disputeStatus: row.disputeStatus,
              quantity: row.quantity,
              currency: row.currency,
              unitPriceMajor: major(row.unitPriceMinor),
              totalPriceMajor: major(row.totalPriceMinor),
              currentStageLabel: row.currentStageLabel,
              completedStages: row.completedStages,
              totalStages: row.totalStages,
              openAlerts: row.openAlerts,
              fundingSecured: row.fundingSecured,
              late: row.late,
              orderedOn: day(row.confirmedAt ?? row.createdAt),
            }))}
          />
        </div>
      </Card>
    </div>
  );
};

export default OrdersPage;
