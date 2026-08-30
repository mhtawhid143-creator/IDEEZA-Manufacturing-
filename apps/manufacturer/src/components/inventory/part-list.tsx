'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  DataTable,
  EmptyState,
  FormField,
  Pagination,
  SearchInput,
  Select,
  Tag,
  Text,
} from '@ideeza/ui';
import { RowMenu } from '@/components/row-menu.js';

export interface PartListRow {
  readonly id: string;
  readonly partName: string;
  readonly sku: string;
  readonly category: string;
  readonly available: number;
  readonly stockQuantity: number;
  readonly reservedQuantity: number;
  readonly unitPriceMajor: string;
  readonly currency: string;
  readonly level: 'in_stock' | 'low_stock' | 'out_of_stock';
  readonly enabledForMatching: boolean;
  readonly updatedOn: string;
}

const LEVEL_WORDS: Readonly<Record<PartListRow['level'], string>> = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
};

const LEVEL_TONE: Readonly<
  Record<PartListRow['level'], 'success' | 'warning' | 'danger'>
> = {
  in_stock: 'success',
  low_stock: 'warning',
  out_of_stock: 'danger',
};

/**
 * The parts table, with the three filters the design gives.
 *
 * Availability is the column that matters, and it is stock minus what is already
 * promised to an order — so a shelf full of reserved parts reads as out of stock,
 * which is the truth for anything the shop is about to quote.
 */
export const PartList = ({
  rows,
  categories,
  page,
  pageCount,
  filtered,
}: {
  readonly rows: readonly PartListRow[];
  readonly categories: readonly string[];
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
    router.push(query === '' ? '/inventory' : `/inventory?${query}`);
  };

  const goToPage = (next: number): void => {
    const query = new URLSearchParams(params.toString());
    if (next <= 1) query.delete('page');
    else query.set('page', String(next));
    const text = query.toString();
    router.push(text === '' ? '/inventory' : `/inventory?${text}`);
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
          <FormField label="Search by part name or SKU" labelHidden>
            <SearchInput
              name="q"
              placeholder="Search by part name or SKU"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </FormField>
        </form>

        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Category" labelHidden className="min-w-[170px]">
            <Select
              options={[
                { value: 'all', label: 'All categories' },
                ...categories.map((category) => ({ value: category, label: category })),
              ]}
              value={params.get('category') ?? 'all'}
              onChange={(event) => apply({ category: event.target.value })}
            />
          </FormField>
          <FormField label="Stock level" labelHidden className="min-w-[150px]">
            <Select
              options={[
                { value: 'all', label: 'Any level' },
                { value: 'in_stock', label: 'In stock' },
                { value: 'low_stock', label: 'Low stock' },
                { value: 'out_of_stock', label: 'Out of stock' },
              ]}
              value={params.get('level') ?? 'all'}
              onChange={(event) => apply({ level: event.target.value })}
            />
          </FormField>
          <FormField label="Matching" labelHidden className="min-w-[150px]">
            <Select
              options={[
                { value: 'all', label: 'All parts' },
                { value: 'enabled', label: 'Matched to requests' },
                { value: 'disabled', label: 'Not matched' },
              ]}
              value={params.get('matching') ?? 'all'}
              onChange={(event) => apply({ matching: event.target.value })}
            />
          </FormField>
        </div>
      </div>

      <DataTable
        caption="Parts in your inventory"
        rows={rows}
        rowKey={(row) => row.id}
        emptyState={
          <EmptyState
            title={filtered ? 'Nothing matches those filters' : 'No parts yet'}
            description={
              filtered
                ? 'Clear the search or the filters to see the whole inventory.'
                : 'Add the parts you hold. A buyer’s bill of materials is matched against them line by line, and what you hold decides which requests you can answer.'
            }
          />
        }
        columns={[
          {
            id: 'part',
            header: 'Part name',
            cell: (row) => (
              <div className="min-w-0">
                <Link
                  href={`/inventory/${row.id}`}
                  className="block truncate text-sm font-semibold text-text-primary hover:text-text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                >
                  {row.partName}
                </Link>
                {!row.enabledForMatching && (
                  <Text tone="muted" size="xs">
                    not matched to requests
                  </Text>
                )}
              </div>
            ),
          },
          { id: 'sku', header: 'SKU', cell: (row) => row.sku },
          {
            id: 'category',
            header: 'Category',
            hideBelowLg: true,
            cell: (row) => row.category,
          },
          {
            id: 'available',
            header: 'Availability',
            cell: (row) => `${row.available} pcs`,
          },
          {
            id: 'reserved',
            header: 'Reserved',
            cell: (row) => (
              <div>
                <p className="text-sm text-text-secondary">{row.reservedQuantity} pcs</p>
                <Text tone="muted" size="xs">
                  of {row.stockQuantity} on the shelf
                </Text>
              </div>
            ),
          },
          {
            id: 'price',
            header: 'Price per unit',
            cell: (row) => `${row.currency} ${row.unitPriceMajor}`,
          },
          {
            id: 'level',
            header: 'Status',
            cell: (row) => <Tag tone={LEVEL_TONE[row.level]}>{LEVEL_WORDS[row.level]}</Tag>,
          },
          {
            id: 'updated',
            header: 'Updated',
            hideBelowLg: true,
            cell: (row) => row.updatedOn,
          },
          {
            id: 'actions',
            header: <span className="sr-only">Actions</span>,
            align: 'right',
            cell: (row) => (
              <RowMenu
                label={`Actions for ${row.partName}`}
                items={[
                  {
                    id: 'view',
                    label: 'View details and history',
                    href: `/inventory/${row.id}`,
                  },
                ]}
                trigger={({ ref, onClick, ...aria }) => (
                  <button
                    ref={ref}
                    type="button"
                    onClick={onClick}
                    aria-label={`Actions for ${row.partName}`}
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
