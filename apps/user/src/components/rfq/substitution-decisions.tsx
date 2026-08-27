'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button, Card, StatusChip, Text, useToast } from '@ideeza/ui';
import { decideSubstitutionAction } from '@/app/(app)/manufacturing/rfq/actions.js';
import type { SubstitutionStatus } from '@ideeza/domain';

export interface SubstitutionRow {
  readonly id: string;
  readonly quoteId: string;
  readonly manufacturerName: string;
  readonly status: SubstitutionStatus;
  readonly requestedPartReference: string;
  readonly suggestedPartName: string;
  readonly technicalJustification: string;
  readonly currency: string;
  readonly priceImpactMajor: string;
  readonly leadTimeImpactDays: number;
  readonly decidedOn: string | null;
}

/**
 * The buyer's decision on each suggested replacement part.
 *
 * The requirements said what the substitution policy is; this is where the
 * policy is exercised, one part at a time, before any quote can be accepted.
 */
export const SubstitutionDecisions = ({
  substitutions,
}: {
  readonly substitutions: readonly SubstitutionRow[];
}) => {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();

  const decide = (row: SubstitutionRow, decision: 'approved' | 'rejected'): void => {
    startTransition(async () => {
      const result = await decideSubstitutionAction(row.id, decision);
      if (result.error !== undefined) {
        push({ title: 'That decision was not saved', body: result.error, tone: 'danger' });
        return;
      }
      push({
        title: decision === 'approved' ? 'Replacement approved' : 'Replacement rejected',
        body: `${row.requestedPartReference} → ${row.suggestedPartName}`,
        tone: decision === 'approved' ? 'success' : 'info',
      });
      router.refresh();
    });
  };

  return (
    <ul aria-label="Suggested replacement parts" className="flex flex-col gap-3">
      {substitutions.map((row) => (
        <li key={row.id}>
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-heading">
                  {row.requestedPartReference} → {row.suggestedPartName}
                </p>
                <Text tone="muted" size="xs" className="mt-0.5">
                  Suggested by {row.manufacturerName}
                  {row.decidedOn === null ? '' : ` · decided ${row.decidedOn}`}
                </Text>
              </div>
              <StatusChip status={row.status} withDot />
            </div>

            <Text size="sm">{row.technicalJustification}</Text>

            <div className="flex flex-wrap items-center gap-4 border-t border-line pt-3">
              <div>
                <Text tone="muted" size="xs">
                  Price impact
                </Text>
                <p className="text-sm font-semibold text-body">
                  {row.priceImpactMajor === '0.00'
                    ? 'None'
                    : `${row.currency} ${row.priceImpactMajor}`}
                </p>
              </div>
              <div>
                <Text tone="muted" size="xs">
                  Lead time impact
                </Text>
                <p className="text-sm font-semibold text-body">
                  {row.leadTimeImpactDays === 0 ? 'None' : `${row.leadTimeImpactDays} days`}
                </p>
              </div>
              {row.status === 'proposed' && (
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() => decide(row, 'rejected')}
                  >
                    Reject
                  </Button>
                  <Button size="sm" disabled={pending} onClick={() => decide(row, 'approved')}>
                    Approve
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
};
