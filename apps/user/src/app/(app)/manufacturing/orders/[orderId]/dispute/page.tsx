import { notFound, redirect } from 'next/navigation';
import { ORDER_ISSUE_REASONS, asId, type OrderId } from '@ideeza/domain';
import { IssuePage } from '@/components/order/issue-page.js';
import { getIssueContext } from '@/data/resolution.js';
import { requireBuyer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

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

/**
 * Opening a dispute.
 *
 * A dispute already in progress is the case itself, so this route sends the buyer
 * there rather than offering to open a second one: one contested order, one case.
 */
const DisputePage = async ({
  params,
}: {
  readonly params: Promise<{ readonly orderId: string }>;
}) => {
  const { orderId } = await params;
  const actor = await requireBuyer(`/manufacturing/orders/${orderId}/dispute`);
  const context = await getIssueContext(actor.userId, asId<OrderId>(orderId));
  if (context === null) notFound();

  if (context.openDispute !== null) {
    redirect(`/manufacturing/orders/${orderId}/dispute/${context.openDispute.id}`);
  }

  return (
    <IssuePage
      kind="dispute"
      title="Open a dispute"
      context={context}
      blockedReason={context.disputeBlockedReason}
      reasons={ORDER_ISSUE_REASONS.map((reason) => ({
        value: reason,
        label: REASON_LABEL[reason] ?? reason.replace(/_/g, ' '),
      }))}
      submitLabel="Open the dispute"
      withAmount
      withRecords
      {...(context.openRefund === null ? {} : { refundId: context.openRefund.id })}
      consequences={[
        'The money stays with IDEEZA until the case is decided — including the automatic release at the end of the review window.',
        'A case is opened that both sides add statements and records to.',
        'IDEEZA decides it on that record: no issue found, rework, a partial or full refund, a replacement shipment, or an independent inspection.',
        'The decision is recorded against the order, and it is what any payout is released against.',
      ]}
    />
  );
};

export default DisputePage;
