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
import { asId, type OrderId } from '@ideeza/domain';

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

const OUTCOME_LABEL: Readonly<Record<string, string>> = {
  no_issue_found: 'No issue found',
  rework: 'Rework by the manufacturer',
  partial_refund: 'Partial refund',
  full_refund: 'Full refund',
  replacement_shipment: 'Replacement shipment',
  cancelled_before_production: 'Cancelled before production',
  escalated_to_inspection: 'Escalated to an independent inspection',
};

const ROLE_LABEL: Readonly<Record<string, string>> = {
  buyer: 'You',
  manufacturer: 'The manufacturer',
  ops_admin: 'IDEEZA',
};

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
        title={`Dispute case ${dispute.id}`}
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
        actions={<StatusChip status={dispute.status} withDot />}
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
            : `Outcome: ${OUTCOME_LABEL[dispute.outcome] ?? dispute.outcome}${
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
                className="border-b border-line pb-5 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={statement.authorName} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-heading">
                      {statement.authorName}
                      <span className="ml-1.5 font-normal text-muted">
                        ({ROLE_LABEL[statement.authorRole] ?? statement.authorRole})
                      </span>
                    </p>
                    <Text tone="muted" size="xs">
                      {moment(statement.capturedAt)}
                    </Text>
                  </div>
                </div>
                <Text size="sm" className="mt-2 whitespace-pre-line">
                  {statement.body}
                </Text>
              </li>
            ))}
          </ol>

          {dispute.canAddStatement ? (
            <div className="mt-6 border-t border-line pt-6">
              <DisputeStatementForm
                orderId={orderId}
                disputeId={dispute.id}
                attachable={context.attachable}
              />
            </div>
          ) : (
            <Text tone="muted" size="sm" className="mt-6 border-t border-line pt-6">
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
                { label: 'Case', value: dispute.id },
                { label: 'Opened', value: moment(dispute.createdAt) },
                {
                  label: 'Reason',
                  value: REASON_LABEL[dispute.reason] ?? dispute.reason.replace(/_/g, ' '),
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
                  value: dispute.refundId === null ? 'No' : 'Yes',
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
