import { Card, PageHeader, Text } from '@ideeza/ui';
import { QUOTE_STATUSES, type QuoteStatus } from '@ideeza/domain';
import { QuoteList } from '@/components/quote/quote-list.js';
import { listQuotes, quoteCounters } from '@/data/quotes.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const day = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);

const major = (minor: number): string => (minor / 100).toFixed(2);

/** The shop's own word for where its quote stands. */
const STATUS_LABEL: Readonly<Record<string, string>> = {
  draft: 'Draft',
  submitted: 'With the buyer',
  revision_requested: 'Revision asked for',
  revised: 'Revised',
  accepted: 'Accepted',
  rejected: 'Not chosen',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
};

const statusFilter = (value: string | undefined): QuoteStatus | 'all' | 'expired' => {
  if (value === undefined) return 'all';
  if (value === 'expired') return 'expired';
  return (QUOTE_STATUSES as readonly string[]).includes(value)
    ? (value as QuoteStatus)
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
}: {
  readonly value: number;
  readonly label: string;
  readonly note: string;
}) => (
  <Card>
    <p data-numeric className="text-3xl font-semibold tracking-[-0.02em] text-text-primary">
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
 * Quotes: what this shop has answered, and what became of it.
 *
 * Drafts are not here. A draft is where a shop prepares a price and its
 * substitute suggestions, and it has answered nobody yet — it belongs to the
 * request it was started from.
 */
const QuotesPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const actor = await requireManufacturer('/quotes');
  const query = await searchParams;
  const single = (key: string): string | undefined => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const status = statusFilter(single('status'));
  const search = single('q') ?? '';
  const from = dateOf(single('from'), false);
  const to = dateOf(single('to'), true);

  const [counters, quotes] = await Promise.all([
    quoteCounters(actor.manufacturerId),
    listQuotes(actor.manufacturerId, {
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
        title="Quotes"
        description="Everything you have answered, and what the buyer did with it."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Counter
          value={counters.total}
          label="Quotes sent"
          note="Every quote your shop has sent"
        />
        <Counter
          value={counters.live}
          label="With the buyer"
          note={
            counters.revisionRequested === 0
              ? 'Still open for a decision'
              : `${counters.revisionRequested} waiting on a revision from you`
          }
        />
        <Counter
          value={counters.accepted}
          label="Accepted"
          note="Turned into an order"
        />
        <Counter
          value={counters.rejected + counters.expired}
          label="Closed without an order"
          note={`${counters.rejected} not chosen · ${counters.expired} expired`}
        />
      </div>

      <Card padded={false}>
        <div className="flex flex-col gap-4 p-4 md:p-6">
          <QuoteList
            page={quotes.page}
            pageCount={quotes.pageCount}
            filtered={
              status !== 'all' ||
              search.trim() !== '' ||
              from !== undefined ||
              to !== undefined
            }
            rows={quotes.rows.map((row) => ({
              quoteId: row.quoteId,
              rfqId: row.rfqId,
              productName: row.productName,
              buyerName: row.buyerName,
              quantity: row.quantity,
              leadTimeDays: row.leadTimeDays,
              unitPriceMajor: major(row.unitPriceMinor),
              landedTotalMajor: major(row.landedTotalMinor),
              currency: row.currency,
              status: row.status,
              statusLabel:
                row.expired && row.status !== 'accepted'
                  ? 'Expired'
                  : (STATUS_LABEL[row.status] ?? row.status),
              expired: row.expired,
              sentOn: day(row.submittedAt),
              expiresOn: day(row.expiresAt),
              pendingSuggestions: row.pendingSuggestions,
            }))}
          />
        </div>
      </Card>
    </div>
  );
};

export default QuotesPage;
