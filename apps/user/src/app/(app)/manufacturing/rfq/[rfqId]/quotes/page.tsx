import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, EmptyState, Text, buttonAppearance } from '@ideeza/ui';
import { QuoteCard } from '@/components/rfq/quote-card.js';
import { RequestShell } from '@/components/rfq/request-shell.js';
import { day, major } from '@/components/rfq/quote-money.js';
import { listQuotes } from '@/data/quotes.js';
import { getRequest } from '@/data/requests.js';
import { requireBuyer } from '@/lib/auth.js';
import { asId, type RfqId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

/**
 * The quotes that came back.
 *
 * One card per answer, cheapest first, each carrying the decision the buyer can
 * take on it. Nothing is accepted here without a confirmation that says what
 * accepting really does.
 */
const QuotesPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly rfqId: string }>;
}) => {
  const { rfqId } = await params;
  const actor = await requireBuyer(`/manufacturing/rfq/${rfqId}/quotes`);
  const request = await getRequest(actor.userId, asId<RfqId>(rfqId));
  if (request === null) notFound();

  const quotes = await listQuotes(actor.userId, asId<RfqId>(rfqId));
  const live = quotes.filter(
    (quote) => quote.status === 'submitted' || quote.status === 'revised',
  );
  const accepted = quotes.find((quote) => quote.status === 'accepted');
  const pendingSubstitutions = quotes.reduce(
    (total, quote) =>
      total + quote.substitutions.filter((substitution) => substitution.status === 'proposed').length,
    0,
  );

  return (
    <RequestShell
      request={request}
      activeTab="quotes"
      counts={{
        quotes: quotes.length,
        accepted: accepted === undefined ? 0 : 1,
        all: request.recipientCount,
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-heading">Quotes received</h2>
            <Text tone="muted" size="xs">
              {quotes.length} of {request.recipientCount}{' '}
              {request.recipientCount === 1 ? 'manufacturer' : 'manufacturers'} answered
            </Text>
          </div>
          {live.length >= 2 && (
            <Link
              href={`/manufacturing/rfq/${rfqId}/compare`}
              className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
            >
              Compare {live.length} quotes
            </Link>
          )}
        </div>

        {pendingSubstitutions > 0 && (
          <Alert tone="warning" title="Replacement parts need your decision">
            A quote cannot be accepted while a suggested replacement part is still
            undecided: the accepted terms have to say exactly which parts are used.{' '}
            <Link
              href={`/manufacturing/rfq/${rfqId}/substitutions`}
              className="font-semibold underline"
            >
              Decide {pendingSubstitutions} part{pendingSubstitutions === 1 ? '' : 's'}
            </Link>
          </Alert>
        )}

        {accepted !== undefined && (
          <Alert tone="success" title={`${accepted.manufacturerName}'s quote is accepted`}>
            The request is closed. The order opened awaiting payment.{' '}
            {accepted.orderId !== null && (
              <Link href={`/manufacturing/orders/${accepted.orderId}`} className="font-semibold underline">
                Go to the order
              </Link>
            )}
          </Alert>
        )}

        {quotes.length === 0 ? (
          <EmptyState
            title="No quotes yet"
            description={
              request.status === 'submitted'
                ? 'The manufacturers you chose have the request. A quote appears here as soon as one answers.'
                : 'This request is closed, and no quote was recorded against it.'
            }
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
          <ul aria-label="Quotes" className="flex flex-col gap-3">
            {quotes.map((quote) => (
              <li key={quote.id}>
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
                    pendingSubstitutions: quote.substitutions.filter(
                      (substitution) => substitution.status === 'proposed',
                    ).length,
                    orderId: quote.orderId,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </RequestShell>
  );
};

export default QuotesPage;
