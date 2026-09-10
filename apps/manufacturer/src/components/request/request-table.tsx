'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DataTable,
  EmptyState,
  Icon,
  Pagination,
  StatusChip,
  Text,
} from '@ideeza/ui';
import {
  counted,
  REQUEST_LIFECYCLE_LABEL,
  type RequestLifecycle,
} from '@ideeza/domain';
import { RowMenu } from '@/components/row-menu.js';

export interface InboxRow {
  readonly rfqId: string;
  readonly productName: string;
  readonly description: string;
  readonly kindLabel: string;
  readonly quantity: number;
  readonly status: 'routed' | 'viewed' | 'quoted' | 'declined' | 'expired';
  /** Which of the six the request is in (UIUX-127) — what the pill shows. */
  readonly lifecycle: RequestLifecycle;
  /** When this shop first opened it, or null if it has not. */
  readonly openedOn: string | null;
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

/**
 * The pill's tone per lifecycle value (UIUX-127).
 *
 * The words come from the domain, because the counts above the table are
 * derived from the same six and would otherwise be free to disagree. Only the
 * colour is decided here, which is this panel's business.
 *
 * "Opened" is no longer one of them: whether a shop has looked at a request is a
 * fact about the clock, so it moved to the date column beside when it arrived.
 * Six statuses that partition the inbox are worth more than a seventh word that
 * hides which of them a row is really in.
 */
const LIFECYCLE_STATUS: Readonly<Record<RequestLifecycle, string>> = {
  new: 'routed',
  quoted: 'quoted',
  accepted: 'accepted',
  declined: 'declined',
  expired: 'expired',
  withdrawn: 'withdrawn',
};

/**
 * A mark for the kind of work, rather than a picture of a board (UIUX-174).
 *
 * The reported defect was a PCB photograph on every row, including rows whose
 * work was printing. A glyph for the actual kind cannot contradict the row it
 * sits on, and it is read by anyone who cannot tell two thumbnails apart.
 */
const KIND_ICON: Readonly<Record<string, 'board' | 'cube' | 'layers'>> = {
  PCB: 'board',
  '3D printing': 'cube',
  'PCB + 3D printing': 'layers',
};

/**
 * What this stage can actually do to a request, which depends on where it is.
 *
 * A closed request cannot be quoted and an answered one cannot be answered
 * twice, so one static action set (UIUX-129) offers moves that would fail. The
 * reading tabs are always there; only the acts change.
 */
const actionsFor = (row: InboxRow): readonly { id: string; label: string; href: string }[] => {
  const reading = [
    { id: 'open', label: 'View details', href: `/rfqs/${row.rfqId}` },
    { id: 'files', label: 'Production files', href: `/rfqs/${row.rfqId}/files` },
    {
      id: 'spec',
      label: 'Production specification',
      href: `/rfqs/${row.rfqId}/specification`,
    },
    { id: 'bom', label: 'BOM / parts', href: `/rfqs/${row.rfqId}/bom` },
  ];

  if (row.status === 'routed' || row.status === 'viewed') {
    // Unanswered: the act is to answer it. Both live on the request itself,
    // because quoting needs the specification and the bill of materials open.
    return [
      { id: 'quote', label: 'Submit quote', href: `/rfqs/${row.rfqId}` },
      ...reading,
    ];
  }
  if (row.status === 'quoted') {
    return [{ id: 'sent', label: 'The quote you sent', href: '/quotes' }, ...reading];
  }
  // Declined or expired: nothing can be done to it, and the record stays
  // readable rather than offering an act that would be refused.
  return reading;
};

/**
 * The inbox table.
 *
 * The row menu carries only what can actually be done to *that* request, which
 * depends on where it has got to — see `actionsFor`. Declining still happens on
 * the request itself, because a reason is required and this row has nowhere to
 * ask for one.
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-subtle text-icon-secondary"
                >
                  <Icon name={KIND_ICON[row.kindLabel] ?? 'file'} size={18} />
                </span>
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
                  {/*
                    Below lg the quantity and the kind of work have no column of
                    their own, and both are things a shop weighs before opening
                    the request — so they ride with the name rather than sitting
                    off the right edge of a phone.
                  */}
                  <Text tone="muted" size="xs" className="mt-0.5 block lg:hidden">
                    <span className="whitespace-nowrap">
                      {counted(row.quantity, 'unit')}
                    </span>
                    {' · '}
                    <span className="whitespace-nowrap">{row.kindLabel}</span>
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
                  {counted(row.fileCount, 'file')} ·{' '}
                  {counted(row.bomLineCount, 'BOM line')}
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
            hideBelowLg: true,
            header: 'Quantity',
            // UIUX-131: the header already says Quantity; repeating the unit in
            // every cell adds a word and no information.
            cell: (row) => String(row.quantity),
          },
          {
            id: 'status',
            header: 'Status',
            cell: (row) => (
              <StatusChip
                status={LIFECYCLE_STATUS[row.lifecycle]}
                label={REQUEST_LIFECYCLE_LABEL[row.lifecycle]}
              />
            ),
          },
          {
            id: 'date',
            hideBelowLg: true,
            header: 'Date',
            cell: (row) => (
              <div>
                <p className="whitespace-nowrap text-sm text-text-secondary">{row.receivedOn}</p>
                {row.openedOn !== null && (
                  <Text tone="muted" size="xs">
                    Opened {row.openedOn}
                  </Text>
                )}
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
            header: <span className="sr-only">Actions</span>,
            align: 'right',
            cell: (row) => (
              <RowMenu
                label={`Actions for ${row.productName}`}
                items={actionsFor(row)}
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
