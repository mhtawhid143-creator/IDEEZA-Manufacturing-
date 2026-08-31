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
  Text,
} from '@ideeza/ui';
import { RowMenu } from '@/components/row-menu.js';

export interface QuoteListRow {
  readonly quoteId: string;
  readonly rfqId: string;
  readonly productName: string;
  readonly buyerName: string;
  readonly quantity: number;
  readonly leadTimeDays: number;
  readonly unitPriceMajor: string;
  readonly landedTotalMajor: string;
  readonly currency: string;
  readonly status: string;
  readonly statusLabel: string;
  readonly expired: boolean;
  readonly sentOn: string;
  readonly expiresOn: string;
  readonly pendingSuggestions: number;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Any status' },
  { value: 'submitted', label: 'With the buyer' },
  { value: 'revised', label: 'Revised' },
  { value: 'revision_requested', label: 'Revision asked for' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Not chosen' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'expired', label: 'Expired' },
];

/**
 * The quotes this shop has sent, and the two filters the design gives: a status
 * and a date range.
 *
 * The filters live in the address bar so a shop can keep "everything still with
 * the buyer" bookmarked, and changing one always returns to page one.
 */
export const QuoteList = ({
  rows,
  page,
  pageCount,
  filtered,
}: {
  readonly rows: readonly QuoteListRow[];
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
    router.push(query === '' ? '/quotes' : `/quotes?${query}`);
  };

  const goToPage = (next: number): void => {
    const query = new URLSearchParams(params.toString());
    if (next <= 1) query.delete('page');
    else query.set('page', String(next));
    const text = query.toString();
    router.push(text === '' ? '/quotes' : `/quotes?${text}`);
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
              placeholder="Search by Quote Name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </FormField>
        </form>

        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Status" labelHidden className="min-w-[170px]">
            <Select
              options={STATUS_OPTIONS}
              value={params.get('status') ?? 'all'}
              onChange={(event) => apply({ status: event.target.value })}
            />
          </FormField>
          <FormField label="Sent from" className="min-w-[150px]">
            <Input
              type="date"
              value={params.get('from') ?? ''}
              onChange={(event) => apply({ from: event.target.value })}
            />
          </FormField>
          <FormField label="Sent until" className="min-w-[150px]">
            <Input
              type="date"
              value={params.get('to') ?? ''}
              onChange={(event) => apply({ to: event.target.value })}
            />
          </FormField>
        </div>
      </div>

      <DataTable
        caption="Quotes your shop has sent"
        rows={rows}
        rowKey={(row) => row.quoteId}
        emptyState={
          <EmptyState
            title={filtered ? 'Nothing matches those filters' : 'No quotes sent yet'}
            description={
              filtered
                ? 'Clear the search, the status or the dates to see everything.'
                : 'A quote is written from a request in Request Quote. Once it is sent it appears here with the buyer’s decision on it.'
            }
          />
        }
        columns={[
          {
            id: 'name',
            header: 'Name',
            cell: (row) => (
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="h-9 w-9 shrink-0 rounded-md bg-gradient-to-br from-bg-brand-subtle to-bg-info-subtle"
                />
                <div className="min-w-0">
                  <Link
                    href={`/quotes/${row.quoteId}`}
                    className="block truncate text-sm font-semibold text-text-primary hover:text-text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                  >
                    {row.productName}
                  </Link>
                  <Text tone="muted" size="xs">
                    {row.buyerName}
                    {row.pendingSuggestions === 0
                      ? ''
                      : ` · ${row.pendingSuggestions} substitute${
                          row.pendingSuggestions === 1 ? '' : 's'
                        } undecided`}
                  </Text>
                </div>
              </div>
            ),
          },
          {
            id: 'quantity',
            header: 'Quantity',
            cell: (row) => `${row.quantity} Qty`,
          },
          {
            id: 'lead',
            header: 'Lead time',
            hideBelowLg: true,
            cell: (row) => `${row.leadTimeDays} Days`,
          },
          {
            id: 'unit',
            header: 'Unit price',
            cell: (row) => `${row.currency} ${row.unitPriceMajor}`,
          },
          {
            id: 'total',
            header: 'Total',
            hideBelowLg: true,
            cell: (row) => `${row.currency} ${row.landedTotalMajor}`,
          },
          {
            id: 'status',
            header: 'Status',
            cell: (row) => (
              <StatusChip
                status={row.expired && row.status === 'submitted' ? 'expired' : row.status}
                label={row.statusLabel}
              />
            ),
          },
          {
            id: 'date',
            header: 'Date',
            cell: (row) => (
              <div>
                <p className="whitespace-nowrap text-sm text-text-secondary">{row.sentOn}</p>
                <Text tone="muted" size="xs">
                  valid to {row.expiresOn}
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
                  { id: 'open', label: 'Quote details', href: `/quotes/${row.quoteId}` },
                  {
                    id: 'rfq',
                    label: 'The request it answers',
                    href: `/quotes/${row.quoteId}/rfq`,
                  },
                  {
                    id: 'subs',
                    label: 'Substitutes',
                    href: `/quotes/${row.quoteId}/substitutions`,
                  },
                  {
                    id: 'activity',
                    label: 'Activity',
                    href: `/quotes/${row.quoteId}/activity`,
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
