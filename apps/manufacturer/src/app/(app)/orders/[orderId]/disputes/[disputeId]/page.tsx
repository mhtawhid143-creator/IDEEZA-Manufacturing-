import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Alert,
  Card,
  CardHeader,
  DefinitionList,
  EmptyState,
  StatusChip,
  Text,
  buttonAppearance,
  majorAmount as major,
} from '@ideeza/ui';
import {
  asId,
  caseReference,
  claimReference,
  disputeOutcomeLabel,
  disputeStatusLabel,
  issueReasonLabel,
  statementAuthorLabel,
  type OrderId,
} from '@ideeza/domain';
import { Crumbs } from '@/components/crumbs.js';
import { DisputeStatement } from '@/components/order/dispute-statement.js';
import { getOrder } from '@/data/orders.js';
import { attachableRecords, getDisputeCase } from '@/data/resolution.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const when = (value: Date): string =>
  `${value.toISOString().slice(0, 10)} at ${value.toISOString().slice(11, 16)} UTC`;


/**
 * One dispute, as both sides read it.
 *
 * The statements are the case: each one is a record with an author and a
 * timestamp, and neither side can edit or remove what it said. The outcome is
 * operations' to write, and until they do the screen says so rather than implying
 * the shop can settle it.
 */
const DisputeCasePage = async ({
  params,
}: {
  readonly params: Promise<{ readonly orderId: string; readonly disputeId: string }>;
}) => {
  const { orderId, disputeId } = await params;
  const actor = await requireManufacturer(`/orders/${orderId}/dispute`);

  const [order, dispute, attachable] = await Promise.all([
    getOrder(actor.manufacturerId, asId<OrderId>(orderId)),
    getDisputeCase(actor.manufacturerId, disputeId),
    attachableRecords(actor.manufacturerId, asId<OrderId>(orderId)),
  ]);
  if (order === null || dispute === null || dispute.orderId !== orderId) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Crumbs
        items={[
          { label: 'My Orders', href: '/orders' },
          { label: order.productName, href: `/orders/${orderId}` },
          { label: 'Dispute details' },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-text-primary">
            Dispute {caseReference(dispute.id)}
          </h1>
          <Text tone="muted" size="sm">
            {order.productName} · opened {when(dispute.createdAt)}
          </Text>
        </div>
        <StatusChip
          status={dispute.status}
          label={disputeStatusLabel(dispute.status)}
          withDot
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          {dispute.statements.length === 0 ? (
            <Card>
              <EmptyState
                title="No statements yet"
                description="Whatever either side says about this case appears here, with who said it and when."
              />
            </Card>
          ) : (
            dispute.statements.map((statement) => (
              <Card key={statement.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-bg-brand-subtle to-bg-info-subtle"
                    />
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {statement.author}
                      </p>
                      <Text tone="muted" size="xs">
                        {statementAuthorLabel(statement.authorRole, 'manufacturer')} ·{' '}
                        {when(statement.at)}
                      </Text>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm font-semibold text-text-primary">
                  {statement.title}
                </p>
                <Text size="sm" className="mt-2 block whitespace-pre-line">
                  {statement.body}
                </Text>
              </Card>
            ))
          )}

          {dispute.status !== 'resolved' && (
            <DisputeStatement
              orderId={orderId}
              disputeId={dispute.id}
              attachable={attachable}
            />
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="The case" />
            <DefinitionList
              className="mt-4"
              items={[
                { label: 'Client', value: dispute.buyerName },
                { label: 'Case', value: caseReference(dispute.id) },
                { label: 'Opened', value: when(dispute.createdAt) },
                { label: 'Reason', value: issueReasonLabel(dispute.reason) },
                {
                  label: 'Amount in question',
                  value: `${dispute.currency} ${major(dispute.claimedAmountMinor)}`,
                },
                ...(dispute.refundId === null
                  ? []
                  : [{ label: 'From claim', value: claimReference(dispute.refundId) }]),
                {
                  label: 'Opened by',
                  value: dispute.openedByShop ? 'You' : 'The buyer',
                },
                {
                  label: 'Outcome',
                  value: `${disputeOutcomeLabel(dispute.outcome)}${
                    dispute.outcomeAmountMinor === null
                      ? ''
                      : ` · ${dispute.currency} ${major(dispute.outcomeAmountMinor)}`
                  }`,
                },
              ]}
            />
          </Card>

          <Card padded={false}>
            <div className="px-4 py-4 md:px-6">
              <CardHeader
                title="Records on the case"
                description="Everything the order already holds travels with it."
              />
            </div>
            {dispute.records.length === 0 ? (
              <div className="px-4 pb-6 md:px-6">
                <Text tone="muted" size="sm">
                  No records attached yet. Anything you attach to a production stage
                  becomes part of this case.
                </Text>
              </div>
            ) : (
              <ul aria-label="Records on the case" className="border-t border-border-subtle">
                {dispute.records.map((record) => (
                  <li
                    key={record.id}
                    className="border-b border-border-subtle px-4 py-3 last:border-b-0 md:px-6"
                  >
                    <p className="text-sm text-text-secondary">{record.title}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Alert tone="info" title="Neither side decides this">
            IDEEZA operations weighs both accounts and records the outcome, and the
            payout follows it. That is why what you write here matters more than what
            you would say in a message.
          </Alert>

          <Link
            href={`/orders/${orderId}`}
            className={buttonAppearance({ variant: 'secondary' })}
          >
            Back to the order
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DisputeCasePage;
