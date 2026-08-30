'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DataTable,
  EmptyState,
  Pagination,
  StatusChip,
  Text,
} from '@ideeza/ui';
import { RowMenu } from '@/components/row-menu.js';

export interface InboxRow {
  readonly rfqId: string;
  readonly productName: string;
  readonly description: string;
  readonly kindLabel: string;
  readonly quantity: number;
  readonly status: 'routed' | 'viewed' | 'quoted' | 'declined' | 'expired';
  readonly receivedOn: string;
  readonly respondBy: string | null;
  readonly buyerName: string;
  readonly fileCount: number;
  readonly bomLineCount: number;
}

export interface RequestTableProps {
  readonly rows: readonly InboxRow[];
  readonly page: number;
  readonly pageCount: number;
  readonly filtered: boolean;
}

/** The manufacturer's word for its routing state, not the buyer's. */
const LABEL: Readonly<Record<InboxRow['status'], string>> = {
  routed: 'New RFQ',
  viewed: 'Opened',
  quoted: 'Quote sent',
  declined: 'Declined',
  expired: 'Expired',
};

/**
 * The inbox table.
 *
 * The row menu carries only what this stage can actually do: open the request, or
 * decline it from inside it. Quoting is one screen away and belongs to the
 * quoting stage, so it is not offered here as a shortcut that would not work.
 */
export const RequestTable = ({ rows, page, pageCount, filtered }: RequestTableProps) => {
  const router = useRouter();
  const params = useSearchParams();

  const goToPage = (next: number): void => {
    const query = new URLSearchParams(params.toString());
    if (next <= 1) query.delete('page');
    else query.set('page', String(next));
    const text = query.toString();
    router.push(text === '' ? '/rfqs' : `/rfqs?${text}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        caption="Requests routed to your shop"
        rows={rows}
        rowKey={(row) => row.rfqId}
        emptyState={
          <EmptyState
            title={filtered ? 'Nothing matches those filters' : 'No requests yet'}
            description={
              filtered
                ? 'Clear the search or the filters to see the whole inbox.'
                : 'A request reaches you when a buyer picks your shop. What you publish on your profile decides which requests can.'
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
                  className="h-9 w-9 shrink-0 rounded-md bg-gradient-to-br from-bg-brand-subtle to-blue-100"
                />
                <div className="min-w-0">
                  <Link
                    href={`/rfqs/${row.rfqId}`}
                    className="block truncate text-sm font-semibold text-text-primary hover:text-text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                  >
                    {row.productName}
                  </Link>
                  <Text tone="muted" size="xs">
                    {row.buyerName}
                  </Text>
                </div>
              </div>
            ),
          },
          {
            id: 'description',
            header: 'Description',
            hideBelowLg: true,
            cell: (row) => (
              <div className="max-w-[260px]">
                <p className="truncate text-sm text-text-secondary">{row.description}</p>
                <Text tone="muted" size="xs">
                  {row.fileCount} {row.fileCount === 1 ? 'file' : 'files'} ·{' '}
                  {row.bomLineCount} BOM {row.bomLineCount === 1 ? 'line' : 'lines'}
                </Text>
              </div>
            ),
          },
          {
            id: 'kind',
            header: 'Manufacturing type',
            hideBelowLg: true,
            cell: (row) => row.kindLabel,
          },
          {
            id: 'quantity',
            header: 'Quantity',
            cell: (row) => `${row.quantity} Qty`,
          },
          {
            id: 'status',
            header: 'Status',
            cell: (row) => <StatusChip status={row.status} label={LABEL[row.status]} />,
          },
          {
            id: 'date',
            header: 'Date',
            cell: (row) => (
              <div>
                <p className="whitespace-nowrap text-sm text-text-secondary">{row.receivedOn}</p>
                {row.respondBy !== null && (
                  <Text tone="muted" size="xs">
                    reply by {row.respondBy}
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
                  { id: 'open', label: 'View details', href: `/rfqs/${row.rfqId}` },
                  {
                    id: 'files',
                    label: 'Production files',
                    href: `/rfqs/${row.rfqId}/files`,
                  },
                  {
                    id: 'spec',
                    label: 'Production specification',
                    href: `/rfqs/${row.rfqId}/specification`,
                  },
                  { id: 'bom', label: 'BOM / parts', href: `/rfqs/${row.rfqId}/bom` },
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
