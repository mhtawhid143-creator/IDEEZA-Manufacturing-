import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, EmptyState, PageHeader, Text, buttonAppearance } from '@ideeza/ui';
import { Crumbs } from '@/components/crumbs.js';
import { day, landedTotalMinor, major } from '@/components/rfq/quote-money.js';
import { listQuotes } from '@/data/quotes.js';
import { getRequest } from '@/data/requests.js';
import { requireBuyer } from '@/lib/auth.js';
import { asId, type RfqId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

/**
 * The quotes side by side.
 *
 * Every row is a term the manufacturer actually quoted, and the best value in a
 * row is marked so the comparison does the reading for the buyer.
 */
const CompareQuotesPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly rfqId: string }>;
}) => {
  const { rfqId } = await params;
  const actor = await requireBuyer(`/manufacturing/rfq/${rfqId}/compare`);
  const request = await getRequest(actor.userId, asId<RfqId>(rfqId));
  if (request === null) notFound();

  const quotes = (await listQuotes(actor.userId, asId<RfqId>(rfqId))).filter(
    (quote) => quote.status !== 'withdrawn',
  );

  const cheapest = quotes.reduce<bigint | null>(
    (best, quote) =>
      best === null || landedTotalMinor(quote) < best ? landedTotalMinor(quote) : best,
    null,
  );
  const fastest = quotes.reduce<number | null>(
    (best, quote) => (best === null || quote.leadTimeDays < best ? quote.leadTimeDays : best),
    null,
  );

  const rows: readonly {
    readonly label: string;
    readonly value: (quote: (typeof quotes)[number]) => string;
    readonly best?: (quote: (typeof quotes)[number]) => boolean;
  }[] = [
    {
      label: 'Landed total',
      value: (quote) => `${quote.currency} ${major(landedTotalMinor(quote))}`,
      best: (quote) => cheapest !== null && landedTotalMinor(quote) === cheapest,
    },
    { label: 'Per unit', value: (quote) => `${quote.currency} ${major(quote.unitPriceMinor)}` },
    {
      label: 'Units total',
      value: (quote) => `${quote.currency} ${major(quote.totalPriceMinor)}`,
    },
    {
      label: 'Shipping',
      value: (quote) =>
        quote.shippingEstimateMinor === null
          ? 'Not quoted'
          : `${quote.currency} ${major(quote.shippingEstimateMinor)}`,
    },
    {
      label: 'Tooling / setup',
      value: (quote) =>
        quote.toolingSetupCostMinor === null
          ? 'None'
          : `${quote.currency} ${major(quote.toolingSetupCostMinor)}`,
    },
    {
      label: 'Lead time',
      value: (quote) => `${quote.leadTimeDays} days`,
      best: (quote) => fastest !== null && quote.leadTimeDays === fastest,
    },
    { label: 'Valid until', value: (quote) => day(quote.expiresAt) },
    {
      label: 'Warranty',
      value: (quote) => quote.warrantyTerms ?? 'Not stated',
    },
    {
      label: 'Replacement parts',
      value: (quote) =>
        quote.substitutions.length === 0
          ? 'None suggested'
          : `${quote.substitutions.length} suggested (${quote.substitutions.filter((s) => s.status === 'proposed').length} undecided)`,
    },
    {
      label: 'Manufacturer rating',
      value: (quote) => (quote.rating === null ? '—' : `★ ${quote.rating.toFixed(1)}`),
    },
    {
      label: 'On-time delivery',
      value: (quote) =>
        quote.onTimeDeliveryRate === null
          ? '—'
          : `${Math.round(quote.onTimeDeliveryRate * 100)}%`,
    },
    { label: 'State', value: (quote) => (quote.expired ? 'Expired' : quote.status) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Compare quotes"
        description={`${request.productName} · ${request.quantity} units`}
        breadcrumbs={
          <Crumbs
            items={[
              { label: 'Manufacturing', href: '/manufacturing' },
              { label: 'Quote Requests', href: '/manufacturing/rfq' },
              { label: 'Quotes', href: `/manufacturing/rfq/${rfqId}/quotes` },
              { label: 'Compare' },
            ]}
          />
        }
        actions={
          <Link
            href={`/manufacturing/rfq/${rfqId}/quotes`}
            className={buttonAppearance({ variant: 'secondary' })}
          >
            Back to quotes
          </Link>
        }
      />

      {quotes.length === 0 ? (
        <EmptyState
          title="Nothing to compare yet"
          description="A comparison appears once at least one manufacturer has answered."
          action={
            <Link
              href={`/manufacturing/rfq/${rfqId}`}
              className={buttonAppearance({ variant: 'secondary' })}
            >
              See who was asked
            </Link>
          }
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="ids-sr-only">
                Quotes compared for {request.productName}
              </caption>
              <thead>
                <tr className="bg-canvas">
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-heading">
                    Term
                  </th>
                  {quotes.map((quote) => (
                    <th
                      key={quote.id}
                      scope="col"
                      className="px-4 py-3 text-left font-semibold text-heading"
                    >
                      <Link
                        href={`/manufacturing/rfq/${rfqId}/quotes/${quote.id}`}
                        className="flex items-center gap-2 hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                      >
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-weak text-xs font-semibold text-brand">
                          {quote.manufacturerName.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate">{quote.manufacturerName}</span>
                          <span className="block text-xs font-normal text-muted">
                            {quote.city}, {quote.countryCode}
                          </span>
                        </span>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-t border-line">
                    <th scope="row" className="px-4 py-3 text-left font-medium text-body">
                      {row.label}
                    </th>
                    {quotes.map((quote) => {
                      const best = row.best?.(quote) === true;
                      return (
                        <td
                          key={quote.id}
                          className={
                            best
                              ? 'px-4 py-3 font-semibold text-success'
                              : 'px-4 py-3 text-body'
                          }
                        >
                          {row.value(quote)}
                          {best && <span className="ml-1 text-xs">best</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Text tone="muted" size="xs">
        Accepting a quote closes the request and opens an order awaiting payment. Open a
        quote to read its full terms before deciding.
      </Text>
    </div>
  );
};

export default CompareQuotesPage;
