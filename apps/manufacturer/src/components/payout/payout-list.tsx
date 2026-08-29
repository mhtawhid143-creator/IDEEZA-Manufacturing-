'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  FormField,
  Input,
  Modal,
  Pagination,
  SearchInput,
  Select,
  StatusChip,
  Text,
} from '@ideeza/ui';
import { RowMenu } from '@/components/row-menu.js';

export interface PayoutListRow {
  readonly id: string;
  readonly orderId: string;
  readonly productName: string;
  readonly buyerName: string;
  readonly status: string;
  readonly currency: string;
  readonly orderAmountMajor: string;
  readonly platformFeeMajor: string;
  readonly netAmountMajor: string;
  readonly dateOn: string;
  readonly releaseTrigger: string | null;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Any status' },
  { value: 'pending_release', label: 'Held' },
  { value: 'released', label: 'Released' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'disputed', label: 'Disputed' },
];

const TRIGGER_LABEL: Readonly<Record<string, string>> = {
  order_delivery_confirmed: 'the buyer confirmed delivery',
  order_review_window_expired: 'the review window closed',
  dispute_resolved: 'a resolved case',
  partial_refund_agreed: 'an agreed partial refund',
};

/**
 * The money, and what moves it.
 *
 * Every released payout names the event it was released against, because that is
 * the platform's promise: nothing moves on somebody's say-so. Withdrawal is not
 * wired to a bank in this build, and the screen says so rather than offering a
 * button that would do nothing.
 */
export const PayoutList = ({
  rows,
  page,
  pageCount,
  filtered,
  availableMajor,
  currency,
}: {
  readonly rows: readonly PayoutListRow[];
  readonly page: number;
  readonly pageCount: number;
  readonly filtered: boolean;
  readonly availableMajor: string;
  readonly currency: string;
}) => {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [withdrawing, setWithdrawing] = useState(false);
  const [history, setHistory] = useState(false);

  useEffect(() => setSearch(params.get('q') ?? ''), [params]);

  const apply = (changes: Readonly<Record<string, string>>): void => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === '' || value === 'all') next.delete(key);
      else next.set(key, value);
    }
    next.delete('page');
    const query = next.toString();
    router.push(query === '' ? '/payouts' : `/payouts?${query}`);
  };

  const goToPage = (next: number): void => {
    const query = new URLSearchParams(params.toString());
    if (next <= 1) query.delete('page');
    else query.set('page', String(next));
    const text = query.toString();
    router.push(text === '' ? '/payouts' : `/payouts?${text}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 md:p-6">
        <div>
          <p className="text-2xl font-bold text-brand">
            {currency} {availableMajor}
          </p>
          <Text tone="muted" size="sm">
            Released and not yet withdrawn
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setHistory(true)}>
            Withdrawal history
          </Button>
          <Button variant="primary" onClick={() => setWithdrawing(true)}>
            Withdraw balance
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form
          className="min-w-[240px] flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            apply({ q: search });
          }}
        >
          <FormField label="Search by order or payout" labelHidden>
            <SearchInput
              name="q"
              placeholder="Search by order ID or payout ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </FormField>
        </form>

        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Status" labelHidden className="min-w-[160px]">
            <Select
              options={STATUS_OPTIONS}
              value={params.get('status') ?? 'all'}
              onChange={(event) => apply({ status: event.target.value })}
            />
          </FormField>
          <FormField label="From" className="min-w-[150px]">
            <Input
              type="date"
              value={params.get('from') ?? ''}
              onChange={(event) => apply({ from: event.target.value })}
            />
          </FormField>
          <FormField label="Until" className="min-w-[150px]">
            <Input
              type="date"
              value={params.get('to') ?? ''}
              onChange={(event) => apply({ to: event.target.value })}
            />
          </FormField>
        </div>
      </div>

      <DataTable
        caption="Payouts on your orders"
        rows={rows}
        rowKey={(row) => row.id}
        emptyState={
          <EmptyState
            title={filtered ? 'Nothing matches those filters' : 'No payouts yet'}
            description={
              filtered
                ? 'Clear the search, the status or the dates.'
                : 'A payout is created when an order is funded, and released against a documented event.'
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
                  className="block truncate text-sm font-semibold text-heading hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                >
                  {row.productName}
                </Link>
                <Text tone="muted" size="xs">
                  {row.orderId.slice(-8)}
                </Text>
              </div>
            ),
          },
          {
            id: 'payout',
            header: 'Payout',
            hideBelowLg: true,
            cell: (row) => row.id.slice(-8).toUpperCase(),
          },
          { id: 'client', header: 'Client', cell: (row) => row.buyerName },
          {
            id: 'amount',
            header: 'Order amount',
            align: 'right',
            cell: (row) => `${row.currency} ${row.orderAmountMajor}`,
          },
          {
            id: 'fee',
            header: 'Platform fee',
            align: 'right',
            hideBelowLg: true,
            cell: (row) => `${row.currency} ${row.platformFeeMajor}`,
          },
          {
            id: 'net',
            header: 'You get',
            align: 'right',
            cell: (row) => (
              <span className="font-semibold text-heading">
                {row.currency} {row.netAmountMajor}
              </span>
            ),
          },
          {
            id: 'status',
            header: 'Status',
            cell: (row) => (
              <div className="flex flex-col items-start gap-1">
                <StatusChip status={row.status} />
                {row.releaseTrigger !== null && (
                  <Text tone="muted" size="xs">
                    against {TRIGGER_LABEL[row.releaseTrigger] ?? row.releaseTrigger}
                  </Text>
                )}
              </div>
            ),
          },
          { id: 'date', header: 'Date', cell: (row) => row.dateOn },
          {
            id: 'actions',
            header: <span className="ids-sr-only">Actions</span>,
            align: 'right',
            cell: (row) => (
              <RowMenu
                label={`Actions for payout ${row.id.slice(-8)}`}
                items={[
                  { id: 'order', label: 'Open the order', href: `/orders/${row.orderId}` },
                ]}
                trigger={({ ref, onClick, ...aria }) => (
                  <button
                    ref={ref}
                    type="button"
                    onClick={onClick}
                    aria-label={`Actions for payout ${row.id.slice(-8)}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
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

      <Modal
        open={withdrawing}
        onClose={() => setWithdrawing(false)}
        title="Withdraw balance"
        description={`${currency} ${availableMajor} is released and waiting.`}
        size="sm"
        footer={
          <Button variant="secondary" onClick={() => setWithdrawing(false)}>
            Close
          </Button>
        }
      >
        <Alert tone="info" title="No bank rail in this build">
          The platform records what it owes you and what released it; moving money to a
          bank account needs a payment provider, which is not connected here. Nothing on
          this screen will pretend to have sent it.
        </Alert>
      </Modal>

      <Modal
        open={history}
        onClose={() => setHistory(false)}
        title="Withdrawal history"
        size="sm"
        footer={
          <Button variant="secondary" onClick={() => setHistory(false)}>
            Close
          </Button>
        }
      >
        <Text>
          Every release is in the table behind this, with the event it was released
          against. Withdrawals to a bank account will appear here once a provider is
          connected.
        </Text>
      </Modal>
    </div>
  );
};
