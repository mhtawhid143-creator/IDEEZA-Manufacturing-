import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  EmptyState,
  StatusChip,
  Text,
  buttonAppearance,
} from '@ideeza/ui';
import { asId, type OrderId } from '@ideeza/domain';
import { OrderShell } from '@/components/order/order-shell.js';
import { ProductionTimeline } from '@/components/order/production-timeline.js';
import { REVIEW_WINDOW_DAYS } from '@/lib/review-window.js';
import { RefundBanner } from '@/components/order/refund-banner.js';
import { getClientProfile } from '@/data/clients.js';
import { getOrder } from '@/data/orders.js';
import { listParts } from '@/data/inventory.js';
import { listDisputes, listRefundClaims } from '@/data/resolution.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const day = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);

const when = (value: Date): string =>
  `${value.toISOString().slice(0, 10)} at ${value.toISOString().slice(11, 16)} UTC`;

const major = (minor: number): string =>
  `${minor < 0 ? '-' : ''}${(Math.abs(minor) / 100).toFixed(2)}`;

const ALERT_LABEL: Readonly<Record<string, string>> = {
  open: 'Waiting on the buyer',
  substitute_approved: 'Substitute approved',
  part_dropped: 'Part dropped for a credit',
  stock_awaited: 'Waiting for stock',
};

const EVIDENCE_LABEL: Readonly<Record<string, string>> = {
  accepted_quote: 'Accepted quote',
  order_terms: 'Order terms',
  design_file: 'Design file',
  bom_revision: 'BOM revision',
  approved_substitution: 'Approved substitution',
  change_order: 'Change order',
  quality_report: 'Quality report',
  measurement_data: 'Measurement data',
  photo: 'Photograph',
  shipping_record: 'Shipping record',
  delivery_record: 'Delivery record',
  buyer_statement: 'Buyer statement',
  manufacturer_statement: 'Your statement',
};

/**
 * Production Stage: the ten stages, the tasks inside them, and the records they
 * produced.
 *
 * What can move and what cannot is decided by the domain and shown as such: a
 * stage the platform or the buyer owns is not offered, and a shortage the buyer
 * has not answered stops the line rather than being worked around.
 */
const OrderProductionPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly orderId: string }>;
}) => {
  const { orderId } = await params;
  const actor = await requireManufacturer(`/orders/${orderId}`);
  const order = await getOrder(actor.manufacturerId, asId<OrderId>(orderId));
  if (order === null) notFound();

  const [client, parts, claims, disputes] = await Promise.all([
    getClientProfile(order.buyerId, actor.manufacturerId),
    listParts(actor.manufacturerId, { pageSize: 200, matching: 'enabled' }),
    listRefundClaims(actor.manufacturerId),
    listDisputes(actor.manufacturerId),
  ]);

  const claim = claims.find((row) => row.orderId === order.orderId) ?? null;
  const openCases = disputes.filter((row) => row.orderId === order.orderId);

  return (
    <OrderShell
      order={order}
      client={client}
      creatorName={order.creatorName}
      activeTab="production"
      reviewWindowDays={REVIEW_WINDOW_DAYS}
      stock={parts.rows.map((row) => ({
        id: row.id,
        label: `${row.partName} · ${row.sku} · ${row.available} available`,
      }))}
    >
      {claim !== null && (
        <RefundBanner
          orderId={order.orderId}
          refundId={claim.id}
          buyerName={claim.buyerName}
          currency={claim.currency}
          claimedMajor={major(claim.requestedAmountMinor)}
          reason={claim.reason}
          description={claim.description}
          respondByOn={day(new Date(claim.createdAt.getTime() + 7 * 86_400_000))}
          answered={claim.status !== 'requested'}
          disputeId={claim.disputeId}
        />
      )}

      {openCases.length > 0 && (
        <Card>
          <CardHeader
            title="Cases on this order"
            description="Operations decides these, and the payout follows the outcome."
          />
          <ul aria-label="Cases" className="mt-3 flex flex-col gap-2">
            {openCases.map((dispute) => (
              <li
                key={dispute.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-heading">
                    Case {dispute.id.slice(-8).toUpperCase()} ·{' '}
                    {dispute.reason.replace(/_/g, ' ')}
                  </p>
                  <Text tone="muted" size="xs">
                    {dispute.currency} {major(dispute.claimedAmountMinor)} in question ·{' '}
                    {dispute.statements.length} statement
                    {dispute.statements.length === 1 ? '' : 's'}
                  </Text>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip status={dispute.status} />
                  <Link
                    href={`/orders/${order.orderId}/disputes/${dispute.id}`}
                    className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
                  >
                    Open the case
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ProductionTimeline
        orderId={order.orderId}
        live={order.fundingSecured && order.completedStages < order.totalStages}
        stages={order.stages.map((stage) => ({
          id: stage.id,
          key: stage.key,
          label: stage.label,
          status: stage.status,
          advancedBy: stage.advancedBy,
          startedOn: stage.startedAt === null ? null : day(stage.startedAt),
          completedOn: stage.completedAt === null ? null : day(stage.completedAt),
          note: stage.note,
          tasks: stage.tasks.map((task) => ({
            id: task.id,
            label: task.label,
            status: task.status,
            completedOn: task.completedAt === null ? null : day(task.completedAt),
          })),
          evidenceCount: stage.evidenceCount,
          movable: stage.movable,
          blockedReason: stage.blockedReason,
          waitingFor:
            stage.advancedBy === 'buyer'
              ? 'Waiting on the buyer'
              : stage.advancedBy === 'system'
                ? 'The platform moves this one'
                : stage.movable
                  ? 'Yours to move'
                  : (stage.blockedReason ?? 'Waiting'),
        }))}
      />

      {order.alerts.length > 0 && (
        <Card padded={false}>
          <div className="px-4 py-4 md:px-6">
            <CardHeader
              title="Part shortages on this order"
              description="Raised by you, decided by the buyer. The frozen terms are never edited; the difference is carried as an adjustment."
            />
          </div>
          <ul aria-label="Part shortages" className="border-t border-line">
            {order.alerts.map((alert) => (
              <li
                key={alert.id}
                className="border-b border-line px-4 py-4 last:border-b-0 md:px-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-heading">
                    {alert.partReference} · {alert.partName} — {alert.shortfallQuantity}{' '}
                    short
                  </p>
                  <StatusChip
                    status={alert.status}
                    label={ALERT_LABEL[alert.status] ?? alert.status}
                    withDot
                  />
                </div>
                <Text tone="muted" size="xs" className="mt-1 block">
                  raised {day(alert.raisedAt)}
                  {alert.suggestedPartName === null
                    ? ''
                    : ` · you suggested ${alert.suggestedPartName}`}
                  {alert.priceImpactMinor === 0
                    ? ''
                    : ` · ${order.currency} ${major(alert.priceImpactMinor)} price impact`}
                  {alert.creditMinor === 0
                    ? ''
                    : ` · ${order.currency} ${major(alert.creditMinor)} credit if dropped`}
                  {alert.leadTimeImpactDays === 0
                    ? ''
                    : ` · ${alert.leadTimeImpactDays} extra days`}
                </Text>
                <Text size="sm" className="mt-2 block">
                  {alert.note}
                </Text>
                {alert.decisionNote !== null && (
                  <Text size="sm" className="mt-2 block font-medium text-heading">
                    The buyer answered: {alert.decisionNote}
                  </Text>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card padded={false}>
        <div className="px-4 py-4 md:px-6">
          <CardHeader
            title="Records on this order"
            description="What each stage produced. The buyer reads the same list."
          />
        </div>
        {order.evidence.length === 0 ? (
          <div className="px-4 pb-6 md:px-6">
            <EmptyState
              title="Nothing recorded yet"
              description="Attach a quality report, measurements or a photograph from a stage’s menu."
            />
          </div>
        ) : (
          <ul aria-label="Records" className="border-t border-line">
            {order.evidence.map((record) => (
              <li
                key={record.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3 last:border-b-0 md:px-6"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-heading">{record.title}</p>
                  <Text tone="muted" size="xs">
                    {EVIDENCE_LABEL[record.kind] ?? record.kind}
                    {record.stageKey === null ? '' : ` · ${record.stageKey}`}
                  </Text>
                </div>
                <Text tone="muted" size="xs">
                  {when(record.capturedAt)}
                </Text>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </OrderShell>
  );
};

export default OrderProductionPage;
