import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardHeader, DefinitionList, Tag, Text, buttonAppearance } from '@ideeza/ui';
import { asId, briefRows, type QuoteId } from '@ideeza/domain';
import { QuoteShell } from '@/components/quote/quote-shell.js';
import { getClientProfile } from '@/data/clients.js';
import { getQuote } from '@/data/quotes.js';
import { getRoutedRequest } from '@/data/rfqs.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const day = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);

/**
 * RFQ overview: the request this quote answers, beside the quote.
 *
 * It is the same document the request screens show, read by the same domain
 * function — so a shop checking its quote against the ask cannot be shown a
 * different version of the ask.
 */
const QuoteRequestPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly quoteId: string }>;
}) => {
  const { quoteId } = await params;
  const actor = await requireManufacturer(`/quotes/${quoteId}/rfq`);
  const quote = await getQuote(actor.manufacturerId, asId<QuoteId>(quoteId));
  if (quote === null) notFound();

  const request = await getRoutedRequest(actor.manufacturerId, quote.rfqId);
  if (request === null) notFound();
  const client = await getClientProfile(request.buyerId, actor.manufacturerId);

  return (
    <QuoteShell
      quote={quote}
      client={client}
      creatorName={request.creatorName}
      shipsTo={`${request.shipTo.city}, ${request.shipTo.countryCode}`}
      activeTab="rfq"
    >
      <Card>
        <CardHeader
          title="Production requirement"
          description="Frozen when the request was sent, which is what your quote answers."
          actions={
            <div className="flex flex-wrap gap-2">
              {request.hasBoard && <Tag tone="brand">PCB</Tag>}
              {request.hasPrintedPart && <Tag tone="brand">3D</Tag>}
            </div>
          }
        />
        <DefinitionList
          className="mt-4"
          columns={2}
          items={briefRows(request.requirementRows)}
        />
        {request.notes !== null && request.notes !== '' && (
          <div className="mt-4 border-t border-line pt-4">
            <Text tone="muted" size="xs" className="block">
              From the buyer
            </Text>
            <Text size="sm" className="mt-1 block whitespace-pre-line">
              {request.notes}
            </Text>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="General information" />
        <DefinitionList
          className="mt-4"
          columns={2}
          items={[
            { label: 'RFQ ID', value: request.rfqId },
            { label: 'Product', value: request.productName },
            { label: 'Manufacturing type', value: request.kindLabel },
            {
              label: 'To be quoted',
              value:
                request.serviceLabels.length === 0
                  ? 'Not stated'
                  : request.serviceLabels.join(', '),
            },
            { label: 'Quantity', value: `${request.quantity} units` },
            {
              label: 'Also priced at',
              value:
                quote.volumePrices.length === 0
                  ? request.volumeTiers.length === 0
                    ? 'This volume only'
                    : `${request.volumeTiers.join(', ')} — you did not price these`
                  : quote.volumePrices
                      .map((price) => `${price.quantity} units`)
                      .join(', '),
            },
            { label: 'BOM lines', value: String(request.bomLines.length) },
            { label: 'Attached files', value: String(request.files.length) },
            { label: 'Received', value: day(request.receivedAt) },
            { label: 'Wanted by', value: day(request.neededBy) },
          ]}
        />
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <Link
            href={`/rfqs/${request.rfqId}/specification`}
            className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
          >
            Production specification
          </Link>
          <Link
            href={`/rfqs/${request.rfqId}/bom`}
            className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
          >
            BOM / parts
          </Link>
          <Link
            href={`/rfqs/${request.rfqId}/files`}
            className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
          >
            Production files
          </Link>
        </div>
      </Card>
    </QuoteShell>
  );
};

export default QuoteRequestPage;
