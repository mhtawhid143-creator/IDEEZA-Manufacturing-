'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  DataTable,
  EmptyState,
  FormField,
  Input,
  Pagination,
  SearchInput,
  Select,
  StatusChip,
  Tag,
  Text,
} from '@ideeza/ui';
import { RowMenu } from '@/components/row-menu.js';

export interface OrderListRow {
  readonly orderId: string;
  readonly productName: string;
  readonly buyerName: string;
  readonly status: string;
  readonly quantity: number;
  readonly currency: string;
  readonly unitPriceMajor: string;
  readonly totalPriceMajor: string;
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
  { value: 'in_flight', label: 'Everything in flight' },
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
            header: 'Order',
            cell: (row) => (
              <div className="min-w-0">
                <Link
                  href={`/orders/${row.orderId}`}
                  className="block truncate text-sm font-semibold text-text-primary hover:text-text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                >
                  {row.productName}
                </Link>
                <Text tone="muted" size="xs">
                  {row.buyerName} · {row.orderId.slice(-8)}
                </Text>
              </div>
            ),
          },
          {
            id: 'quantity',
            header: 'Quantity',
            cell: (row) => `${row.quantity} units`,
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
              <div className="flex flex-col items-start gap-1">
                <StatusChip status={row.status} />
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
              <div className="min-w-[140px]">
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle"
                  role="img"
                  aria-label={`${row.completedStages} of ${row.totalStages} stages completed`}
                >
                  <div
                    className={row.late ? 'h-full bg-bg-error' : 'h-full bg-bg-success'}
                    style={{
                      width: `${Math.round(
                        (row.completedStages / Math.max(1, row.totalStages)) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <Text tone="muted" size="xs" className="mt-1 block">
                  {row.currentStageLabel ?? 'Finished'} · {row.completedStages}/
                  {row.totalStages}
                </Text>
              </div>
            ),
          },
          {
            id: 'date',
            header: 'Date',
            cell: (row) => (
              <div>
                <p className="whitespace-nowrap text-sm text-text-secondary">{row.orderedOn}</p>
                {row.late && (
                  <Text tone="danger" size="xs">
                    late
                  </Text>
                )}
              </div>
            ),
          },
          {
            id: 'actions',
            header: <span className="ids-sr-only">Actions</span>,
            align: 'right',
            cell: (row) => (
              <RowMenu
                label={`Actions for ${row.productName}`}
                items={[
                  {
                    id: 'production',
                    label: 'Production stages',
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
