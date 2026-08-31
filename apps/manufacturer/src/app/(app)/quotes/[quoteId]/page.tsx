import { notFound } from 'next/navigation';
import { Card, CardHeader, DefinitionList, Text, majorAmount as major } from '@ideeza/ui';
import { asId, type QuoteId } from '@ideeza/domain';
import { QuoteShell } from '@/components/quote/quote-shell.js';
import { getClientProfile } from '@/data/clients.js';
import { getQuote } from '@/data/quotes.js';
import { getRoutedRequest } from '@/data/rfqs.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const day = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);


/**
 * Quote Details: exactly what the buyer is reading.
 *
 * Every figure here is the stored quote, and the pricing breakdown is the same
 * arithmetic the buyer's screen does — the goods, then what the manufacturer adds
 * to them. Nothing is recalculated differently on the two sides.
 */
const QuoteDetailPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly quoteId: string }>;
}) => {
  const { quoteId } = await params;
  const actor = await requireManufacturer(`/quotes/${quoteId}`);
  const quote = await getQuote(actor.manufacturerId, asId<QuoteId>(quoteId));
  if (quote === null) notFound();

  const request = await getRoutedRequest(actor.manufacturerId, quote.rfqId);
  const client =
    request === null
      ? null
      : await getClientProfile(request.buyerId, actor.manufacturerId);

  return (
    <QuoteShell
      quote={quote}
      client={client}
      creatorName={request?.creatorName ?? quote.buyerName}
      shipsTo={
        request === null
          ? '—'
          : `${request.shipTo.city}, ${request.shipTo.countryCode}`
      }
      activeTab="quote"
    >
      <Card>
        <CardHeader title="General information" />
        <DefinitionList
          className="mt-4"
          columns={2}
          items={[
            { label: 'Quote ID', value: quote.quoteId },
            { label: 'Request', value: quote.rfqId },
            { label: 'Version', value: String(quote.version) },
            { label: 'Lead time', value: `${quote.leadTimeDays} days` },
            { label: 'Quantity', value: `${quote.quantity} units` },
            {
              label: 'Substitutes suggested',
              value:
                quote.suggestions.length === 0
                  ? 'None'
                  : `${quote.suggestions.length} · ${quote.pendingSuggestions} undecided`,
            },
            { label: 'Sent', value: day(quote.submittedAt) },
            { label: 'Valid until', value: day(quote.expiresAt) },
            {
              label: 'Buyer needs it by',
              value: day(quote.requestNeededBy),
            },
            {
              label: 'Accepted',
              value: quote.acceptedAt === null ? 'Not accepted' : day(quote.acceptedAt),
            },
          ]}
        />
      </Card>

      <Card>
        <CardHeader
          title="Pricing breakdown"
          description="What the buyer pays you if they accept as quoted."
        />
        <dl className="mt-4 flex flex-col gap-2">
          {[
            {
              label: 'Unit price',
              value: `${quote.currency} ${major(quote.unitPriceMinor)}`,
            },
            { label: 'Quantity', value: `${quote.quantity} units` },
            {
              label: 'Subtotal',
              value: `${quote.currency} ${major(quote.totalPriceMinor)}`,
            },
            {
              label: 'Shipping estimate',
              value:
                quote.shippingEstimateMinor === null
                  ? 'Not quoted'
                  : `${quote.currency} ${major(quote.shippingEstimateMinor)}`,
            },
            {
              label: 'Tooling and setup',
              value:
                quote.toolingSetupCostMinor === null
                  ? 'None'
                  : `${quote.currency} ${major(quote.toolingSetupCostMinor)}`,
            },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4">
              <dt className="text-sm text-text-tertiary">{row.label}</dt>
              <dd className="text-sm font-medium text-text-primary">{row.value}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 border-t border-border-subtle pt-2">
            <dt className="text-sm font-semibold text-text-primary">Grand total</dt>
            <dd className="text-base font-bold text-text-primary">
              {quote.currency} {major(quote.landedTotalMinor)}
            </dd>
          </div>
        </dl>
        <Text tone="muted" size="xs" className="mt-3 block">
          The platform fee and the buyer&rsquo;s shipping choice are added at checkout
          and are not yours to quote.
        </Text>
      </Card>

      {quote.volumePrices.length > 0 && (
        <Card padded={false}>
          <div className="px-4 py-4 md:px-6">
            <CardHeader
              title="The other volumes you priced"
              description="The buyer asked for these, and reads them beside your main price."
            />
          </div>
          <div className="w-full overflow-x-auto border-t border-border-subtle">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Prices at other volumes</caption>
              <thead>
                <tr className="border-b border-border-subtle bg-bg-surface-raised">
                  {['Volume', 'Unit price', 'Total', 'Lead time'].map((header) => (
                    <th
                      key={header}
                      scope="col"
                      className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-caps text-text-tertiary"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quote.volumePrices.map((price) => (
                  <tr key={price.quantity} className="border-b border-border-subtle last:border-0">
                    <td className="px-3 py-3 font-medium text-text-primary">
                      {price.quantity} units
                    </td>
                    <td className="px-3 py-3 text-text-secondary">
                      {quote.currency} {major(price.unitPriceMinor)}
                    </td>
                    <td className="px-3 py-3 text-text-secondary">
                      {quote.currency} {major(price.totalPriceMinor)}
                    </td>
                    <td className="px-3 py-3 text-text-secondary">
                      {price.leadTimeDays === null
                        ? 'As quoted'
                        : `${price.leadTimeDays} days`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Materials, process and terms" />
        <Text size="sm" className="mt-3 block whitespace-pre-line">
          {quote.materialProcessNotes}
        </Text>
        <div className="mt-4 border-t border-border-subtle pt-4">
          <p className="text-xs font-semibold uppercase tracking-caps text-text-tertiary">
            Terms
          </p>
          <Text size="sm" className="mt-1 block whitespace-pre-line">
            {quote.terms}
          </Text>
        </div>
        {quote.warrantyTerms !== null && (
          <div className="mt-4 border-t border-border-subtle pt-4">
            <p className="text-xs font-semibold uppercase tracking-caps text-text-tertiary">
              Warranty
            </p>
            <Text size="sm" className="mt-1 block whitespace-pre-line">
              {quote.warrantyTerms}
            </Text>
          </div>
        )}
      </Card>

      {quote.revisions.length > 0 && (
        <Card>
          <CardHeader
            title="What this quote said before"
            description="Kept because the buyer may have been comparing against it."
          />
          <ul aria-label="Previous terms" className="mt-3 flex flex-col gap-3">
            {[...quote.revisions].reverse().map((revision) => (
              <li
                key={revision.version}
                className="rounded-lg border border-border-subtle p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text-primary">
                    Version {revision.version}
                  </p>
                  <Text tone="muted" size="xs">
                    replaced {day(revision.at)}
                  </Text>
                </div>
                {revision.previous !== null && (
                  <Text tone="muted" size="xs" className="mt-1 block">
                    {quote.currency} {major(revision.previous.unitPriceMinor)} per unit ·{' '}
                    {quote.currency} {major(revision.previous.totalPriceMinor)} total ·{' '}
                    {revision.previous.leadTimeDays} days · was valid until{' '}
                    {revision.previous.expiresAt.slice(0, 10)}
                  </Text>
                )}
                {revision.buyerNote !== null && (
                  <Text size="sm" className="mt-2 block">
                    The buyer asked: {revision.buyerNote}
                  </Text>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </QuoteShell>
  );
};

export default QuoteDetailPage;
