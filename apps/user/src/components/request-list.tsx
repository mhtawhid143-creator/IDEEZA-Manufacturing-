import Link from 'next/link';
import { EmptyState, StatusChip, Text, buttonAppearance } from '@ideeza/ui';
import type { RequestSummary } from '@/data/requests.js';

const PACKAGE_LABEL: Readonly<Record<string, string>> = {
  pcb: 'PCB only',
  module_3d: '3D module',
  full_product: 'Full product',
};

const day = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);

export interface RequestListProps {
  readonly requests: readonly RequestSummary[];
}

/**
 * The Quote Requests tab: requests that are out with manufacturers.
 *
 * The counts are the honest state of the request: how many were asked, how many
 * have answered and how many declined. Declining is a normal answer.
 */
export const RequestList = ({ requests }: RequestListProps) => {
  if (requests.length === 0) {
    return (
      <EmptyState
        title="No requests sent yet"
        description="A request is sent from a draft: prepare the package and requirements, then choose the manufacturers."
        action={
          <Link href="/manufacturing" className={buttonAppearance({ variant: 'secondary' })}>
            Go to drafts
          </Link>
        }
      />
    );
  }

  return (
    <ul aria-label="Quote requests" className="flex flex-col gap-3">
      {requests.map((request) => (
        <li
          key={request.rfqId}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/manufacturing/rfq/${request.rfqId}`}
                className="text-sm font-semibold text-text-primary hover:text-text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
              >
                {request.productName}
              </Link>
              <StatusChip status={request.status} withDot />
            </div>
            <Text tone="muted" size="xs" className="mt-1">
              {PACKAGE_LABEL[request.kind] ?? request.kind} · {request.quantity} units ·
              sent {day(request.submittedAt)} · {request.recipientCount}{' '}
              {request.recipientCount === 1 ? 'manufacturer' : 'manufacturers'} ·{' '}
              {request.quotedCount} quoted · {request.declinedCount} declined
            </Text>
          </div>
          <Link
            href={`/manufacturing/rfq/${request.rfqId}`}
            className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
          >
            View request
          </Link>
        </li>
      ))}
    </ul>
  );
};
