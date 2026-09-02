import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Icon,
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
  `${value.toISOString().slice(0, 10)} | ${value.toISOString().slice(11, 16)} UTC`;

/** Two initials for the circle beside a statement, which is all we hold. */
const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter((part) => part !== '')
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('');

/**
 * One dispute, as both sides read it — the design's Dispute Center case.
 *
 * The statements are the case: one thread, in order, each with who said it and
 * when, and neither side can edit or remove what it said. Everything that
 * decides it sits in the column beside — who the client is, what was claimed,
 * for how much, and the records travelling with it.
 *
 * The outcome is operations' to write. Until they do, the screen says so
 * rather than implying the shop can settle it; once they have, the outcome is
 * the first thing on the page, because it is the answer everyone came for.
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

  const resolved = dispute.status === 'resolved';

  return (
    <div className="flex flex-col gap-5">
      <Crumbs
        items={[
          { label: 'My Orders', href: '/orders' },
          { label: order.productName, href: `/orders/${orderId}` },
          { label: 'Dispute Details' },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-text-primary">
          Dispute Center Case {caseReference(dispute.id)}
        </h1>
        <StatusChip status={dispute.status} label={disputeStatusLabel(dispute.status)} withDot />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        {/* the thread, and the reply at the end of it */}
        <Card>
          {dispute.statements.length === 0 ? (
            <EmptyState
              title="No statements yet"
              description="Whatever either side says about this case appears here, with who said it and when."
            />
          ) : (
            <ul aria-label="Statements on this case">
              {dispute.statements.map((statement) => (
                <li
                  key={statement.id}
                  className="border-b border-border-subtle py-5 first:pt-0 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-brand text-sm font-semibold text-text-on-brand"
                    >
                      {initials(statement.author)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {statement.author}
                      </p>
                      <Text tone="muted" size="xs">
                        {statementAuthorLabel(statement.authorRole, 'manufacturer')} ·{' '}
                        {when(statement.at)}
                      </Text>
                    </div>
                  </div>
                  <p className="mt-4 text-base font-semibold text-text-primary">
                    {statement.title}
                  </p>
                  <Text size="sm" className="mt-2 block max-w-measure whitespace-pre-line">
                    {statement.body}
                  </Text>
                </li>
              ))}
            </ul>
          )}

          {resolved ? (
            <div className="mt-5 border-t border-border-subtle pt-5">
              {/*
                A resolved case is closed to both sides. Leaving the reply form
                on it would invite a statement nobody will read, and the outcome
                is the only thing left to say.
              */}
              <Alert
                tone={dispute.outcome === 'no_issue_found' ? 'success' : 'info'}
                title={`Resolved — ${disputeOutcomeLabel(dispute.outcome)}`}
              >
                Operations answered this on{' '}
                {dispute.resolvedAt === null ? 'a recorded day' : when(dispute.resolvedAt)}
                {dispute.outcomeAmountMinor === null || dispute.outcomeAmountMinor === 0
                  ? ', with nothing to move'
                  : `, moving ${dispute.currency} ${major(dispute.outcomeAmountMinor)}`}
                . The case is closed and nothing more can be added to it.
              </Alert>
            </div>
          ) : (
            <div className="mt-5 border-t border-border-subtle pt-5">
              <DisputeStatement
                orderId={orderId}
                disputeId={dispute.id}
                attachable={attachable}
              />
            </div>
          )}
        </Card>

        {/* what the case is, and what travels with it */}
        <div className="flex flex-col gap-5">
          <Card>
            <ul className="flex flex-col gap-3">
              {(
                [
                  ['Client Name', dispute.buyerName],
                  ['Dispute ID', caseReference(dispute.id)],
                  ['Date & Time', when(dispute.createdAt)],
                  ['Dispute Reason', issueReasonLabel(dispute.reason)],
                  [
                    'Dispute Amount',
                    `${dispute.currency} ${major(dispute.claimedAmountMinor)}`,
                  ],
                  ['Opened by', dispute.openedByShop ? 'You' : 'The buyer'],
                  ...(dispute.refundId === null
                    ? []
                    : ([['From claim', claimReference(dispute.refundId)]] as const)),
                  [
                    'Outcome',
                    `${disputeOutcomeLabel(dispute.outcome)}${
                      dispute.outcomeAmountMinor === null
                        ? ''
                        : ` · ${dispute.currency} ${major(dispute.outcomeAmountMinor)}`
                    }`,
                  ],
                ] as readonly (readonly [string, string])[]
              ).map(([label, value]) => (
                <li key={label} className="flex items-start justify-between gap-3">
                  <Text tone="muted" size="sm" className="shrink-0">
                    {label}
                  </Text>
                  <span className="min-w-0 text-right text-sm font-medium text-text-primary">
                    {value}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Attachment"
              description="Everything the order already holds travels with the case."
            />
            {dispute.records.length === 0 ? (
              <Text tone="muted" size="sm" className="mt-3 block">
                Nothing attached yet. Anything you attach to a production stage becomes part
                of this case.
              </Text>
            ) : (
              <ul aria-label="Records on the case" className="mt-3 flex flex-wrap gap-3">
                {dispute.records.map((record) => (
                  <li key={record.id}>
                    {/*
                      A tile per record, as the design has it. Nothing here is a
                      thumbnail of a file — the platform holds records, not
                      pictures of them — so each one shows what it is and says
                      its name underneath.
                    */}
                    <span className="flex w-24 flex-col items-center gap-1 text-center">
                      <span
                        aria-hidden
                        className="flex h-14 w-14 items-center justify-center rounded-lg border border-border-brand bg-bg-brand-subtle text-icon-brand"
                      >
                        <Icon name="file" size={22} />
                      </span>
                      <span className="w-full truncate text-2xs text-text-secondary">
                        {record.title}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {resolved ? (
            <Card>
              <CardHeader title="What happens to the money" />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone={dispute.outcome === 'no_issue_found' ? 'success' : 'warning'}>
                  {disputeOutcomeLabel(dispute.outcome)}
                </Badge>
                <Text tone="muted" size="sm">
                  {dispute.outcomeAmountMinor === null || dispute.outcomeAmountMinor === 0
                    ? 'Nothing moved. The payout follows the order as it stood.'
                    : `${dispute.currency} ${major(dispute.outcomeAmountMinor)} moved on the outcome.`}
                </Text>
              </div>
            </Card>
          ) : (
            <Alert tone="info" title="Neither side decides this">
              IDEEZA operations weighs both accounts and records the outcome, and the payout
              follows it. That is why what you write here matters more than what you would
              say in a message.
            </Alert>
          )}

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
