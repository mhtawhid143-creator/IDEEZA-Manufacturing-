import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, EmptyState, Text, buttonAppearance } from '@ideeza/ui';
import { QuoteCard } from '@/components/rfq/quote-card.js';
import { RequestShell } from '@/components/rfq/request-shell.js';
import { day, landedTotalMinor, major } from '@/components/rfq/quote-money.js';
import { listQuotes } from '@/data/quotes.js';
import { getRequest } from '@/data/requests.js';
import { requireBuyer } from '@/lib/auth.js';
import { asId, type RfqId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

/** The quote that won, and the order it opened. */
const AcceptedQuotePage = async ({
  params,
}: {
  readonly params: Promise<{ readonly rfqId: string }>;
}) => {
  const { rfqId } = await params;
  const actor = await requireBuyer(`/manufacturing/rfq/${rfqId}/accepted`);
  const request = await getRequest(actor.userId, asId<RfqId>(rfqId));
  if (request === null) notFound();

  const quotes = await listQuotes(actor.userId, asId<RfqId>(rfqId));
  const accepted = quotes.find((quote) => quote.status === 'accepted');

  return (
    <RequestShell
      request={request}
      activeTab="accepted"
      counts={{
        all: request.recipientCount,
        quotes: quotes.length,
        accepted: accepted === undefined ? 0 : 1,
      }}
    >
      {accepted === undefined ? (
        <EmptyState
          title="No quote accepted yet"
          description="Accept one quote to open an order. Only one quote on a request can ever be accepted."
          action={
            <Link
              href={`/manufacturing/rfq/${rfqId}/quotes`}
              className={buttonAppearance({ variant: 'secondary' })}
            >
              See the quotes
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <QuoteCard
            quote={{
              id: accepted.id,
              rfqId: accepted.rfqId,
              manufacturerName: accepted.manufacturerName,
              city: accepted.city,
              countryCode: accepted.countryCode,
              rating: accepted.rating,
              status: accepted.status,
              expired: false,
              currency: accepted.currency,
              totalMajor: major(accepted.totalPriceMinor),
              unitMajor: major(accepted.unitPriceMinor),
              leadTimeDays: accepted.leadTimeDays,
              expiresOn: day(accepted.expiresAt),
              pendingSubstitutions: 0,
              orderId: accepted.orderId,
            }}
          />
          <Card tone="brand" className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-heading">
              Accepted on {day(accepted.acceptedAt)} for {accepted.currency}{' '}
              {major(landedTotalMinor(accepted))} landed
            </p>
            <Text size="sm">
              The order opened awaiting payment. It is confirmed — and production may
              start — once the platform holds the funds.
            </Text>
            {accepted.orderId !== null && (
              <Link
                href={`/manufacturing/orders/${accepted.orderId}`}
                className={buttonAppearance({ className: 'self-start' })}
              >
                Go to order
              </Link>
            )}
          </Card>
        </div>
      )}
    </RequestShell>
  );
};

export default AcceptedQuotePage;
