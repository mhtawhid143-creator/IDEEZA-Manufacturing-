import { Card, PageHeader, Text } from '@ideeza/ui';
import {
  REQUEST_LIFECYCLE,
  type PackageKind,
  type RequestLifecycle,
} from '@ideeza/domain';
import { InboxToolbar } from '@/components/request/inbox-toolbar.js';
import { RequestTable } from '@/components/request/request-table.js';
import { inboxCounters, listRoutedRequests } from '@/data/rfqs.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const day = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);

const KINDS: readonly PackageKind[] = ['pcb', 'module_3d', 'full_product'];

// The filter is over the six the inbox is partitioned into (UIUX-127), not the
// routing row's own five — those two sets are not the same question.
const statusFilter = (value: string | undefined): RequestLifecycle | 'all' =>
  value !== undefined && (REQUEST_LIFECYCLE as readonly string[]).includes(value)
    ? (value as RequestLifecycle)
    : 'all';

const kindFilter = (value: string | undefined): PackageKind | 'all' =>
  value !== undefined && (KINDS as readonly string[]).includes(value)
    ? (value as PackageKind)
    : 'all';

const pageNumber = (value: string | undefined): number => {
  const parsed = Number(value ?? '1');
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
};

interface CounterProps {
  readonly value: number;
  readonly label: string;
  readonly note: string;
}

const Counter = ({ value, label, note }: CounterProps) => (
  <Card>
    <p className="text-2xl font-bold text-text-primary">
      {value}
    </p>
    <Text size="sm" className="mt-0.5 block font-medium text-text-secondary">
      {label}
    </Text>
    <Text tone="muted" size="xs" className="mt-0.5 block">
      {note}
    </Text>
  </Card>
);

/**
 * RFQs: the requests buyers have routed to this shop.
 *
 * Every row is this shop's own routing record. A request sent to five shops is
 * five rows in five inboxes, and nothing here can read another shop's row or
 * another shop's price — which is what makes the buyer's comparison fair.
 */
const RequestsPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const actor = await requireManufacturer('/rfqs');
  const query = await searchParams;
  const single = (key: string): string | undefined => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const status = statusFilter(single('status'));
  const kind = kindFilter(single('kind'));
  const search = single('q') ?? '';

  const [counters, inbox] = await Promise.all([
    inboxCounters(actor.manufacturerId),
    listRoutedRequests(actor.manufacturerId, {
      status,
      kind,
      search,
      page: pageNumber(single('page')),
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="RFQs"
        description="Requests buyers have sent to your shop. Answer them with a quote, or decline with a reason."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Counter
          value={counters.total}
          label="Requests received"
          note="Everything ever routed to your shop"
        />
        {/*
          UIUX-125: a count of what is waiting cannot say whether any of it is
          late, and that is the half a shop has to act on first.
        */}
        <Counter
          value={counters.awaiting}
          label="Waiting on you"
          note={
            counters.overdue === 0
              ? 'None past its reply-by date'
              : `${counters.overdue} past the buyer’s reply-by date`
          }
        />
        {/* UIUX-124: named as the status a row carries, not a second word for it. */}
        <Counter
          value={counters.quoted}
          label="Quote sent"
          note={
            counters.accepted === 0
              ? 'Your answer is with the buyer'
              : `${counters.accepted} of your quotes was accepted`
          }
        />
        {/*
          The four tiles are groupings of the six statuses, and the note names
          which ones (UIUX-127): new + quoted + accepted + declined + expired +
          withdrawn is the whole of what was received, and nothing falls outside
          it. A withdrawn request is counted here because it closed without this
          shop being able to quote it, which is the same outcome for the shop.
        */}
        <Counter
          value={counters.declined + counters.expired + counters.withdrawn}
          label="Closed without a quote"
          note={`${counters.declined} declined · ${counters.expired} expired${
            counters.withdrawn === 0
              ? ''
              : ` · ${counters.withdrawn} withdrawn by the buyer`
          }`}
        />
      </div>

      <Card padded={false} data-tour="rfq-list">
        <div className="flex flex-col gap-4 p-4 md:p-6">
          <InboxToolbar counts={counters.byLifecycle} />
          <RequestTable
            page={inbox.page}
            pageCount={inbox.pageCount}
            filtered={status !== 'all' || kind !== 'all' || search.trim() !== ''}
            rows={inbox.rows.map((row) => ({
              rfqId: row.rfqId,
              productName: row.productName,
              description: row.description,
              kindLabel: row.kindLabel,
              quantity: row.quantity,
              status: row.status,
              lifecycle: row.lifecycle,
              openedOn: row.openedAt === null ? null : day(row.openedAt),
              receivedOn: day(row.receivedAt),
              respondBy: row.respondBy === null ? null : day(row.respondBy),
              buyerName: row.buyerName,
              fileCount: row.fileCount,
              bomLineCount: row.bomLineCount,
            }))}
          />
        </div>
      </Card>
    </div>
  );
};

export default RequestsPage;
