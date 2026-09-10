import { Card, PageHeader, Text, majorAmount as major } from '@ideeza/ui';
import {
  counted,
  QUOTE_LIFECYCLE,
  QUOTE_LIFECYCLE_LABEL,
  type QuoteLifecycle,
} from '@ideeza/domain';
import { QuoteCards } from '@/components/quote/quote-cards.js';
import { QuoteList } from '@/components/quote/quote-list.js';
import { listQuotes, quoteCounters } from '@/data/quotes.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const day = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);


// The five the list is partitioned into, plus the alert card's own filter
// (UIUX-177, UIUX-180). The words come from the domain so this page and the
// request inbox cannot drift apart again.
const statusFilter = (value: string | undefined): QuoteLifecycle | 'all' | 'action' => {
  if (value === undefined) return 'all';
  if (value === 'action') return 'action';
  return (QUOTE_LIFECYCLE as readonly string[]).includes(value)
    ? (value as QuoteLifecycle)
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
        title="My Quotes"
        description="Everything you have answered, and what the buyer did with it."
      />

      {/*
        Four decisions rather than one card per status (UIUX-179), and pressing
        one is the filter (UIUX-180).
      */}
      <QuoteCards
        currency={counters.currency}
        openCount={counters.live}
        openValueMajor={major(counters.openValueMinor)}
        expiringSoon={counters.expiringSoon}
        requiringAction={counters.requiringAction}
        revisionRequested={counters.revisionRequested}
        acceptedCount={counters.accepted}
        wonValueMajor={major(counters.wonValueMinor)}
        winRate={counters.winRate}
        decided={counters.accepted + counters.rejected}
      />

      {/*
        Where the counts are measured, said once (UIUX-180). Leaving it
        unstated means a card and the table disagreeing cannot be told from a
        bug.
      */}
      <Text tone="muted" size="xs">
        The four counts above are everything your shop has ever sent. The dates
        below narrow the table only.
      </Text>

      <Card padded={false} data-tour="quote-list">
        <div className="flex flex-col gap-4 p-4 md:p-6">
          {/*
            The denominator, beside the thing it is a denominator for
            (UIUX-179). It was a card, which gave a quarter of the page's best
            space to a number with no period, no trend and nothing to press.
          */}
          <Text tone="muted" size="sm">
            Showing {quotes.rows.length} of {counted(counters.total, 'quote')} you have
            sent
            {status === 'all' ? '' : ` · ${quotes.total} match this filter`}
          </Text>
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
              kindLabel: row.kindLabel,
              buyerName: row.buyerName,
              quantity: row.quantity,
              leadTimeDays: row.leadTimeDays,
              unitPriceMajor: major(row.unitPriceMinor),
              landedTotalMajor: major(row.landedTotalMinor),
              currency: row.currency,
              status: row.status,
              lifecycle: row.lifecycle,
              statusLabel: QUOTE_LIFECYCLE_LABEL[row.lifecycle],
              reason: row.reason,
              expired: row.expired,
              sentOn: day(row.submittedAt),
              expiresOn: day(row.expiresAt),
              pendingSuggestions: row.pendingSuggestions,
              unfulfilledParts: row.unfulfilledParts,
            }))}
          />
        </div>
      </Card>
    </div>
  );
};

export default QuotesPage;
