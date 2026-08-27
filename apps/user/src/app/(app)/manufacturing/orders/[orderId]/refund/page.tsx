import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ORDER_ISSUE_REASONS, asId, type OrderId } from '@ideeza/domain';
import { Card, CardHeader, StatusChip, Text, buttonAppearance } from '@ideeza/ui';
import { IssuePage } from '@/components/order/issue-page.js';
import { day, major } from '@/components/rfq/quote-money.js';
import { getIssueContext } from '@/data/resolution.js';
import { requireBuyer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

/**
 * The reasons a manufacturing order goes wrong.
 *
 * The design's list is the one a freelancing marketplace uses — scope creep,
 * contractual disputes, insufficient information. None of those describe a batch
 * of boards, so the approved manufacturing list is used and grouped by what a
 * buyer is actually looking at when they raise a claim.
 */
const REASON_LABEL: Readonly<Record<string, string>> = {
  failed_quality_check: 'Failed our quality check',
  defective_units: 'Defective units',
  wrong_specification: 'Built to the wrong specification',
  wrong_quantity: 'Wrong quantity delivered',
  unapproved_substitution: 'A part was substituted without approval',
  late_delivery: 'Delivered late',
  damaged_in_transit: 'Damaged in transit',
  not_delivered: 'Never delivered',
  missing_documentation: 'Missing documentation',
};

const RefundPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly orderId: string }>;
}) => {
  const { orderId } = await params;
  const actor = await requireBuyer(`/manufacturing/orders/${orderId}/refund`);
  const context = await getIssueContext(actor.userId, asId<OrderId>(orderId));
  if (context === null) notFound();

  return (
    <IssuePage
      kind="refund"
      title="Request refund"
      context={context}
      blockedReason={context.refundBlockedReason}
      reasons={ORDER_ISSUE_REASONS.map((reason) => ({
        value: reason,
        label: REASON_LABEL[reason] ?? reason.replace(/_/g, ' '),
      }))}
      submitLabel="Request refund"
      withAmount
      withRecords
      consequences={[
        'The payout stops: nothing reaches the manufacturer while this is open.',
        `${context.manufacturerName} is asked to answer it, and may accept or challenge it.`,
        'IDEEZA decides on the record — the accepted terms, the evidence, and both statements.',
        'If it is refused and you disagree, the next instrument is a dispute.',
      ]}
      aside={
        context.openRefund !== null ? (
          <Card>
            <CardHeader
              title="The claim already on this order"
              description="One claim is decided at a time."
            />
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={context.openRefund.status} withDot />
                <Text tone="muted" size="xs">
                  {REASON_LABEL[context.openRefund.reason] ?? context.openRefund.reason} ·{' '}
                  {context.currency} {major(BigInt(context.openRefund.requestedMinor))} ·{' '}
                  {day(context.openRefund.createdAt)}
                </Text>
              </div>
              <Text size="sm">“{context.openRefund.description}”</Text>
              <div>
                <Link
                  href={`/manufacturing/orders/${orderId}/dispute`}
                  className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
                >
                  Escalate to a dispute
                </Link>
              </div>
            </div>
          </Card>
        ) : undefined
      }
    />
  );
};

export default RefundPage;
