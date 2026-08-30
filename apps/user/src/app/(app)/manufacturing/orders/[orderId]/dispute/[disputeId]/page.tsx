import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Alert,
  Avatar,
  Card,
  CardHeader,
  DefinitionList,
  PageHeader,
  StatusChip,
  Tag,
  Text,
  buttonAppearance,
} from '@ideeza/ui';
import { Crumbs } from '@/components/crumbs.js';
import { DisputeStatementForm } from '@/components/order/dispute-statement-form.js';
import { major } from '@/components/rfq/quote-money.js';
import { getDispute, getIssueContext } from '@/data/resolution.js';
import { requireBuyer } from '@/lib/auth.js';
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

export const dynamic = 'force-dynamic';

const moment = (value: Date): string =>
  `${value.toISOString().slice(0, 10)} · ${value.toISOString().slice(11, 16)} UTC`;

/**
 * The dispute case: everything said, and everything it will be decided on.
 *
 * IDEEZA decides the outcome, so this screen never offers the buyer a decision —
 * it offers them the record. The statements are in the order they were made, and
 * the case summary is the frozen claim they are all about.
 */
const DisputeCasePage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly orderId: string; readonly disputeId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const { orderId, disputeId } = await params;
  const actor = await requireBuyer(`/manufacturing/orders/${orderId}/dispute`);

  const [dispute, context] = await Promise.all([
    getDispute(actor.userId, disputeId),
    getIssueContext(actor.userId, asId<OrderId>(orderId)),
  ]);
  if (dispute === null || context === null) notFound();

  const query = await searchParams;
  const justOpened = query['opened'] === '1';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Dispute ${caseReference(dispute.id)}`}
        description={`${dispute.productName} · ${dispute.manufacturerName}`}
        breadcrumbs={
          <Crumbs
            items={[
              { label: 'Manufacturing', href: '/manufacturing' },
              { label: 'Active Orders', href: '/manufacturing/orders' },
              { label: 'Order', href: `/manufacturing/orders/${orderId}` },
              { label: 'Dispute details' },
            ]}
          />
        }
        actions={
          <StatusChip
            status={dispute.status}
            label={disputeStatusLabel(dispute.status)}
            withDot
          />
        }
      />

      {justOpened && (
        <Alert tone="success" title="The case is open">
          {dispute.manufacturerName} and IDEEZA have been told. The money stays held
          until this is decided.
        </Alert>
      )}

      {dispute.status === 'resolved' && (
        <Alert tone="info" title="This case has been decided">
          {dispute.outcome === null
            ? 'The outcome is recorded against the order.'
            : `Outcome: ${disputeOutcomeLabel(dispute.outcome)}${
                dispute.outcomeMinor === null
                  ? ''
                  : ` · ${dispute.currency} ${major(BigInt(dispute.outcomeMinor))}`
              }.`}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="The case"
            description="Every statement, in the order it was made. Nothing here can be edited."
          />

          <ol aria-label="Dispute statements" className="mt-4 flex flex-col gap-5">
            {dispute.statements.map((statement) => (
              <li
                key={statement.id}
                className="border-b border-border-subtle pb-5 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={statement.authorName} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {statement.authorName}
                      <span className="ml-1.5 font-normal text-text-tertiary">
                        ({statementAuthorLabel(statement.authorRole, 'buyer')})
                      </span>
                    </p>
                    <Text tone="muted" size="xs">
                      {moment(statement.capturedAt)}
                    </Text>
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold text-text-primary">
                  {statement.title}
                </p>
                <Text size="sm" className="mt-1 whitespace-pre-line">
                  {statement.body}
                </Text>
              </li>
            ))}
          </ol>

          {dispute.canAddStatement ? (
            <div className="mt-6 border-t border-border-subtle pt-6">
              <DisputeStatementForm
                orderId={orderId}
                disputeId={dispute.id}
                attachable={context.attachable}
              />
            </div>
          ) : (
            <Text tone="muted" size="sm" className="mt-6 border-t border-border-subtle pt-6">
              The case is closed, so nothing further can be added to it.
            </Text>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Case summary" />
            <DefinitionList
              className="mt-3"
              items={[
                { label: 'Buyer', value: dispute.buyerName },
                { label: 'Manufacturer', value: dispute.manufacturerName },
                { label: 'Case', value: caseReference(dispute.id) },
                { label: 'Opened', value: moment(dispute.createdAt) },
                {
                  label: 'Reason',
                  value: issueReasonLabel(dispute.reason),
                },
                {
                  label: 'Amount claimed',
                  value: `${dispute.currency} ${major(BigInt(dispute.claimedMinor))}`,
                },
                {
                  label: 'Held by IDEEZA',
                  value: context.fundsHeld
                    ? `${context.currency} ${major(BigInt(context.heldMinor))}`
                    : 'Nothing',
                },
                {
                  label: 'From a refund claim',
                  value:
                    dispute.refundId === null
                      ? 'No refund claim behind it'
                      : claimReference(dispute.refundId),
                },
              ]}
            />
          </Card>

          <Card>
            <CardHeader
              title="Attachments"
              description="The records both sides have pointed at."
            />
            {dispute.attachments.length === 0 ? (
              <Text tone="muted" size="sm" className="mt-3">
                Nothing attached yet.
              </Text>
            ) : (
              <ul aria-label="Case attachments" className="mt-3 flex flex-wrap gap-2">
                {dispute.attachments.map((attachment) => (
                  <li key={`${attachment.id}-${attachment.name}`}>
                    <Tag tone="neutral">{attachment.name}</Tag>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card tone="brand">
            <CardHeader title="How this is decided" />
            <Text size="sm" className="mt-2">
              IDEEZA decides the outcome on this record — not the buyer and not the
              manufacturer. A case cannot be closed without evidence on it, and the
              money is released only against the decision.
            </Text>
            <div className="mt-3">
              <Link
                href={`/manufacturing/orders/${orderId}/records`}
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                The order record
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DisputeCasePage;
