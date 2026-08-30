import { notFound } from 'next/navigation';
import { Card, CardHeader, EmptyState, Text } from '@ideeza/ui';
import { asId, type QuoteId } from '@ideeza/domain';
import { QuoteShell } from '@/components/quote/quote-shell.js';
import { getClientProfile } from '@/data/clients.js';
import { getQuote, listQuoteActivity } from '@/data/quotes.js';
import { getRoutedRequest } from '@/data/rfqs.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const ACTOR_LABEL: Readonly<Record<string, string>> = {
  manufacturer: 'You',
  buyer: 'The buyer',
  ops_admin: 'IDEEZA operations',
  system: 'The platform',
};

/** The same wording the buyer's activity screen uses for the same record. */
const EVENT_LABEL: Readonly<Record<string, string>> = {
  quote_submitted: 'sent this quote',
  quote_revised: 'revised this quote',
  quote_revision_requested: 'asked for a revision',
  quote_accepted: 'accepted this quote',
  quote_rejected: 'declined this quote',
  quote_expired: 'let this quote expire',
  quote_withdrawn: 'withdrew this quote',
  substitution_suggested: 'suggested a replacement part',
  substitution_approved: 'approved a replacement part',
  substitution_rejected: 'rejected a replacement part',
};

const when = (value: Date): string =>
  `${value.toISOString().slice(0, 10)} at ${value.toISOString().slice(11, 16)} UTC`;

/**
 * Quote Activity: the append-only log for this quote.
 *
 * Nothing is summarised away. It is the record a dispute would be decided on, and
 * the buyer reads the same rows on their side of it.
 */
const QuoteActivityPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly quoteId: string }>;
}) => {
  const { quoteId } = await params;
  const actor = await requireManufacturer(`/quotes/${quoteId}/activity`);
  const id = asId<QuoteId>(quoteId);

  const quote = await getQuote(actor.manufacturerId, id);
  if (quote === null) notFound();

  const [entries, request] = await Promise.all([
    listQuoteActivity(actor.manufacturerId, id),
    getRoutedRequest(actor.manufacturerId, quote.rfqId),
  ]);
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
        request === null ? '—' : `${request.shipTo.city}, ${request.shipTo.countryCode}`
      }
      activeTab="activity"
    >
      <Card padded={false}>
        <div className="px-4 py-4 md:px-6">
          <CardHeader
            title="What has happened to this quote"
            description="Read back from the platform's own event log, newest first."
          />
        </div>

        {entries.length === 0 ? (
          <div className="px-4 pb-6 md:px-6">
            <EmptyState
              title="Nothing recorded yet"
              description="Every action on this quote is written here as it happens."
            />
          </div>
        ) : (
          <ol aria-label="Quote activity" className="border-t border-border-subtle">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-subtle px-4 py-3 last:border-b-0 md:px-6"
              >
                <p className="text-sm text-text-secondary">
                  <span className="font-semibold text-text-primary">
                    {ACTOR_LABEL[entry.actorRole] ?? entry.actorRole}
                  </span>{' '}
                  {EVENT_LABEL[entry.kind] ?? entry.kind.replace(/_/g, ' ')}
                </p>
                <Text tone="muted" size="xs">
                  {when(entry.at)}
                </Text>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card>
        <CardHeader title="Why this is kept" />
        <Text size="sm" className="mt-2 block">
          The log is append-only: the database refuses updates to it. If what was
          quoted, revised or decided is ever in question, this is the answer — and it
          is the same log the buyer and IDEEZA operations read.
        </Text>
      </Card>
    </QuoteShell>
  );
};

export default QuoteActivityPage;
