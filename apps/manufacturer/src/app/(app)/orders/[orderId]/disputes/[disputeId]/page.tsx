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
} from '@ideeza/ui';
import { asId, type OrderId } from '@ideeza/domain';
import { Crumbs } from '@/components/crumbs.js';
import { DisputeStatement } from '@/components/order/dispute-statement.js';
import { getOrder } from '@/data/orders.js';
import { getDisputeCase } from '@/data/resolution.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const when = (value: Date): string =>
  `${value.toISOString().slice(0, 10)} at ${value.toISOString().slice(11, 16)} UTC`;

const major = (minor: number): string => (minor / 100).toFixed(2);

const STATUS_LABEL: Readonly<Record<string, string>> = {
  open: 'Open',
  responded: 'Answered',
  under_review: 'With IDEEZA',
  resolved: 'Decided',
  escalated: 'Escalated',
};

const ROLE_LABEL: Readonly<Record<string, string>> = {
  manufacturer: 'You',
  buyer: 'The buyer',
  ops_admin: 'IDEEZA operations',
};

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

  const [order, dispute] = await Promise.all([
    getOrder(actor.manufacturerId, asId<OrderId>(orderId)),
    getDisputeCase(actor.manufacturerId, disputeId),
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-heading">
            Dispute case {dispute.id.slice(-8).toUpperCase()}
          </h1>
          <Text tone="muted" size="sm">
            {order.productName} · opened {when(dispute.createdAt)}
          </Text>
        </div>
        <StatusChip
          status={dispute.status}
          label={STATUS_LABEL[dispute.status] ?? dispute.status}
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
                      className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-brand-weak to-info-weak"
                    />
                    <div>
                      <p className="text-sm font-semibold text-heading">
                        {statement.author}
                      </p>
                      <Text tone="muted" size="xs">
                        {ROLE_LABEL[statement.authorRole] ?? statement.authorRole} ·{' '}
                        {when(statement.at)}
                      </Text>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm font-semibold text-heading">
                  {statement.title}
                </p>
                <Text size="sm" className="mt-2 block whitespace-pre-line">
                  {statement.body}
                </Text>
              </Card>
            ))
          )}

          {dispute.status !== 'resolved' && (
            <DisputeStatement orderId={orderId} disputeId={dispute.id} />
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="The case" />
            <DefinitionList
              className="mt-4"
              items={[
                { label: 'Client', value: dispute.buyerName },
                { label: 'Case', value: dispute.id.slice(-8).toUpperCase() },
                { label: 'Opened', value: when(dispute.createdAt) },
                { label: 'Reason', value: dispute.reason.replace(/_/g, ' ') },
                {
                  label: 'Amount in question',
                  value: `${dispute.currency} ${major(dispute.claimedAmountMinor)}`,
                },
                {
                  label: 'Opened by',
                  value: dispute.openedByShop ? 'You' : 'The buyer',
                },
                {
                  label: 'Outcome',
                  value:
                    dispute.outcome === null
                      ? 'Not decided yet'
                      : `${dispute.outcome.replace(/_/g, ' ')}${
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
              <ul aria-label="Records on the case" className="border-t border-line">
                {dispute.records.map((record) => (
                  <li
                    key={record.id}
                    className="border-b border-line px-4 py-3 last:border-b-0 md:px-6"
                  >
                    <p className="text-sm text-body">{record.title}</p>
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
