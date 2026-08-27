import { notFound } from 'next/navigation';
import { EmptyState, Text } from '@ideeza/ui';
import { RequestShell } from '@/components/rfq/request-shell.js';
import { listQuotes, listRequestActivity } from '@/data/quotes.js';
import { getRequest } from '@/data/requests.js';
import { requireBuyer } from '@/lib/auth.js';
import { asId, type RfqId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

const ACTOR_LABEL: Readonly<Record<string, string>> = {
  buyer: 'You',
  manufacturer: 'Manufacturer',
  ops_admin: 'IDEEZA operations',
};

const EVENT_LABEL: Readonly<Record<string, string>> = {
  rfq_submitted: 'sent the request',
  rfq_withdrawn: 'withdrew the request',
  rfq_recipient_viewed: 'opened the request',
  rfq_recipient_declined: 'declined to quote',
  rfq_recipient_expired: 'ran out of time to quote',
  rfq_clarification_requested: 'asked for a clarification',
  quote_submitted: 'sent a quote',
  quote_revised: 'revised its quote',
  quote_revision_requested: 'was asked to revise its quote',
  quote_accepted: 'accepted a quote',
  quote_rejected: 'declined a quote',
  quote_expired: 'let a quote expire',
  quote_withdrawn: 'withdrew its quote',
  substitution_suggested: 'suggested a replacement part',
  substitution_approved: 'approved a replacement part',
  substitution_rejected: 'rejected a replacement part',
  order_created: 'opened the order',
  order_confirmed: 'confirmed the order',
  payment_initiated: 'started the payment',
  payment_secured: 'secured the payment',
};

const when = (value: Date): string =>
  `${value.toISOString().slice(0, 10)} at ${value.toISOString().slice(11, 16)} UTC`;

/**
 * The activity of a request: the append-only event log, in order.
 *
 * Nothing is summarised away — this is the record a dispute would be decided
 * on, so the screen reads it back as it was written.
 */
const RequestActivityPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly rfqId: string }>;
}) => {
  const { rfqId } = await params;
  const actor = await requireBuyer(`/manufacturing/rfq/${rfqId}/activity`);
  const request = await getRequest(actor.userId, asId<RfqId>(rfqId));
  if (request === null) notFound();

  const [entries, quotes] = await Promise.all([
    listRequestActivity(actor.userId, asId<RfqId>(rfqId)),
    listQuotes(actor.userId, asId<RfqId>(rfqId)),
  ]);

  return (
    <RequestShell
      request={request}
      activeTab="activity"
      counts={{
        all: request.recipientCount,
        quotes: quotes.length,
        accepted: quotes.some((quote) => quote.status === 'accepted') ? 1 : 0,
        activity: entries.length,
      }}
    >
      {entries.length === 0 ? (
        <EmptyState
          title="Nothing has happened yet"
          description="Every action on this request is recorded here as it happens."
        />
      ) : (
        <ol aria-label="Request activity" className="flex flex-col">
          {entries.map((entry, index) => (
            <li key={entry.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden
                  className="mt-1 inline-flex h-4 w-4 shrink-0 rounded-full border-2 border-brand bg-surface"
                />
                {index < entries.length - 1 && (
                  <span aria-hidden className="w-px flex-1 bg-brand/40" />
                )}
              </div>
              <div className="min-w-0 pb-6">
                <Text tone="muted" size="xs">
                  {when(entry.at)}
                </Text>
                <p className="text-sm text-heading">
                  <span className="font-semibold">
                    {entry.manufacturerName ?? ACTOR_LABEL[entry.actorRole] ?? entry.actorRole}
                  </span>{' '}
                  {EVENT_LABEL[entry.kind] ?? entry.kind.replace(/_/g, ' ')}
                </p>
                <Text tone="muted" size="xs">
                  {entry.subjectKind} · {entry.subjectId}
                </Text>
              </div>
            </li>
          ))}
        </ol>
      )}
    </RequestShell>
  );
};

export default RequestActivityPage;
