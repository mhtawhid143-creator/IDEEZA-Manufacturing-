import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, EmptyState, PageHeader, Text, buttonAppearance } from '@ideeza/ui';
import { Crumbs } from '@/components/crumbs.js';
import { SubstitutionDecisions } from '@/components/rfq/substitution-decisions.js';
import { day, major } from '@/components/rfq/quote-money.js';
import { listQuotes } from '@/data/quotes.js';
import { getRequest } from '@/data/requests.js';
import { requireBuyer } from '@/lib/auth.js';
import { asId, type RfqId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

const POLICY_COPY: Readonly<Record<string, string>> = {
  not_allowed: 'Your requirements said no substitutions, so every suggestion needs an explicit decision.',
  with_approval: 'Your requirements said substitutions are allowed with your approval.',
  manufacturer_discretion:
    "Your requirements left substitutions to the manufacturer's discretion; these are recorded for your decision anyway.",
};

/**
 * Every replacement part suggested against this request.
 *
 * A quote cannot be accepted while one is undecided: the accepted terms have to
 * name exactly which parts the order is for.
 */
const SubstitutionsPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly rfqId: string }>;
}) => {
  const { rfqId } = await params;
  const actor = await requireBuyer(`/manufacturing/rfq/${rfqId}/substitutions`);
  const request = await getRequest(actor.userId, asId<RfqId>(rfqId));
  if (request === null) notFound();

  const quotes = await listQuotes(actor.userId, asId<RfqId>(rfqId));
  const rows = quotes.flatMap((quote) =>
    quote.substitutions.map((substitution) => ({
      id: substitution.id,
      quoteId: quote.id,
      manufacturerName: quote.manufacturerName,
      status: substitution.status,
      requestedPartReference: substitution.requestedPartReference,
      suggestedPartName: substitution.suggestedPartName,
      technicalJustification: substitution.technicalJustification,
      currency: quote.currency,
      priceImpactMajor: major(substitution.priceImpactMinor),
      leadTimeImpactDays: substitution.leadTimeImpactDays,
      decidedOn: substitution.decidedAt === null ? null : day(substitution.decidedAt),
    })),
  );
  const undecided = rows.filter((row) => row.status === 'proposed');
  // Counted apart from the suggestions, because a part nobody can supply is not
  // a suggestion and does not hold up acceptance (UIUX-162).
  const unsuppliable = rows.filter((row) => row.status === 'unavailable');
  const suggested = rows.length - unsuppliable.length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Replacement parts"
        description={`${request.productName} · ${suggested} suggested, ${undecided.length} undecided${
          unsuppliable.length === 0
            ? ''
            : `, ${unsuppliable.length} cannot be supplied`
        }`}
        breadcrumbs={
          <Crumbs
            items={[
              { label: 'Manufacturing', href: '/manufacturing' },
              { label: 'Quote Requests', href: '/manufacturing/rfq' },
              { label: 'Quotes', href: `/manufacturing/rfq/${rfqId}/quotes` },
              { label: 'Replacement parts' },
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

      <Alert tone={undecided.length > 0 ? 'warning' : 'info'} title="Your substitution policy">
        {POLICY_COPY[request.substitutionPolicy] ?? request.substitutionPolicy}
        {undecided.length > 0 &&
          ' A quote cannot be accepted until every suggestion here has an answer.'}
        {unsuppliable.length > 0 && (
          <span className="mt-1 block">
            {unsuppliable.length === 1 ? 'One part' : `${unsuppliable.length} parts`}{' '}
            {unsuppliable.length === 1 ? 'has' : 'have'} no replacement on offer at all.
            That does not block acceptance — the quote covers the rest, and what you do
            about the gap is your call.
          </span>
        )}
      </Alert>

      {rows.length === 0 ? (
        <EmptyState
          title="No replacements suggested"
          description="Every quote on this request prices the bill of materials exactly as it was sent."
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
        <SubstitutionDecisions substitutions={rows} rfqId={rfqId} />
      )}

      <Text tone="muted" size="xs">
        An approved replacement is named in the accepted quote's immutable record, so
        the order says which part was actually agreed.
      </Text>
    </div>
  );
};

export default SubstitutionsPage;
