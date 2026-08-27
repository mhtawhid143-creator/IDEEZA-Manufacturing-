import { notFound } from 'next/navigation';
import { CANCELLATION_REASONS, asId, type OrderId } from '@ideeza/domain';
import { IssuePage } from '@/components/order/issue-page.js';
import { getIssueContext } from '@/data/resolution.js';
import { requireBuyer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const REASON_LABEL: Readonly<Record<string, string>> = {
  no_longer_needed: 'No longer needed',
  design_change: 'The design changed',
  lead_time_too_long: 'The lead time is too long',
  cost_too_high: 'The cost is too high',
  ordered_by_mistake: 'Ordered by mistake',
  found_another_supplier: 'Found another supplier',
  funding_withdrawn: 'Funding withdrawn',
  other: 'Something else',
};

/**
 * Cancelling an order.
 *
 * Which act this is depends entirely on whether the platform is holding money:
 * before that the buyer withdraws their own order, after it the buyer asks and
 * IDEEZA decides. The screen says which one the buyer is about to do.
 */
const CancelPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly orderId: string }>;
}) => {
  const { orderId } = await params;
  const actor = await requireBuyer(`/manufacturing/orders/${orderId}/cancel`);
  const context = await getIssueContext(actor.userId, asId<OrderId>(orderId));
  if (context === null) notFound();

  const withdrawing = context.cancellationRoute === 'withdraw';

  return (
    <IssuePage
      kind="cancel"
      title={withdrawing ? 'Withdraw this order' : 'Order cancel request'}
      context={context}
      blockedReason={context.cancelBlockedReason}
      reasons={CANCELLATION_REASONS.map((reason) => ({
        value: reason,
        label: REASON_LABEL[reason] ?? reason.replace(/_/g, ' '),
      }))}
      submitLabel={withdrawing ? 'Withdraw the order' : 'Request cancellation'}
      withAmount={false}
      withRecords={false}
      consequences={
        withdrawing
          ? [
              'The order closes immediately, because nothing has been made.',
              'The accepted quote stays on the record, marked as not taken forward.',
              'The product is free to start a new request whenever you want.',
            ]
          : [
              `${context.manufacturerName} is told, and keeps working until IDEEZA decides.`,
              'The money stays held by IDEEZA while the request is decided.',
              'What has already been spent on materials and time is weighed in that decision.',
            ]
      }
    />
  );
};

export default CancelPage;
