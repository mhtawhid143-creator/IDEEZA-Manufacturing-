import { notFound } from 'next/navigation';
import { asId, type QuoteId } from '@ideeza/domain';
import { QuoteShell } from '@/components/quote/quote-shell.js';
import { RequestBrief } from '@/components/request/request-brief.js';
import { getClientProfile } from '@/data/clients.js';
import { getQuote } from '@/data/quotes.js';
import { getRoutedRequest } from '@/data/rfqs.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

/**
 * RFQ overview: the request this quote answers, beside the quote.
 *
 * Drawn by the same component the request's own Brief tab uses (UIUX-192).
 * There were two hand-written copies of this content and they had already
 * drifted — one carried the quotable reference and a link to the files, the
 * other printed bare counts — which is what two renderers of one thing does.
 *
 * What differs here is what should differ: the volumes shown are the ones this
 * shop actually priced, and the way onward to the production detail is offered,
 * because a shop reading its quote has no tab bar of the request's own.
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
      <RequestBrief
        request={request}
        heading="The buyer’s request"
        pricedVolumes={quote.volumePrices.map((price) => price.quantity)}
        withOnwardLinks
      />
    </QuoteShell>
  );
};

export default QuoteRequestPage;
