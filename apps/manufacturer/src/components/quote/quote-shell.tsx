import Link from 'next/link';
import type { ReactNode } from 'react';
import { Alert, Card, StatusChip, Tag, Text, buttonAppearance } from '@ideeza/ui';
import { ClientPanel } from '@/components/client-panel.js';
import { Crumbs } from '@/components/crumbs.js';
import { HubTabs } from '@/components/hub-tabs.js';
import { QuoteForm } from '@/components/quote/quote-form.js';
import { WithdrawQuote } from '@/components/quote/withdraw-quote.js';
import type { ClientProfile } from '@/data/clients.js';
import type { QuoteDetail } from '@/data/quotes.js';

export const QUOTE_TABS = [
  { id: 'quote', label: 'Quote Details', segment: '' },
  { id: 'rfq', label: 'RFQ overview', segment: '/rfq' },
  { id: 'substitutions', label: 'Substitution', segment: '/substitutions' },
  { id: 'activity', label: 'Quote Activity', segment: '/activity' },
] as const;

export type QuoteTabId = (typeof QUOTE_TABS)[number]['id'];

const day = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);

const major = (minor: number): string => (minor / 100).toFixed(2);

/** What the shop's own status word is, which is not the buyer's. */
const QUOTE_LABEL: Readonly<Record<string, string>> = {
  draft: 'Draft',
  submitted: 'With the buyer',
  revision_requested: 'Revision asked for',
  revised: 'Revised, with the buyer',
  accepted: 'Accepted',
  rejected: 'Not chosen',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
};

export interface QuoteShellProps {
  readonly quote: QuoteDetail;
  readonly client: ClientProfile | null;
  readonly shipsTo: string;
  readonly creatorName: string;
  readonly activeTab: QuoteTabId;
  readonly children: ReactNode;
}

/**
 * The frame every screen of one quote shares.
 *
 * The two decisions in the rail are the only ones a shop has once a quote is
 * out: change the terms, or take it off the table. Accepting is the buyer's, and
 * nothing here pretends otherwise.
 */
export const QuoteShell = ({
  quote,
  client,
  shipsTo,
  creatorName,
  activeTab,
  children,
}: QuoteShellProps) => (
  <div className="flex flex-col gap-6">
    <Crumbs items={[{ label: 'Quotes', href: '/quotes' }, { label: 'Quote Details' }]} />

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <h1 className="text-xl font-bold text-heading">{quote.productName}</h1>
          <StatusChip
            status={quote.expired && quote.status === 'submitted' ? 'expired' : quote.status}
            label={
              quote.expired && quote.status !== 'accepted'
                ? 'Expired'
                : (QUOTE_LABEL[quote.status] ?? quote.status)
            }
            withDot
          />
        </div>

        <Card padded={false}>
          <div className="px-4 py-3 md:px-6">
            <HubTabs
              label="Quote sections"
              items={QUOTE_TABS.map((tab) => ({
                id: tab.id,
                label: tab.label,
                href: `/quotes/${quote.quoteId}${tab.segment}`,
                ...(tab.id === 'substitutions'
                  ? { count: quote.suggestions.length }
                  : {}),
              }))}
              activeId={activeTab}
            />
          </div>
        </Card>

        {children}
      </div>

      <aside className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3">
          {quote.orderId !== null ? (
            <>
              <Text size="sm" className="font-semibold text-heading">
                This quote was accepted
              </Text>
              <Text tone="muted" size="xs">
                An order is open against these terms, and they cannot change now.
              </Text>
              <Link
                href={`/orders/${quote.orderId}`}
                className={buttonAppearance({ className: 'justify-center' })}
              >
                Open the order
              </Link>
            </>
          ) : quote.revisable ? (
            <>
              <QuoteForm
                mode="revise"
                rfqId={quote.rfqId}
                quoteId={quote.quoteId}
                overview={{
                  targetPriceMinor: quote.requestTargetPriceMinor,
                  bomLineCount: quote.bomLineCount,
                  shortLineCount: 0,
                  suggestionCount: quote.suggestions.length,
                  quantity: quote.quantity,
                  currency: quote.currency,
                  volumeTiers: quote.requestVolumeTiers,
                  neededByDays: null,
                }}
                defaults={{
                  unitPriceMajor: major(quote.unitPriceMinor),
                  leadTimeDays: String(quote.leadTimeDays),
                  expiresOn: quote.expiresAt.toISOString().slice(0, 10),
                  shippingMajor:
                    quote.shippingEstimateMinor === null
                      ? ''
                      : major(quote.shippingEstimateMinor),
                  toolingMajor:
                    quote.toolingSetupCostMinor === null
                      ? ''
                      : major(quote.toolingSetupCostMinor),
                  materialProcessNotes: quote.materialProcessNotes,
                  warrantyTerms: quote.warrantyTerms ?? '',
                  terms: quote.terms,
                  volumePrices: Object.fromEntries(
                    quote.volumePrices.map((price) => [
                      String(price.quantity),
                      major(price.unitPriceMinor),
                    ]),
                  ),
                  volumeLeadTimes: Object.fromEntries(
                    quote.volumePrices.map((price) => [
                      String(price.quantity),
                      price.leadTimeDays === null ? '' : String(price.leadTimeDays),
                    ]),
                  ),
                }}
              />
              <WithdrawQuote quoteId={quote.quoteId} productName={quote.productName} />
              <Text tone="muted" size="xs" className="text-center">
                This quote expires {day(quote.expiresAt)}
              </Text>
            </>
          ) : (
            <>
              <Text size="sm" className="font-semibold text-heading">
                {quote.expired
                  ? 'This quote has expired'
                  : `This quote is ${QUOTE_LABEL[quote.status]?.toLowerCase() ?? quote.status}`}
              </Text>
              <Text tone="muted" size="xs">
                {quote.expired
                  ? 'It cannot be accepted any more. The buyer can ask for a new one from the request.'
                  : 'There is nothing left to change on it.'}
              </Text>
              {quote.withdrawable && (
                <WithdrawQuote quoteId={quote.quoteId} productName={quote.productName} />
              )}
            </>
          )}
        </Card>

        <Card className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xl font-bold text-brand">
              {quote.currency} {major(quote.landedTotalMinor)}
            </p>
            <Text tone="muted" size="xs">
              Your quote
            </Text>
          </div>
          <div className="flex items-start justify-between gap-3 border-t border-line pt-2">
            <Text tone="muted" size="xs">
              Buyer&rsquo;s target
            </Text>
            <p className="text-right text-xs font-medium text-heading">
              {quote.requestTargetPriceMinor === null
                ? 'None given'
                : `${quote.currency} ${major(quote.requestTargetPriceMinor)}`}
            </p>
          </div>
          <Text tone="muted" size="xs">
            {quote.quantity} units at {quote.currency} {major(quote.unitPriceMinor)} ·{' '}
            {quote.leadTimeDays} days
          </Text>
        </Card>

        <ClientPanel
          client={client}
          buyerName={quote.buyerName}
          creatorName={creatorName}
          shipsTo={shipsTo}
        />

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/rfqs/${quote.rfqId}`}
            className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
          >
            Open the request
          </Link>
          <Tag tone="neutral">Version {quote.version}</Tag>
        </div>

        {quote.pendingSuggestions > 0 && (
          <Alert tone="warning" title="Substitutes still waiting on the buyer">
            {quote.pendingSuggestions}{' '}
            {quote.pendingSuggestions === 1 ? 'suggestion has' : 'suggestions have'} not
            been decided, and the buyer cannot accept this quote until each one is.
          </Alert>
        )}
      </aside>
    </div>
  </div>
);
