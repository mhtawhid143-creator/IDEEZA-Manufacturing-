import Link from 'next/link';
import type { ReactNode } from 'react';
import { Alert, Card, StatusChip, Tag, Text, buttonAppearance, majorAmount as major } from '@ideeza/ui';
import { ClientPanel } from '@/components/client-panel.js';
import { Crumbs } from '@/components/crumbs.js';
import { HubTabs } from '@/components/hub-tabs.js';
import { QuoteForm } from '@/components/quote/quote-form.js';
import { DeclineRequest } from '@/components/request/decline-request.js';
import type { RequestDetail } from '@/data/rfqs.js';
import type { ClientProfile } from '@/data/clients.js';

export const REQUEST_TABS = [
  { id: 'brief', label: 'Brief', segment: '' },
  { id: 'files', label: 'Production Files', segment: '/files' },
  { id: 'specification', label: 'Production Specification', segment: '/specification' },
  { id: 'bom', label: 'BOM / Parts', segment: '/bom' },
] as const;

export type RequestTabId = (typeof REQUEST_TABS)[number]['id'];

const day = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);


/** The manufacturer's own word for its routing state, not the buyer's. */
const INBOX_LABEL: Readonly<Record<string, string>> = {
  routed: 'New RFQ',
  viewed: 'Opened',
  quoted: 'Quote sent',
  declined: 'Declined',
  expired: 'Expired',
};

export interface RequestShellProps {
  readonly request: RequestDetail;
  readonly client: ClientProfile | null;
  readonly activeTab: RequestTabId;
  /**
   * Lines this shop cannot cover from stock, when the screen has matched them.
   * The quote form states it rather than blocking: sourcing a part yourself is a
   * legitimate answer, and the buyer is entitled to know which answer it is.
   */
  readonly shortLineCount?: number;
  readonly children: ReactNode;
}

/**
 * The frame every screen of one request shares.
 *
 * The right rail is the decision: quote it, or decline it with a reason. What
 * sits under those two buttons is the buyer's ask — the price they hope for and
 * the window they need it in — labelled as theirs, because a shop reading its own
 * number there would be reading a promise nobody made.
 */
export const RequestShell = ({
  request,
  client,
  activeTab,
  shortLineCount,
  children,
}: RequestShellProps) => {

  return (
    <div className="flex flex-col gap-6">
      <Crumbs
        items={[
          { label: 'Request Quote', href: '/rfqs' },
          { label: 'View Details' },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
            <h1 className="text-xl font-bold text-text-primary">{request.productName}</h1>
            <StatusChip
              status={request.status}
              label={INBOX_LABEL[request.status] ?? request.status}
              withDot
            />
          </div>

          <Card padded={false}>
            <div className="px-4 py-3 md:px-6">
              <HubTabs
                label="Request sections"
                items={REQUEST_TABS.map((tab) => ({
                  id: tab.id,
                  label: tab.label,
                  href: `/rfqs/${request.rfqId}${tab.segment}`,
                }))}
                activeId={activeTab}
              />
            </div>
          </Card>

          {children}
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            {request.myQuote !== null ? (
              <>
                <Text size="sm" className="font-semibold text-text-primary">
                  You quoted {request.currency} {major(request.myQuote.totalPriceMinor)}
                </Text>
                <Text tone="muted" size="xs">
                  {request.myQuote.leadTimeDays} days lead time · sent{' '}
                  {day(request.myQuote.submittedAt)} · valid to{' '}
                  {day(request.myQuote.expiresAt)}
                </Text>
                <Link
                  href={`/quotes/${request.myQuote.id}`}
                  className={buttonAppearance({ className: 'justify-center' })}
                >
                  View your quote
                </Link>
              </>
            ) : request.status === 'declined' ? (
              <>
                <Text size="sm" className="font-semibold text-text-primary">
                  You declined this request
                </Text>
                <Text tone="muted" size="xs">
                  {request.declineReasonLabel ?? 'No reason recorded'}
                  {request.declineNote === null ? '' : ` — ${request.declineNote}`}
                </Text>
              </>
            ) : !request.open ? (
              <Text size="sm" className="font-semibold text-text-primary">
                This request is closed. Nothing here is yours to answer any more.
              </Text>
            ) : (
              <>
                <QuoteForm
                  mode="submit"
                  rfqId={request.rfqId}
                  overview={{
                    targetPriceMinor: request.targetPriceMinor,
                    bomLineCount: request.bomLines.length,
                    shortLineCount: shortLineCount ?? 0,
                    suggestionCount: request.draftSuggestionCount,
                    quantity: request.quantity,
                    currency: request.currency,
                    volumeTiers: request.volumeTiers,
                    neededByDays:
                      request.neededBy === null
                        ? null
                        : Math.max(
                            0,
                            Math.round(
                              (request.neededBy.getTime() - Date.now()) / 86_400_000,
                            ),
                          ),
                  }}
                />
                <DeclineRequest
                  rfqId={request.rfqId}
                  productName={request.productName}
                />
                <Text tone="muted" size="xs" className="text-center">
                  {request.expiresAt === null
                    ? 'No response deadline was set for your shop'
                    : `This request expires ${day(request.expiresAt)}`}
                </Text>
              </>
            )}
          </Card>

          <Card className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xl font-bold text-text-brand">
                {request.targetPriceMinor === null
                  ? 'Open'
                  : `${request.currency} ${major(request.targetPriceMinor)}`}
              </p>
              <Text tone="muted" size="xs">
                Buyer&rsquo;s target
              </Text>
            </div>
            <div className="flex items-start justify-between gap-3 border-t border-border-subtle pt-2">
              <Text tone="muted" size="xs">
                Wanted by
              </Text>
              <p className="text-right text-xs font-medium text-text-primary">
                {request.neededBy === null
                  ? 'No date given'
                  : `${day(request.receivedAt)} → ${day(request.neededBy)}`}
              </p>
            </div>
            <Text tone="muted" size="xs">
              {request.targetPriceMinor === null
                ? 'No target price was given, so price it as you see it.'
                : 'A target, not an agreed price. Quote what the work costs you.'}
            </Text>
          </Card>

          <ClientPanel
            client={client}
            buyerName={request.buyerName}
            creatorName={request.creatorName}
            shipsTo={`${request.shipTo.city}, ${request.shipTo.countryCode}`}
          />

          <div className="flex flex-wrap gap-2">
            <Tag tone="brand">{request.kindLabel}</Tag>
            <Tag tone="neutral">{request.quantity} units</Tag>
            {request.serviceLabels.map((label) => (
              <Tag key={label} tone="neutral">
                {label}
              </Tag>
            ))}
          </div>

          {request.requirementsLockedAt === null && (
            <Alert tone="warning" title="These requirements are not frozen yet">
              The buyer can still change them, so anything you quote against this
              could move.
            </Alert>
          )}
        </aside>
      </div>
    </div>
  );
};
