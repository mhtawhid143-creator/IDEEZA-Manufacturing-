import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card, PageHeader, StatusChip, buttonAppearance } from '@ideeza/ui';
import { Crumbs } from '@/components/crumbs.js';
import { HubTabs } from '@/components/hub-tabs.js';
import type { RequestDetail } from '@/data/requests.js';

export const REQUEST_TABS = [
  { id: 'all', label: 'All', segment: '' },
  { id: 'quotes', label: 'Quotes', segment: '/quotes' },
  { id: 'accepted', label: 'Accepted', segment: '/accepted' },
  { id: 'activity', label: 'Activity', segment: '/activity' },
] as const;

export type RequestTabId = (typeof REQUEST_TABS)[number]['id'];

export interface RequestShellProps {
  readonly request: RequestDetail;
  readonly activeTab: RequestTabId;
  readonly counts?: Readonly<Record<string, number>> | undefined;
  readonly children: ReactNode;
}

/**
 * The frame every screen of one request shares: which request it is, what state
 * it is in, and the four ways of looking at it.
 *
 * Each tab is its own route, so a quote can be linked to from a message or a
 * notification and the back button behaves.
 */
export const RequestShell = ({
  request,
  activeTab,
  counts,
  children,
}: RequestShellProps) => (
  <div className="flex flex-col gap-6">
    <PageHeader
      title={request.productName}
      description={`Manufacturing request · ${request.quantity} units · ${request.recipientCount} ${
        request.recipientCount === 1 ? 'manufacturer' : 'manufacturers'
      }`}
      breadcrumbs={
        <Crumbs
          items={[
            { label: 'Manufacturing', href: '/manufacturing' },
            { label: 'Quote Requests', href: '/manufacturing/rfq' },
            { label: 'Request' },
          ]}
        />
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={request.status} withDot />
          <Link
            href={`/products/${request.productId}`}
            className={buttonAppearance({ variant: 'secondary' })}
          >
            View product
          </Link>
        </div>
      }
    />

    <Card padded={false}>
      <div className="px-4 py-3 md:px-6">
        <HubTabs
          label="Request sections"
          items={REQUEST_TABS.map((tab) => ({
            id: tab.id,
            label: tab.label,
            href: `/manufacturing/rfq/${request.rfqId}${tab.segment}`,
            ...(counts?.[tab.id] === undefined ? {} : { count: counts[tab.id] }),
          }))}
          activeId={activeTab}
        />
      </div>
    </Card>

    {children}
  </div>
);
