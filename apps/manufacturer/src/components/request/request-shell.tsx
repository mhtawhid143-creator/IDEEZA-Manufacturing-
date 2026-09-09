import Link from 'next/link';
import type { ReactNode } from 'react';
import { Alert, Card, StatusChip, Tag, Text, buttonAppearance, majorAmount as major } from '@ideeza/ui';
import { counted, QUOTE_LIFECYCLE_LABEL, QUOTE_REASON_LABEL } from '@ideeza/domain';
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
      {/* The record's own name, matching the heading below it (UIUX-204). */}
      <Crumbs
        items={[
          { label: 'RFQs', href: '/rfqs' },
          { label: request.productName },
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
            {/*
              What this shop sent, read back beside the buyer's ask rather than
              only behind a button (UIUX-176) — and where it can still be
              changed, so "Withdrawn" is a state the shop can actually reach.
            */}
            {request.myQuote !== null ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Text size="sm" className="font-semibold text-text-primary">
                    Your quote
                  </Text>
                  <StatusChip
                    status={request.myQuote.lifecycle === 'quoted' ? 'submitted' : request.myQuote.lifecycle}
                    label={QUOTE_LIFECYCLE_LABEL[request.myQuote.lifecycle]}
                  />
                </div>
                <p className="text-xl font-bold text-text-primary">
                  {request.currency} {major(request.myQuote.totalPriceMinor)}
                </p>
                <Text tone="muted" size="xs">
                  {request.currency} {major(request.myQuote.unitPriceMinor)} per unit ·{' '}
                  {counted(request.myQuote.leadTimeDays, 'day')} to make · sent{' '}
                  {day(request.myQuote.submittedAt)} · valid to{' '}
                  {day(request.myQuote.expiresAt)}
                </Text>
                {request.myQuote.reason !== null && (
                  <Text tone="danger" size="xs">
                    {QUOTE_REASON_LABEL[request.myQuote.reason]}
                  </Text>
                )}
                <Link
                  href={`/quotes/${request.myQuote.id}`}
                  className={buttonAppearance({ className: 'justify-center' })}
                >
                  {request.myQuote.changeable ? 'Revise or withdraw it' : 'View your quote'}
                </Link>
                <Text tone="muted" size="xs">
                  {request.myQuote.changeable
                    ? 'Changing the price and taking the quote off the table both happen on the quote itself, where the history of what you offered is kept.'
                    : 'This quote is settled. Its record stays readable.'}
                </Text>
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
                    // The buyer's own two dates, so the form can name them
                    // instead of leaving the shop to read them off the rail
                    // beside it and do the arithmetic (UIUX-168).
                    neededByOn:
                      request.neededBy === null
                        ? null
                        : request.neededBy.toISOString().slice(0, 10),
                    respondByOn:
                      request.respondBy === null
                        ? null
                        : request.respondBy.toISOString().slice(0, 10),
                    costKinds: request.costKinds,
                    specLockedOn:
                      request.requirementsLockedAt === null
                        ? null
                        : request.requirementsLockedAt.toISOString().slice(0, 10),
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
