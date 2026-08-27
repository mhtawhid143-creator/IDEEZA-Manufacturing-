import { Card, PageHeader, Text } from '@ideeza/ui';
import { RFQ_RECIPIENT_STATUSES, type PackageKind, type RfqRecipientStatus } from '@ideeza/domain';
import { InboxToolbar } from '@/components/request/inbox-toolbar.js';
import { RequestTable } from '@/components/request/request-table.js';
import { inboxCounters, listRoutedRequests } from '@/data/rfqs.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const day = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);

const KINDS: readonly PackageKind[] = ['pcb', 'module_3d', 'full_product'];

const statusFilter = (value: string | undefined): RfqRecipientStatus | 'all' =>
  value !== undefined && (RFQ_RECIPIENT_STATUSES as readonly string[]).includes(value)
    ? (value as RfqRecipientStatus)
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
    <p className="text-2xl font-bold text-heading">
      {String(value).padStart(2, '0')}
    </p>
    <Text size="sm" className="mt-0.5 block font-medium text-body">
      {label}
    </Text>
    <Text tone="muted" size="xs" className="mt-0.5 block">
      {note}
    </Text>
  </Card>
);

/**
 * Request Quote: the requests buyers have routed to this shop.
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
        title="Request Quotes"
        description="Requests buyers have sent to your shop. Answer them with a quote, or decline with a reason."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Counter
          value={counters.total}
          label="Requests received"
          note="Everything ever routed to your shop"
        />
        <Counter
          value={counters.awaiting}
          label="Waiting on you"
          note="Not answered yet"
        />
        <Counter
          value={counters.quoted}
          label="Quotes sent"
          note="Your answer is with the buyer"
        />
        <Counter
          value={counters.declined + counters.expired}
          label="Closed without a quote"
          note={`${counters.declined} declined · ${counters.expired} expired`}
        />
      </div>

      <Card padded={false}>
        <div className="flex flex-col gap-4 p-4 md:p-6">
          <InboxToolbar />
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
