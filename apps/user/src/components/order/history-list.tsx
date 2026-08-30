'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Badge, buttonAppearance, DropdownMenu, EmptyState, Icon, StatusChip, Tag, Text, type MenuItem, useToast } from '@ideeza/ui';
import { ReviewModal } from './review-modal.js';
import { reorderAction } from '@/app/(app)/manufacturing/orders/delivery-actions.js';
import { goTo } from '@/lib/navigate.js';

export interface HistoryRowView {
  readonly orderId: string;
  readonly rfqId: string;
  readonly productName: string;
  readonly manufacturerName: string;
  readonly status: string;
  readonly outcome: string;
  readonly currency: string;
  readonly totalMajor: string;
  readonly fileCount: number;
  readonly typesIncluded: readonly string[];
  readonly closedOn: string;
  readonly reviewed: boolean;
  readonly canReview: boolean;
  readonly reviewWindowDaysLeft: number;
}

/**
 * Order History: what happened, and what can still be done about it.
 *
 * Re-ordering and leaving feedback are the two things a past order actually
 * supports, which is what the design's row menu offers. Re-order is the same
 * decision as starting manufacturing, so it can refuse for the same reasons and
 * says so rather than failing quietly.
 */
export const HistoryList = ({ orders }: { readonly orders: readonly HistoryRowView[] }) => {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [reviewing, setReviewing] = useState<HistoryRowView | null>(null);

  const reorder = (row: HistoryRowView): void => {
    startTransition(async () => {
      const result = await reorderAction(row.orderId);
      if (result.kind === 'ready') {
        push({
          title: 'Draft opened from this order',
          body: 'The same package and requirements, ready to send for new quotes.',
          tone: 'success',
        });
        goTo(router, result.href);
        return;
      }
      if (result.kind === 'existing-request') {
        push({
          title: 'You already have an open request for this product',
          body: 'Finish or withdraw it before starting another.',
          tone: 'info',
        });
        goTo(router, result.href);
        return;
      }
      if (result.kind === 'unavailable') {
        push({
          title: `${result.productName} is currently unavailable`,
          body: 'The creator has taken it out of manufacturing.',
          tone: 'warning',
        });
        return;
      }
      push({ title: 'Nothing was opened', body: result.message, tone: 'danger' });
    });
  };

  const menuFor = (row: HistoryRowView): readonly MenuItem[] => {
    const items: MenuItem[] = [
      {
        id: 'view',
        label: 'View details',
        onSelect: () => goTo(router, `/manufacturing/orders/${row.orderId}`),
      },
      { id: 'reorder', label: 'Re-order', disabled: pending, onSelect: () => reorder(row) },
    ];
    if (row.canReview) {
      items.push({
        id: 'feedback',
        label: 'Give feedback',
        onSelect: () => setReviewing(row),
      });
    }
    items.push({
      id: 'records',
      label: 'Order records',
      onSelect: () => goTo(router, `/manufacturing/orders/${row.orderId}/records`),
    });
    return items;
  };

  if (orders.length === 0) {
    return (
      <EmptyState
        title="No finished orders yet"
        description="An order moves here once it is delivered, completed, cancelled or refunded."
        action={
          <Link
            href="/manufacturing/orders"
            className={buttonAppearance({ variant: 'secondary' })}
          >
            See active orders
          </Link>
        }
      />
    );
  }

  return (
    <>
      <ul aria-label="Order history" className="flex flex-col gap-3">
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
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2">
                <Link
                  href={`/manufacturing/rfq/${row.rfqId}`}
                  className="text-xs font-medium text-text-brand underline hover:no-underline"
                >
                  Show files ({row.fileCount})
                </Link>
                <Text tone="muted" size="xs">
                  · {row.outcome} · {row.closedOn}
                </Text>
              </div>
            </div>

            <div className="hidden shrink-0 sm:block">
              <Text tone="muted" size="xs">
                Type included
              </Text>
              <div className="mt-1 flex flex-wrap gap-1">
                {row.typesIncluded.map((type) => (
                  <Tag key={type} tone="neutral">
                    {type}
                  </Tag>
                ))}
              </div>
            </div>

            <div className="shrink-0">
              <Text tone="muted" size="xs">
                Cost
              </Text>
              <p className="text-sm font-semibold text-text-primary">
                {row.currency} {row.totalMajor}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {row.reviewed ? (
                <Badge tone="success">Reviewed</Badge>
              ) : row.canReview && row.reviewWindowDaysLeft > 0 ? (
                <Badge tone="brand">{row.reviewWindowDaysLeft}d to review</Badge>
              ) : null}
              <StatusChip status={row.status} withDot />
              <DropdownMenu
                label={`Actions for ${row.productName}`}
                items={menuFor(row)}
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

      {reviewing !== null && (
        <ReviewModal
          orderId={reviewing.orderId}
          manufacturerName={reviewing.manufacturerName}
          open
          onClose={() => setReviewing(null)}
        />
      )}
    </>
  );
};
