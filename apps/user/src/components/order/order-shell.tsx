import type { ReactNode } from 'react';
import { Card, StatusChip, Tag, Text } from '@ideeza/ui';
import { Crumbs } from '@/components/crumbs.js';
import { HubTabs } from '@/components/hub-tabs.js';
import type { OrderDetail } from '@/data/orders.js';

export const ORDER_TABS = [
  { id: 'overview', label: 'Production Overview', segment: '' },
  { id: 'items', label: 'Product Details', segment: '/items' },
  { id: 'progress', label: 'Production Progress', segment: '/progress' },
] as const;

export type OrderTabId = (typeof ORDER_TABS)[number]['id'];

export interface OrderShellProps {
  readonly order: OrderDetail;
  readonly activeTab: OrderTabId;
  /** Derived from the funding date, the quoted lead time and the courier. */
  readonly schedule: {
    readonly orderedOn: string;
    readonly estimatedShip: string | null;
    readonly estimatedDelivery: string | null;
  };
  readonly children: ReactNode;
}

/**
 * The frame every screen of one order shares.
 *
 * The header states the three dates the buyer plans around and the order's own
 * status. The dates are estimates derived from the terms, and they are labelled
 * as estimates: nothing here promises a delivery the manufacturer did not quote.
 */
export const OrderShell = ({ order, activeTab, schedule, children }: OrderShellProps) => (
  <div className="flex flex-col gap-6">
    <Crumbs
      items={[
        { label: 'Manufacturing', href: '/manufacturing' },
        { label: 'Active Orders', href: '/manufacturing/orders' },
        { label: 'Order Details' },
      ]}
    />

    <Card className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <span
          aria-hidden
          className="h-14 w-14 shrink-0 rounded-lg bg-gradient-to-br from-bg-brand-subtle to-bg-info-subtle"
        />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-text-primary">
            {order.productName}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Tag tone="brand">Ordered {schedule.orderedOn}</Tag>
            {schedule.estimatedShip !== null && (
              <Tag tone="brand">Est. ship {schedule.estimatedShip}</Tag>
            )}
            {schedule.estimatedDelivery !== null && (
              <Tag tone="brand">Est. delivery {schedule.estimatedDelivery}</Tag>
            )}
            {schedule.estimatedShip === null && (
              <Text tone="muted" size="xs">
                Dates start once the funds are held
              </Text>
            )}
          </div>
        </div>
      </div>
      <StatusChip status={order.status} withDot />
    </Card>

    <Card padded={false}>
      <div className="px-4 py-3 md:px-6">
        <HubTabs
          label="Order sections"
          items={ORDER_TABS.map((tab) => ({
            id: tab.id,
            label: tab.label,
            href: `/manufacturing/orders/${order.orderId}${tab.segment}`,
          }))}
          activeId={activeTab}
        />
      </div>
    </Card>

    {children}
  </div>
);
