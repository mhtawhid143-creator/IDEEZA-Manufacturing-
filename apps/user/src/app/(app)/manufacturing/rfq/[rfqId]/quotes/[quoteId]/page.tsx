import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Alert,
  Badge,
  Card,
  CardHeader,
  DataTable,
  DefinitionList,
  EmptyState,
  Heading,
  PageHeader,
  StatusChip,
  Tag,
  Text,
  buttonAppearance,
} from '@ideeza/ui';
import { Crumbs } from '@/components/crumbs.js';
import { QuoteCard } from '@/components/rfq/quote-card.js';
import { day, landedTotalMinor, major } from '@/components/rfq/quote-money.js';
import { getQuote } from '@/data/quotes.js';
import { getRequest } from '@/data/requests.js';
import { requireBuyer } from '@/lib/auth.js';
import { SERVICE_LIST } from '@/lib/rfq-copy.js';
import { asId, type QuoteId, type RfqId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

/**
 * One quote in full: every term the buyer is being asked to accept.
 *
 * The comparison shows the headline numbers; this is where the small print
 * lives, because accepting is what turns those terms into the order's
 * immutable record.
 */
const QuoteDetailPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly rfqId: string; readonly quoteId: string }>;
}) => {
  const { rfqId, quoteId } = await params;
  const actor = await requireBuyer(`/manufacturing/rfq/${rfqId}/quotes/${quoteId}`);
  const [request, quote] = await Promise.all([
    getRequest(actor.userId, asId<RfqId>(rfqId)),
    getQuote(actor.userId, asId<QuoteId>(quoteId)),
  ]);
  if (request === null || quote === null) notFound();

  const pending = quote.substitutions.filter(
    (substitution) => substitution.status === 'proposed',
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Quote from ${quote.manufacturerName}`}
        description={`${request.productName} · ${quote.quantity} units · version ${quote.version}`}
        breadcrumbs={
          <Crumbs
            items={[
              { label: 'Manufacturing', href: '/manufacturing' },
              { label: 'Quote Requests', href: '/manufacturing/rfq' },
              { label: 'Quotes', href: `/manufacturing/rfq/${rfqId}/quotes` },
              { label: quote.manufacturerName },
            ]}
          />
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={quote.expired && quote.status === 'submitted' ? 'expired' : quote.status} withDot />
            <Link
              href={`/manufacturing/rfq/${rfqId}/quotes`}
              className={buttonAppearance({ variant: 'secondary' })}
            >
              All quotes
            </Link>
          </div>
        }
      />

      {quote.expired && quote.status !== 'accepted' && (
        <Alert tone="warning" title="This quote has expired">
          The manufacturer set it to expire on {day(quote.expiresAt)}. Ask for a new
          one from the request, or accept another quote.
        </Alert>
      )}

      {pending.length > 0 && (
        <Alert tone="warning" title="Replacement parts still need your decision">
          This quote suggests {pending.length} replacement part
          {pending.length === 1 ? '' : 's'}. Decide each one before accepting, so the
          accepted terms name exactly which parts are used.{' '}
          <Link
            href={`/manufacturing/rfq/${rfqId}/substitutions`}
            className="font-semibold underline"
          >
            Decide now
          </Link>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              title="What this quote costs"
              description="Every figure the manufacturer put a price on."
            />
            <DefinitionList
              className="mt-4"
              columns={2}
              items={[
                {
                  label: 'Per unit',
                  value: `${quote.currency} ${major(quote.unitPriceMinor)}`,
                },
                {
                  label: `Units (${quote.quantity})`,
                  value: `${quote.currency} ${major(quote.totalPriceMinor)}`,
                },
                {
                  label: 'Shipping',
                  value:
                    quote.shippingEstimateMinor === null
                      ? 'Not quoted'
                      : `${quote.currency} ${major(quote.shippingEstimateMinor)}`,
                },
                {
                  label: 'Tooling / setup',
                  value:
                    quote.toolingSetupCostMinor === null
                      ? 'None'
                      : `${quote.currency} ${major(quote.toolingSetupCostMinor)}`,
                },
                {
                  label: 'Landed total',
                  value: `${quote.currency} ${major(landedTotalMinor(quote))}`,
                },
                { label: 'Lead time', value: `${quote.leadTimeDays} days` },
                { label: 'Valid until', value: day(quote.expiresAt) },
                { label: 'Answered', value: day(quote.submittedAt) },
              ]}
            />
          </Card>

          {quote.volumePrices.length > 0 && (
            <Card padded={false}>
              <div className="border-b border-line px-4 py-3 md:px-6">
                <Heading level={4}>Priced at other volumes</Heading>
                <Text tone="muted" size="xs" className="mt-0.5 block">
                  You asked for these volumes on the request, and this manufacturer
                  priced them.
                </Text>
              </div>
              <DataTable
                caption={`Prices at other volumes from ${quote.manufacturerName}`}
                rows={[...quote.volumePrices]}
                rowKey={(price) => String(price.quantity)}
                columns={[
                  {
                    id: 'volume',
                    header: 'Volume',
                    cell: (price) => `${price.quantity} units`,
                  },
                  {
                    id: 'unit',
                    header: 'Per unit',
                    align: 'right',
                    cell: (price) => `${quote.currency} ${major(price.unitPriceMinor)}`,
                  },
                  {
                    id: 'total',
                    header: 'Total',
                    align: 'right',
                    cell: (price) => `${quote.currency} ${major(price.totalPriceMinor)}`,
                  },
                  {
                    id: 'lead',
                    header: 'Lead time',
                    align: 'right',
                    cell: (price) =>
                      price.leadTimeDays === null
                        ? `${quote.leadTimeDays} days`
                        : `${price.leadTimeDays} days`,
                  },
                ]}
              />
            </Card>
          )}

          {quote.items.length > 0 && (
            <Card padded={false}>
              <div className="border-b border-line px-4 py-3 md:px-6">
                <Heading level={4}>Priced lines</Heading>
              </div>
              <DataTable
                caption={`Priced lines in ${quote.manufacturerName}'s quote`}
                rows={[...quote.items]}
                rowKey={(item) => item.id}
                columns={[
                  { id: 'what', header: 'Line', cell: (item) => item.description },
                  {
                    id: 'qty',
                    header: 'Qty',
                    align: 'right',
                    cell: (item) => String(item.quantity),
                  },
                  {
                    id: 'unit',
                    header: 'Unit',
                    align: 'right',
                    cell: (item) => `${quote.currency} ${major(item.unitPriceMinor)}`,
                  },
                  {
                    id: 'total',
                    header: 'Total',
                    align: 'right',
                    cell: (item) => `${quote.currency} ${major(item.lineTotalMinor)}`,
                  },
                ]}
              />
            </Card>
          )}

          <Card>
            <CardHeader title="Materials, process and terms" />
            <Text size="sm" className="mt-3 whitespace-pre-line">
              {quote.materialProcessNotes}
            </Text>
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Terms
              </p>
              <Text size="sm" className="mt-1 whitespace-pre-line">
                {quote.terms}
              </Text>
            </div>
            {quote.warrantyTerms !== null && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Warranty
                </p>
                <Text size="sm" className="mt-1 whitespace-pre-line">
                  {quote.warrantyTerms}
                </Text>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Replacement parts suggested"
              description="A manufacturer may suggest a different part; the buyer decides."
            />
            {quote.substitutions.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No replacements suggested"
                  description="This quote prices the bill of materials exactly as it was sent."
                />
              </div>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {quote.substitutions.map((substitution) => (
                  <li
                    key={substitution.id}
                    className="rounded-lg border border-line p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-heading">
                        {substitution.requestedPartReference} → {substitution.suggestedPartName}
                      </p>
                      <StatusChip status={substitution.status} />
                    </div>
                    <Text tone="muted" size="xs" className="mt-1">
                      {substitution.priceImpactMinor === 0n
                        ? 'No price impact'
                        : `${quote.currency} ${major(substitution.priceImpactMinor)} price impact`}
                      {substitution.leadTimeImpactDays === 0
                        ? ''
                        : ` · ${substitution.leadTimeImpactDays} days impact`}
                    </Text>
                    <Text size="sm" className="mt-2">
                      {substitution.technicalJustification}
                    </Text>
                  </li>
                ))}
              </ul>
            )}
            {pending.length > 0 && (
              <div className="mt-4">
                <Link
                  href={`/manufacturing/rfq/${rfqId}/substitutions`}
                  className={buttonAppearance({ variant: 'outline', size: 'sm' })}
                >
                  Decide {pending.length} part{pending.length === 1 ? '' : 's'}
                </Link>
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <QuoteCard
            quote={{
              id: quote.id,
              rfqId: quote.rfqId,
              manufacturerName: quote.manufacturerName,
              city: quote.city,
              countryCode: quote.countryCode,
              rating: quote.rating,
              status: quote.status,
              expired: quote.expired,
              currency: quote.currency,
              totalMajor: major(quote.totalPriceMinor),
              unitMajor: major(quote.unitPriceMinor),
              leadTimeDays: quote.leadTimeDays,
              expiresOn: day(quote.expiresAt),
              pendingSubstitutions: pending.length,
              orderId: quote.orderId,
            }}
          />

          <Card>
            <CardHeader title="Answering this request" />
            <DefinitionList
              className="mt-4"
              items={[
                { label: 'Quoting', value: SERVICE_LIST(request.requestedServices) },
                { label: 'Requested quantity', value: String(request.quantity) },
                { label: 'Lead time asked for', value: `${request.leadTimeDays} days` },
                { label: 'Material', value: request.material },
                { label: 'Tolerance', value: request.tolerance },
                { label: 'Quality check', value: request.qualityCheckRequirement },
              ]}
            />
            <Text tone="muted" size="xs" className="mt-3">
              These requirements were locked when the request was sent, so this quote
              and every other one answer the same question.
            </Text>
          </Card>

          {quote.attachmentNames.length > 0 && (
            <Card>
              <CardHeader title="Attached by the manufacturer" />
              <div className="mt-3 flex flex-wrap gap-2">
                {quote.attachmentNames.map((name) => (
                  <Tag key={name}>{name}</Tag>
                ))}
              </div>
            </Card>
          )}

          <Card tone="brand">
            <Heading level={4}>What happens if you accept</Heading>
            <ol className="mt-3 flex flex-col gap-2 text-sm text-body">
              {[
                'The request closes and every other quote on it loses.',
                'An order opens awaiting payment, with an immutable copy of these terms.',
                'The order is confirmed once the platform holds the funds; production may not start before that.',
              ].map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-weak text-[11px] font-semibold text-brand">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="mt-3">
              <Badge tone="warning">Accepting is not paying</Badge>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default QuoteDetailPage;
