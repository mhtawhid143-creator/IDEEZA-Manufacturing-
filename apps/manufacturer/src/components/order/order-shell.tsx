import Link from 'next/link';
import type { ReactNode } from 'react';
import { Alert, Card, StatusChip, Tag, Text, buttonAppearance, majorAmount as major } from '@ideeza/ui';
import { ClientPanel } from '@/components/client-panel.js';
import { Crumbs } from '@/components/crumbs.js';
import { HubTabs } from '@/components/hub-tabs.js';
import { OrderActs, type StockOption } from '@/components/order/order-acts.js';
import type { ClientProfile } from '@/data/clients.js';
import type { OrderDetail } from '@/data/orders.js';

export const ORDER_TABS = [
  { id: 'production', label: 'Production Stage', segment: '' },
  { id: 'quote', label: 'Quote Details', segment: '/quote' },
  { id: 'files', label: 'Production files', segment: '/files' },
  { id: 'specification', label: 'Production Specification', segment: '/specification' },
] as const;

export type OrderTabId = (typeof ORDER_TABS)[number]['id'];

const day = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);


export interface OrderShellProps {
  readonly order: OrderDetail;
  readonly client: ClientProfile | null;
  readonly creatorName: string;
  readonly activeTab: OrderTabId;
  readonly stock: readonly StockOption[];
  readonly reviewWindowDays: number;
  readonly children: ReactNode;
}

/**
 * The frame every screen of one order shares.
 *
 * The rail is what this shop may do about the order, and what it may not: the
 * money is held by the platform and released against a documented event, so
 * nothing here offers to release it. The order's own status is the buyer's word
 * for where it stands, and it is shown unchanged.
 */
export const OrderShell = ({
  order,
  client,
  creatorName,
  activeTab,
  stock,
  reviewWindowDays,
  children,
}: OrderShellProps) => {
  const shippedStage = order.stages.find((stage) => stage.key === 'shipped');
  const deliveredStage = order.stages.find((stage) => stage.key === 'delivered');
  const readyStage = order.stages.find((stage) => stage.key === 'ready_to_ship');

  return (
    <div className="flex flex-col gap-6">
      <Crumbs
        items={[{ label: 'My Orders', href: '/orders' }, { label: 'Order details' }]}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-text-primary">{order.productName}</h1>
              <Text tone="muted" size="sm">
                {order.quantity} units · {order.currency}{' '}
                {major(order.totalPriceMinor)} · ordered {day(order.confirmedAt)}
              </Text>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {order.late && <Tag tone="danger">Past the quoted date</Tag>}
              <StatusChip status={order.status} withDot />
            </div>
          </div>

          <Card padded={false}>
            <div className="px-4 py-3 md:px-6">
              <HubTabs
                label="Order sections"
                items={ORDER_TABS.map((tab) => ({
                  id: tab.id,
                  label: tab.label,
                  href: `/orders/${order.orderId}${tab.segment}`,
                }))}
                activeId={activeTab}
              />
            </div>
          </Card>

          {!order.fundingSecured && (
            <Alert tone="warning" title="Not funded yet, so production cannot start">
              The platform is not holding the buyer&rsquo;s money for this order. Every
              stage on the shop floor is refused until it is — which is what protects
              you from building something nobody has paid for.
            </Alert>
          )}

          {order.openAlerts > 0 && (
            <Alert tone="danger" title="Production is held for a shortage">
              {order.openAlerts} part shortage
              {order.openAlerts === 1 ? '' : 's'} is waiting on the buyer&rsquo;s answer.
              Nothing can move until they decide, because the terms name the parts.
            </Alert>
          )}

          {children}
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <Text size="sm" className="font-semibold text-text-primary">
              What you can do now
            </Text>
            <OrderActs
              orderId={order.orderId}
              productName={order.productName}
              currency={order.currency}
              canShip={
                order.fundingSecured &&
                readyStage?.status === 'completed' &&
                shippedStage?.status !== 'completed'
              }
              canDeliver={
                shippedStage?.status === 'completed' &&
                deliveredStage?.status !== 'completed'
              }
              canRaiseShortage={
                order.fundingSecured &&
                ['confirmed', 'in_production', 'quality_check'].includes(order.status)
              }
              canRequestCancellation={order.cancellable}
              stock={stock}
              reviewWindowDays={reviewWindowDays}
            />
            {!order.fundingSecured && (
              <Text tone="muted" size="xs">
                Nothing here is available until the order is funded.
              </Text>
            )}
          </Card>

          <Card className="flex flex-col gap-2" data-tour="order-money">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xl font-bold text-text-brand">
                {order.currency} {major(order.totalPriceMinor)}
              </p>
              <Text tone="muted" size="xs">
                Held by IDEEZA
              </Text>
            </div>
            <Text tone="muted" size="xs">
              Released against a documented event: the buyer confirming delivery, the
              review window closing, or a resolved issue.
            </Text>
            <div className="flex items-start justify-between gap-3 border-t border-border-subtle pt-2">
              <Text tone="muted" size="xs">
                Est. ship
              </Text>
              <p className="text-right text-xs font-medium text-text-primary">
                {day(order.schedule?.estimatedShipAt ?? null)}
              </p>
            </div>
            <div className="flex items-start justify-between gap-3">
              <Text tone="muted" size="xs">
                Est. delivery
              </Text>
              <p className="text-right text-xs font-medium text-text-primary">
                {day(order.schedule?.estimatedDeliveryAt ?? null)}
              </p>
            </div>
            {order.reviewWindowEndsAt !== null && (
              <div className="flex items-start justify-between gap-3">
                <Text tone="muted" size="xs">
                  Review window ends
                </Text>
                <p className="text-right text-xs font-medium text-text-primary">
                  {day(order.reviewWindowEndsAt)}
                </p>
              </div>
            )}
          </Card>

          <ClientPanel
            client={client}
            buyerName={order.buyerName}
            creatorName={creatorName}
            shipsTo={`${order.shipTo.city}, ${order.shipTo.countryCode}`}
          />

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/quotes/${order.quoteId}`}
              className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
            >
              The quote it came from
            </Link>
            <Link
              href={`/rfqs/${order.rfqId}`}
              className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
            >
              The request
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
};
