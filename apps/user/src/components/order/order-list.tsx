'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, buttonAppearance, EmptyState, Icon, StatusChip, Tag, Text, Tooltip, type MenuItem } from '@ideeza/ui';
import { RowMenu } from '@/components/row-menu.js';
import { goTo } from '@/lib/navigate.js';

export interface OrderRow {
  readonly orderId: string;
  readonly rfqId: string;
  readonly productName: string;
  readonly manufacturerName: string;
  readonly status: string;
  readonly quantity: number;
  readonly currency: string;
  readonly totalMajor: string;
  readonly fileCount: number;
  readonly typesIncluded: readonly string[];
  readonly openAlertCount: number;
  readonly orderedOn: string;
}

export interface OrderListProps {
  readonly orders: readonly OrderRow[];
  /** Copy for the empty state, which differs between the two tabs. */
  readonly emptyTitle: string;
  readonly emptyDescription: string;
}

/**
 * The actions a buyer has on one order, decided by the state it is in.
 *
 * Only what is actually possible is offered: an unpaid order can be cancelled
 * and not refunded, a delivered one can be confirmed and reviewed, and a
 * disputed one leads to the dispute rather than to another refund request.
 */
const menuFor = (row: OrderRow, go: (href: string) => void): readonly MenuItem[] => {
  const base = `/manufacturing/orders/${row.orderId}`;
  const items: MenuItem[] = [
    { id: 'view', label: 'View details', onSelect: () => go(base) },
  ];

  if (row.status === 'awaiting_payment') {
    items.push({
      id: 'pay',
      label: 'Pay to confirm',
      onSelect: () => go(`/manufacturing/checkout/${row.orderId}`),
    });
  } else {
    items.push({
      id: 'message',
      label: 'Message manufacturer',
      onSelect: () => go('/messages'),
    });
  }

  if (row.status === 'delivered') {
    items.push({
      id: 'confirm',
      label: 'Confirm delivery',
      onSelect: () => go(`${base}/confirm-delivery`),
    });
  }

  if (row.status === 'awaiting_payment' || row.status === 'confirmed') {
    items.push({
      id: 'cancel',
      label: 'Cancel order',
      tone: 'danger',
      onSelect: () => go(`${base}/cancel`),
    });
  }

  if (
    row.status === 'in_production' ||
    row.status === 'quality_check' ||
    row.status === 'ready_to_ship' ||
    row.status === 'shipped' ||
    row.status === 'delivered'
  ) {
    items.push({
      id: 'refund',
      label: 'Request refund',
      onSelect: () => go(`${base}/refund`),
    });
  }

  if (row.status === 'disputed') {
    items.push({
      id: 'dispute',
      label: 'Manage dispute',
      onSelect: () => go(`${base}/dispute`),
    });
  }

  items.push({
    id: 'records',
    label: 'Order records',
    onSelect: () => go(`${base}/records`),
  });
  return items;
};

/**
 * The Active Orders and Order History lists.
 *
 * One row is one order: what it is, what it cost, where it is, and the actions
 * its state allows. A shortage waiting on the buyer is surfaced on the row
 * itself, because production is paused until it is answered.
 */
export const OrderList = ({ orders, emptyTitle, emptyDescription }: OrderListProps) => {
  const router = useRouter();

  if (orders.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={
          <Link
            href="/manufacturing/rfq"
            className={buttonAppearance({ variant: 'secondary' })}
          >
            See your requests
          </Link>
        }
      />
    );
  }

  return (
    <ul aria-label="Orders" className="flex flex-col gap-3">
      {orders.map((row) => (
        <li
          key={row.orderId}
          className="flex flex-wrap items-center gap-4 rounded-lg border border-border-subtle bg-bg-surface p-4"
        >
          <span
            aria-hidden
            className="h-12 w-12 shrink-0 rounded-md bg-gradient-to-br from-bg-brand-subtle to-blue-100"
          />

          <div className="min-w-0 flex-1">
            <Link
              href={`/manufacturing/orders/${row.orderId}`}
              className="truncate text-sm font-semibold text-text-primary hover:text-text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
            >
              {row.productName}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link
                href={`/manufacturing/rfq/${row.rfqId}`}
                className="text-xs font-medium text-text-brand underline hover:no-underline"
              >
                Show files ({row.fileCount})
              </Link>
              <Text tone="muted" size="xs">
                · {row.manufacturerName} · ordered {row.orderedOn}
              </Text>
            </div>
          </div>

          <div className="hidden min-w-0 shrink-0 sm:block">
            <Text tone="muted" size="xs">
              Type included
            </Text>
            <div className="mt-1 flex flex-wrap gap-1">
              {row.typesIncluded.length === 0 ? (
                <Text tone="muted" size="xs">
                  —
                </Text>
              ) : (
                row.typesIncluded.map((type) => (
                  <Tag key={type} tone="neutral">
                    {type}
                  </Tag>
                ))
              )}
            </div>
          </div>

          <div className="shrink-0">
            <Tooltip content="What was charged, including shipping and the platform fee">
              <Text tone="muted" size="xs">
                Cost
              </Text>
            </Tooltip>
            <p className="text-sm font-semibold text-text-primary">
              {row.currency} {row.totalMajor}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {row.openAlertCount > 0 && (
              <Badge tone="warning">
                {row.openAlertCount} needs your answer
              </Badge>
            )}
            <StatusChip status={row.status} withDot />
            <RowMenu
              label={`Actions for ${row.productName}`}
              items={menuFor(row, (href) => goTo(router, href))}
              trigger={(props) => (
                <button
                  type="button"
                  ref={props.ref}
                  onClick={props.onClick}
                  aria-expanded={props['aria-expanded']}
                  aria-haspopup={props['aria-haspopup']}
                  id={props.id}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-tertiary hover:bg-bg-surface-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                >
                  <span className="sr-only">Actions</span>
                  <Icon name="more" />
                </button>
              )}
            />
          </div>
        </li>
      ))}
    </ul>
  );
};
