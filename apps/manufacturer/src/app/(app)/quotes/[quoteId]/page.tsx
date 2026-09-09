import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Card, CardHeader, DefinitionList, Text, majorAmount as major } from '@ideeza/ui';
import {
  asId,
  counted,
  QUOTE_COST_LABEL,
  quoteReference,
  requestReference,
  type QuoteId,
} from '@ideeza/domain';
import { QuoteShell } from '@/components/quote/quote-shell.js';
import { getClientProfile } from '@/data/clients.js';
import { getQuote } from '@/data/quotes.js';
import { getRoutedRequest } from '@/data/rfqs.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

/** The link treatment used for the two references out of this page. */
const linkStyle =
  'font-medium text-text-link underline decoration-border-strong underline-offset-2 hover:text-text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus';

/**
 * How this quote reads against the buyer's target (UIUX-189).
 *
 * A target is not a ceiling in this platform — nothing refuses a quote above
 * it, and a shop pricing honestly above a hopeful number is a normal and useful
 * answer — so this is informational and worded as such. Over is stated as
 * plainly as under; dressing it as a failure would push shops towards quoting a
 * price they cannot deliver at.
 */
const targetReading = (
  landedMinor: number,
  targetMinor: number,
  currency: string,
): string => {
  if (targetMinor <= 0) return 'No target to compare against.';
  const difference = landedMinor - targetMinor;
  if (difference === 0) return 'Your quote lands exactly on it.';
  const percent = Math.round((Math.abs(difference) / targetMinor) * 100);
  return difference < 0
    ? `Yours is ${currency} ${major(Math.abs(difference))} under it — ${percent}% below.`
    : `Yours is ${currency} ${major(difference)} over it — ${percent}% above. A target is what the buyer hoped for, not a limit.`;
};

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
        <CardHeader title="Your quote" />
        <DefinitionList
          className="mt-4"
          columns={2}
          items={[
            { label: 'Quote ID', value: quoteReference(quote.quoteId) },
            { label: 'Request', value: requestReference(quote.rfqId) },
            { label: 'Version', value: String(quote.version) },
            // What the work is, on the page that prices it (UIUX-184). It was
            // one tab away, which meant leaving the quote to remember what was
            // being quoted. A summary plus the way to the detail, not a second
            // copy of the request.
            ...(request === null
              ? []
              : [
                  { label: 'Manufacturing type', value: request.kindLabel },
                  {
                    label: 'Production files',
                    value:
                      request.files.length === 0 ? (
                        'None attached'
                      ) : (
                        <Link href={`/rfqs/${quote.rfqId}/files`} className={linkStyle}>
                          {counted(request.files.length, 'file')}
                        </Link>
                      ),
                  },
                  {
                    label: 'The specification you priced',
                    value: (
                      <Link
                        href={`/rfqs/${quote.rfqId}/specification`}
                        className={linkStyle}
                      >
                        Read it again
                      </Link>
                    ),
                  },
                ]),
            { label: 'Lead time', value: `${quote.leadTimeDays} days` },
            { label: 'Quantity', value: counted(quote.quantity, 'unit') },
            {
              label: 'Substitutes suggested',
              value:
                quote.suggestions.length === 0
                  ? 'None'
                  : `${quote.suggestions.length} · ${quote.pendingSuggestions} undecided`,
            },
            // Named on the quote itself, because a shop revising a quote needs
            // to know what it already told the buyer it could not supply.
            {
              label: 'Parts you cannot supply',
              value:
                quote.unfulfilledParts === 0
                  ? 'None'
                  : counted(quote.unfulfilledParts, 'part'),
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
        {/*
          Read against the buyer's own figure, with the difference worked out
          (UIUX-189). A shop coming back to its quote days later should not have
          to do the subtraction, or go to another page for the number to
          subtract from.
        */}
        {quote.requestTargetPriceMinor !== null && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle bg-bg-surface-raised px-3 py-2">
            <span className="text-sm text-text-secondary">
              The buyer&rsquo;s target was{' '}
              <span className="font-semibold text-text-primary" data-numeric>
                {quote.currency} {major(quote.requestTargetPriceMinor)}
              </span>
            </span>
            <Text tone="muted" size="xs">
              {targetReading(
                quote.landedTotalMinor,
                quote.requestTargetPriceMinor,
                quote.currency,
              )}
            </Text>
          </div>
        )}
        {/*
          What one unit's price is made of (UIUX-166). Absent when the shop did
          not itemise, and said to be absent rather than shown as zeros — an
          unexplained price is not the same as a price made of nothing.
        */}
        {quote.costLines.length === 0 ? (
          <Text tone="muted" size="xs" className="mt-3 block">
            You did not itemise this price. A breakdown is optional, and the buyer
            reads it beside the total when there is one.
          </Text>
        ) : (
          <dl className="mt-4 flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-surface-raised p-3">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-xs font-semibold uppercase tracking-caps text-text-tertiary">
                One unit is made of
              </dt>
              <dd className="text-xs text-text-tertiary">per unit</dd>
            </div>
            {quote.costKinds
              .map((kind) => ({
                kind,
                line: quote.costLines.find((candidate) => candidate.kind === kind),
              }))
              .filter((row) => row.line !== undefined)
              .map((row) => (
                <div key={row.kind} className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-text-tertiary">
                    {QUOTE_COST_LABEL[row.kind]}
                  </dt>
                  <dd className="text-sm font-medium text-text-primary">
                    {quote.currency} {major(row.line?.amountMinor ?? 0)}
                  </dd>
                </div>
              ))}
          </dl>
        )}

        <dl className="mt-4 flex flex-col gap-2">
          {[
            {
              label: 'Unit price',
              value: `${quote.currency} ${major(quote.unitPriceMinor)}`,
            },
            { label: 'Quantity', value: counted(quote.quantity, 'unit') },
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

      {/*
        What this quote was priced against, and where the shop said it cannot
        meet it (UIUX-171). Shown even when there are no deviations, because
        "we can meet the specification" is itself a statement the buyer relied
        on when awarding.
      */}
      <Card>
        <CardHeader
          title="The specification you quoted against"
          description={
            quote.quotedAgainstLockedAt === null
              ? 'The buyer had not frozen their requirements when this was priced.'
              : `Frozen on ${day(quote.quotedAgainstLockedAt)}.`
          }
        />
        {quote.quotedAgainstLockedAt !== null &&
          quote.specLockedAt !== null &&
          quote.specLockedAt.getTime() !== quote.quotedAgainstLockedAt.getTime() && (
            <Alert
              tone="warning"
              title="The buyer has frozen a different specification since"
              className="mt-3"
            >
              You priced the requirements frozen on {day(quote.quotedAgainstLockedAt)};
              the current ones were frozen on {day(quote.specLockedAt)}. Read them again
              before this is accepted, and revise the quote if the change affects your
              price.
            </Alert>
          )}
        {quote.deviations.length === 0 ? (
          <Text tone="muted" size="sm" className="mt-3 block">
            You quoted in full compliance with it. Nothing was declared as a
            departure.
          </Text>
        ) : (
          <ul aria-label="Declared deviations" className="mt-3 flex flex-col gap-3">
            {quote.deviations.map((entry) => (
              <li
                key={entry.requirement}
                className="rounded-lg border border-border-subtle bg-bg-surface-raised p-3"
              >
                <p className="text-sm font-semibold text-text-primary">
                  {entry.requirement}
                </p>
                <Text tone="muted" size="xs" className="mt-0.5 block">
                  What you can do: {entry.capability}
                </Text>
              </li>
            ))}
          </ul>
        )}
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
