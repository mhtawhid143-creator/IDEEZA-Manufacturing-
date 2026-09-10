'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  DataTable,
  EmptyState,
  FormField,
  Icon,
  Input,
  Pagination,
  SearchInput,
  StatusChip,
  Text,
} from '@ideeza/ui';
import {
  counted,
  QUOTE_REASON_LABEL,
  type QuoteLifecycle,
  type QuoteReason,
} from '@ideeza/domain';

/**
 * The pill's tone per state (UIUX-183).
 *
 * One pill per row, and the reason a row needs attention sits under it as a
 * caption rather than a second badge — two badges of equal weight make a reader
 * decide which is the status, which is the thing the pill is for.
 */
/** The same glyphs the request inbox uses, so one row reads like the other. */
const KIND_ICON: Readonly<Record<string, 'board' | 'cube' | 'layers' | 'file'>> = {
  PCB: 'board',
  '3D printing': 'cube',
  'PCB + 3D printing': 'layers',
};

const QUOTE_LIFECYCLE_STATUS: Readonly<Record<QuoteLifecycle, string>> = {
  quoted: 'submitted',
  accepted: 'accepted',
  declined: 'rejected',
  expired: 'expired',
  withdrawn: 'withdrawn',
};
import { RowMenu } from '@/components/row-menu.js';

export interface QuoteListRow {
  /** What kind of work it is, which is what the row's glyph draws. */
  readonly kindLabel: string;
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
  /** Which of the five it reads as, and why it needs attention (UIUX-177). */
  readonly lifecycle: QuoteLifecycle;
  readonly statusLabel: string;
  readonly reason: QuoteReason | null;
  readonly expired: boolean;
  readonly sentOn: string;
  readonly expiresOn: string;
  readonly pendingSuggestions: number;
  /** Lines this shop said it cannot cover, carried by the quote (UIUX-162). */
  readonly unfulfilledParts: number;
}


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
              placeholder="Search by product name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </FormField>
        </form>

        <div className="flex flex-wrap items-end gap-3">
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
                : 'A quote is written from a request in RFQs. Once it is sent it appears here with the buyer’s decision on it.'
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-subtle text-icon-secondary"
                >
                  <Icon name={KIND_ICON[row.kindLabel] ?? 'file'} size={18} />
                </span>
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
                    {/*
                      A partly fulfillable quote is still "Quoted"; what it is
                      short of rides alongside the status rather than becoming a
                      seventh one (UIUX-162), which is how the other quote
                      nuances are already carried.
                    */}
                    {row.unfulfilledParts > 0 &&
                      ` · ${counted(row.unfulfilledParts, 'part')} unfulfilled`}
                  </Text>
                </div>
              </div>
            ),
          },
          {
            id: 'quantity',
            header: 'Quantity',
            hideBelowLg: true,
            // The orders table calls the same number "400 units". One portal,
            // one word for a count of things.
            cell: (row) => (
              <span className="whitespace-nowrap">{counted(row.quantity, 'unit')}</span>
            ),
          },
          {
            id: 'lead',
            header: 'Lead time',
            hideBelowLg: true,
            cell: (row) => (
              <span className="whitespace-nowrap">{counted(row.leadTimeDays, 'day')}</span>
            ),
          },
          {
            id: 'unit',
            header: 'Unit price',
            hideBelowLg: true,
            cell: (row) => (
              <span className="whitespace-nowrap">
                {row.currency} {row.unitPriceMajor}
              </span>
            ),
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
              <div>
                {/*
                  One pill, always. A reason can only exist while a quote is
                  still quoted — every other state is terminal — so it is drawn
                  as a ring and a dot on that same pill rather than a second
                  badge of equal weight. Two badges make the eye decide which
                  one is the status, which is what the column is for.
                */}
                <StatusChip
                  status={QUOTE_LIFECYCLE_STATUS[row.lifecycle]}
                  label={row.statusLabel}
                  withDot={row.reason !== null}
                  className={
                    row.reason === null ? undefined : 'ring-2 ring-border-warning'
                  }
                />
                {row.reason !== null && (
                  <Text tone="muted" size="xs" className="mt-0.5 block">
                    {QUOTE_REASON_LABEL[row.reason]}
                  </Text>
                )}
              </div>
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
                    <Icon name="more" size={16} />
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
