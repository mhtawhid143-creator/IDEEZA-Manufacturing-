'use client';

import Link from 'next/link';
import {orderReference, counted } from '@ideeza/domain';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Badge,
  DataTable,
  EmptyState,
  FormField,
  Input,
  Pagination,
  SearchInput,
  Select,
  StageTrack,
  type StageTrackState,
  StatusChip,
  Tag,
  Text,
} from '@ideeza/ui';
import { RowMenu } from '@/components/row-menu.js';

export interface OrderListRow {
  readonly orderId: string;
  /** The quote this order was opened against (UIUX-202). */
  readonly quoteReference: string | null;
  readonly productName: string;
  readonly buyerName: string;
  readonly status: string;
  readonly disputeId: string | null;
  readonly disputeStatus: string | null;
  readonly quantity: number;
  readonly currency: string;
  readonly unitPriceMajor: string;
  readonly totalPriceMajor: string;
  /** The date the quoted lead time lands on, null before the order is funded. */
  readonly dueOn: string | null;
  readonly dueInDays: number | null;
  readonly currentStageLabel: string | null;
  readonly completedStages: number;
  readonly totalStages: number;
  readonly openAlerts: number;
  readonly fundingSecured: boolean;
  readonly late: boolean;
  readonly orderedOn: string;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Any status' },
  { value: 'in_production', label: 'Everything in flight' },
  { value: 'due', label: 'Due or overdue' },
  { value: 'attention', label: 'Needing an answer' },
  { value: 'unfunded', label: 'Not funded yet' },
  { value: 'late', label: 'Past the quoted date' },
  { value: 'awaiting_payment', label: 'Awaiting payment' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_production', label: 'In production' },
  { value: 'quality_check', label: 'Quality check' },
  { value: 'ready_to_ship', label: 'Ready to ship' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancel_requested', label: 'Cancellation requested' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refund_requested', label: 'Refund requested' },
  { value: 'disputed', label: 'Disputed' },
];

/**
 * What the order's own state does to its stage track (UIUX-200).
 *
 * Order matters. An order that has stopped has stopped whatever else is true of
 * it; a case being open outranks being behind, because nothing will move until
 * the case is decided; and being behind outranks ordinary progress. Without this
 * the track drew a cancelled order exactly like a healthy one.
 */
const trackState = (row: OrderListRow): StageTrackState => {
  if (row.status === 'cancelled' || row.status === 'refunded') return 'stopped';
  if (row.status === 'disputed' || (row.disputeId !== null && row.disputeStatus !== 'resolved'))
    return 'held';
  if (row.late) return 'late';
  if (row.currentStageLabel === null) return 'finished';
  return 'running';
};

/**
 * The orders this shop is building, with where each one has got to.
 *
 * The stage bar is the canonical ten, so it says the same thing the buyer's own
 * screen says. What is late is judged against the lead time this shop quoted, not
 * against a guess.
 */
export const OrderList = ({
  rows,
  page,
  pageCount,
  filtered,
}: {
  readonly rows: readonly OrderListRow[];
  readonly page: number;
  readonly pageCount: number;
  readonly filtered: boolean;
}) => {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');

  useEffect(() => setSearch(params.get('q') ?? ''), [params]);

  const apply = (changes: Readonly<Record<string, string>>): void => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === '' || value === 'all') next.delete(key);
      else next.set(key, value);
    }
    next.delete('page');
    const query = next.toString();
    router.push(query === '' ? '/orders' : `/orders?${query}`);
  };

  const goToPage = (next: number): void => {
    const query = new URLSearchParams(params.toString());
    if (next <= 1) query.delete('page');
    else query.set('page', String(next));
    const text = query.toString();
    router.push(text === '' ? '/orders' : `/orders?${text}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form
          className="min-w-[240px] flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            apply({ q: search });
          }}
        >
          <FormField label="Search by product name" labelHidden>
            <SearchInput
              name="q"
              placeholder="Search by product name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </FormField>
        </form>

        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Status" labelHidden className="min-w-[200px]">
            <Select
              options={STATUS_OPTIONS}
              value={params.get('status') ?? 'all'}
              onChange={(event) => apply({ status: event.target.value })}
            />
          </FormField>
          <FormField label="Ordered from" className="min-w-[150px]">
            <Input
              type="date"
              value={params.get('from') ?? ''}
              onChange={(event) => apply({ from: event.target.value })}
            />
          </FormField>
          <FormField label="Ordered until" className="min-w-[150px]">
            <Input
              type="date"
              value={params.get('to') ?? ''}
              onChange={(event) => apply({ to: event.target.value })}
            />
          </FormField>
        </div>
      </div>

      <DataTable
        caption="Orders your shop is building"
        rows={rows}
        rowKey={(row) => row.orderId}
        emptyState={
          <EmptyState
            title={filtered ? 'Nothing matches those filters' : 'No orders yet'}
            description={
              filtered
                ? 'Clear the search, the status or the dates to see everything.'
                : 'An order opens when a buyer accepts one of your quotes. It is confirmed once IDEEZA is holding their money.'
            }
          />
        }
        columns={[
          {
            id: 'order',
            header: 'Product',
            cell: (row) => (
              <div className="min-w-0">
                <Link
                  href={`/orders/${row.orderId}`}
                  className="block truncate text-sm font-semibold text-text-primary hover:text-text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                >
                  {row.productName}
                </Link>
                {/*
                  Where the row came from as well as what it is (UIUX-202):
                  every order was opened against an accepted quote, and a shop
                  monitoring one should not have to search Quotes by memory to
                  find what it agreed to.
                */}
                <Text tone="muted" size="xs">
                  {row.buyerName} · {orderReference(row.orderId)}
                  {row.quoteReference === null ? '' : ` · ${row.quoteReference}`}
                </Text>
              </div>
            ),
          },
          {
            id: 'quantity',
            header: 'Quantity',
            cell: (row) => counted(row.quantity, 'unit'),
          },
          {
            id: 'unit',
            header: 'Unit price',
            hideBelowLg: true,
            cell: (row) => `${row.currency} ${row.unitPriceMajor}`,
          },
          {
            id: 'total',
            header: 'Total',
            cell: (row) => `${row.currency} ${row.totalPriceMajor}`,
          },
          {
            id: 'status',
            header: 'Status',
            cell: (row) => (
              <div className="flex flex-col items-start gap-1" data-tour="order-status">
                <StatusChip status={row.status} />
                {/*
                  A dispute is not always the order's status: one can be raised
                  and answered while production carries on, so the order chip
                  alone would not say a case exists. This does, and says which
                  half of its life it is in.
                */}
                {row.disputeId !== null && (
                  <Badge tone={row.disputeStatus === 'resolved' ? 'neutral' : 'danger'}>
                    {row.disputeStatus === 'resolved' ? 'Dispute closed' : 'Dispute open'}
                  </Badge>
                )}
                {row.openAlerts > 0 && <Tag tone="danger">Shortage</Tag>}
                {!row.fundingSecured && row.status === 'awaiting_payment' && (
                  <Text tone="muted" size="xs">
                    not funded
                  </Text>
                )}
              </div>
            ),
          },
          {
            id: 'stage',
            header: 'Current stage',
            cell: (row) => (
              <StageTrack
                total={row.totalStages}
                completed={row.completedStages}
                stageLabel={row.currentStageLabel}
                state={trackState(row)}
              />
            ),
          },
          {
            id: 'due',
            header: 'Due',
            cell: (row) => (
              <div>
                {/*
                  The date the quoted lead time lands on (UIUX-203). It was
                  already worked out for the "late" flag and then thrown away,
                  so the table could say an order was late but never that it was
                  about to be — which is the only point at which a shop can
                  still do something about it.
                */}
                <p
                  className={
                    row.late
                      ? 'whitespace-nowrap text-sm font-semibold text-text-error'
                      : row.dueInDays !== null && row.dueInDays <= 3
                        ? 'whitespace-nowrap text-sm font-semibold text-text-warning'
                        : 'whitespace-nowrap text-sm text-text-secondary'
                  }
                >
                  {row.dueOn ?? '—'}
                </p>
                <Text tone="muted" size="xs">
                  {row.late
                    ? 'past the date you quoted'
                    : row.dueInDays === null
                      ? `ordered ${row.orderedOn}`
                      : row.dueInDays <= 0
                        ? 'due today'
                        : `in ${counted(row.dueInDays, 'day')}`}
                </Text>
              </div>
            ),
          },
          {
            id: 'actions',
            header: <span className="sr-only">Actions</span>,
            align: 'right',
            cell: (row) => (
              <RowMenu
                label={`Actions for ${row.productName}`}
                items={[
                  // The open case first, because it is the only row action that
                  // is waiting on the shop rather than merely available to it.
                  ...(row.disputeId === null
                    ? []
                    : [
                        {
                          id: 'dispute',
                          label:
                            row.disputeStatus === 'resolved'
                              ? 'Read the closed dispute'
                              : 'Open dispute',
                          href: `/orders/${row.orderId}/disputes/${row.disputeId}`,
                        },
                      ]),
                  // Only on the rows carrying it (UIUX-203). A menu that offers
                  // "Answer the refund request" on every row teaches a shop
                  // that the menu does not know anything about the row.
                  //
                  // Approving a *cancellation* is deliberately not here: a shop
                  // raises one and IDEEZA decides it, so the shop has nothing
                  // to approve — the entry says where its own request stands.
                  ...(row.status === 'refund_requested'
                    ? [
                        {
                          id: 'refund',
                          label: 'Answer the refund request',
                          href: `/orders/${row.orderId}`,
                        },
                      ]
                    : []),
                  ...(row.status === 'cancel_requested'
                    ? [
                        {
                          id: 'cancellation',
                          label: 'The cancellation you raised',
                          href: `/orders/${row.orderId}`,
                        },
                      ]
                    : []),
                  ...(row.openAlerts > 0
                    ? [
                        {
                          id: 'shortage',
                          label: counted(row.openAlerts, 'part shortage'),
                          href: `/orders/${row.orderId}`,
                        },
                      ]
                    : []),
                  {
                    id: 'production',
                    label: 'View order details',
                    href: `/orders/${row.orderId}`,
                  },
                  {
                    id: 'quote',
                    label: 'The terms it was opened against',
                    href: `/orders/${row.orderId}/quote`,
                  },
                  {
                    id: 'files',
                    label: 'Production files',
                    href: `/orders/${row.orderId}/files`,
                  },
                  {
                    id: 'spec',
                    label: 'Production specification',
                    href: `/orders/${row.orderId}/specification`,
                  },
                ]}
                trigger={({ ref, onClick, ...aria }) => (
                  <button
                    ref={ref}
                    type="button"
                    onClick={onClick}
                    aria-label={`Actions for ${row.productName}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary hover:bg-bg-surface-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                    {...aria}
                  >
                    ⋮
                  </button>
                )}
              />
            ),
          },
        ]}
      />

      <Pagination page={page} pageCount={pageCount} onChange={goToPage} />
    </div>
  );
};
