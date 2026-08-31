import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Card,
  CardHeader,
  EmptyState,
  StatusChip,
  Text,
  buttonAppearance,
  majorAmount,
} from '@ideeza/ui';
import { asId, type QuoteId } from '@ideeza/domain';
import { QuoteShell } from '@/components/quote/quote-shell.js';
import { getClientProfile } from '@/data/clients.js';
import { getQuote } from '@/data/quotes.js';
import { getRoutedRequest } from '@/data/rfqs.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const day = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);

const major = (minor: number): string =>
  `${minor < 0 ? '-' : ''}${majorAmount(minor)}`;

const DECISION_LABEL: Readonly<Record<string, string>> = {
  proposed: 'Waiting on the buyer',
  approved: 'Buyer approved',
  rejected: 'Buyer rejected',
};

/**
 * Substitution: every part this quote asks to change, and what the buyer said.
 *
 * The decision is the buyer's, and this screen only reports it. An undecided
 * suggestion is not a delay the shop can push through — the platform will not let
 * the quote be accepted until each one is answered, which is what protects the
 * buyer from receiving parts they never agreed to.
 */
const QuoteSubstitutionsPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly quoteId: string }>;
}) => {
  const { quoteId } = await params;
  const actor = await requireManufacturer(`/quotes/${quoteId}/substitutions`);
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
        request === null ? '—' : `${request.shipTo.city}, ${request.shipTo.countryCode}`
      }
      activeTab="substitutions"
    >
      <Card padded={false}>
        <div className="px-4 py-4 md:px-6">
          <CardHeader
            title="Substitutes this quote suggests"
            description={
              quote.suggestions.length === 0
                ? 'None. This quote prices the bill of materials exactly as it was sent.'
                : `${quote.suggestions.length} suggested · ${quote.pendingSuggestions} still undecided`
            }
            actions={
              <Link
                href={`/rfqs/${quote.rfqId}/bom`}
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                Open the bill of materials
              </Link>
            }
          />
        </div>

        {quote.suggestions.length === 0 ? (
          <div className="px-4 pb-6 md:px-6">
            <EmptyState
              title="No substitutes suggested"
              description="Every line is priced as the buyer specified it."
            />
          </div>
        ) : (
          <ul aria-label="Suggested substitutes" className="border-t border-border-subtle">
            {quote.suggestions.map((suggestion) => (
              <li
                key={suggestion.id}
                className="border-b border-border-subtle px-4 py-4 last:border-b-0 md:px-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text-primary">
                    {suggestion.requestedPartReference} → {suggestion.suggestedPartName}
                  </p>
                  <StatusChip
                    status={suggestion.status}
                    label={DECISION_LABEL[suggestion.status] ?? suggestion.status}
                    withDot
                  />
                </div>
                <Text tone="muted" size="xs" className="mt-1 block">
                  {suggestion.priceImpactMinor === 0
                    ? 'No price change on record'
                    : `${suggestion.priceImpactMinor > 0 ? 'Adds' : 'Saves'} ${
                        quote.currency
                      } ${major(Math.abs(suggestion.priceImpactMinor))}`}
                  {suggestion.leadTimeImpactDays === 0
                    ? ' · no extra days'
                    : ` · ${suggestion.leadTimeImpactDays} extra days`}
                  {suggestion.decidedAt === null
                    ? ''
                    : ` · decided ${day(suggestion.decidedAt)}`}
                </Text>
                <Text size="sm" className="mt-2 block">
                  {suggestion.justification}
                </Text>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Whose decision this is" />
        <Text size="sm" className="mt-2 block">
          Yours to suggest, theirs to decide. While a suggestion is undecided the buyer
          cannot accept this quote, so the terms they accept always name exactly which
          parts are used. If a suggestion is rejected, the part is the one they
          specified.
        </Text>
      </Card>
    </QuoteShell>
  );
};

export default QuoteSubstitutionsPage;
