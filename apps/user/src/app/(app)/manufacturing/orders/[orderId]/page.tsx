import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Alert,
  Avatar,
  Card,
  CardHeader,
  DefinitionList,
  Heading,
  StatusChip,
  Tag,
  Text,
  buttonAppearance,
} from '@ideeza/ui';
import { DeliveryActionsPanel } from '@/components/order/delivery-actions-panel.js';
import { InventoryAlertCard } from '@/components/order/inventory-alert-card.js';
import { OrderShell } from '@/components/order/order-shell.js';
import { OrderSummaryCard } from '@/components/order/order-summary-card.js';
import { day, major } from '@/components/rfq/quote-money.js';
import { getOrder } from '@/data/orders.js';
import { REVIEW_WINDOW_DAYS, getDelivery } from '@/data/delivery.js';
import { getOrderSummary, getProduction, listInventoryAlerts } from '@/data/production.js';
import { threadForContext } from '@/data/messaging.js';
import { listOrderIssues } from '@/data/resolution.js';
import { requireBuyer } from '@/lib/auth.js';
import {
  asId,
  caseReference,
  claimReference,
  disputeStatusLabel,
  issueReasonLabel,
  refundStatusLabel,
  type OrderId,
} from '@ideeza/domain';

export const dynamic = 'force-dynamic';

const SERVICE_LABEL: Readonly<Record<string, string>> = {
  pcb_fabrication: 'Fabrication',
  parts_sourcing: 'Parts sourcing',
  pcb_assembly: 'Assembly',
  enclosure_3d: '3D / enclosure',
  stencil: 'Stencil',
  testing: 'Testing',
};

const SHIPPING_METHOD: Readonly<Record<string, string>> = {
  standard: 'Standard courier · tracked',
  express: 'Expedited courier · tracked',
};

/**
 * Production Overview: what is being made, by whom, for how much.
 *
 * The scope is read from the frozen snapshot rather than from the request, so
 * this screen cannot drift from what was agreed. Anything decided after the
 * funds were secured — a shortage answered, a part dropped — appears as its own
 * line rather than being folded into the agreed terms.
 */
const OrderPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly orderId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const { orderId } = await params;
  const actor = await requireBuyer(`/manufacturing/orders/${orderId}`);
  const id = asId<OrderId>(orderId);

  const [order, production, summary, alerts, delivery, issues, threadId] =
    await Promise.all([
      getOrder(actor.userId, id),
      getProduction(actor.userId, id),
      getOrderSummary(actor.userId, id),
      listInventoryAlerts(actor.userId, id),
      getDelivery(actor.userId, id),
      listOrderIssues(actor.userId, id),
      threadForContext(actor.userId, { orderId: id }),
    ]);
  if (order === null || summary === null) notFound();

  const query = await searchParams;
  const justCreated = query['created'] === '1';
  const justConfirmed = query['confirmed'] === '1';
  const awaitingPayment = order.status === 'awaiting_payment';
  const cancelRequested = query['cancel-requested'] === '1';
  const refundRequested = query['refund-requested'] === '1';
  const liveRefund = issues.refunds.find(
    (refund) =>
      refund.status === 'requested' ||
      refund.status === 'mfr_responded' ||
      refund.status === 'ops_review',
  );
  const liveDispute = issues.disputes.find((dispute) => dispute.status !== 'resolved');
  const openAlerts = alerts.filter((alert) => alert.status === 'open');
  const decidedAlerts = alerts.filter((alert) => alert.status !== 'open');

  return (
    <OrderShell
      order={order}
      activeTab="overview"
      schedule={{
        orderedOn: day(order.confirmedAt ?? order.createdAt),
        estimatedShip:
          production?.schedule === null || production?.schedule === undefined
            ? null
            : day(production.schedule.estimatedShipAt),
        estimatedDelivery:
          production?.schedule === null || production?.schedule === undefined
            ? null
            : day(production.schedule.estimatedDeliveryAt),
      }}
    >
      {justCreated && (
        <Alert tone="success" title="The order is open">
          {order.manufacturerName} has been told. The order is{' '}
          <span className="font-semibold">awaiting payment</span>: it is confirmed, and
          production may start, only once the platform holds the funds.
        </Alert>
      )}

      {awaitingPayment && (
        <Alert
          tone="warning"
          title="Nothing is being made yet"
          actions={
            <Link
              href={`/manufacturing/checkout/${order.orderId}`}
              className={buttonAppearance()}
            >
              Pay to confirm
            </Link>
          }
        >
          Production cannot begin before IDEEZA holds the funds. Paying is what confirms
          this order.
        </Alert>
      )}

      {cancelRequested && (
        <Alert tone="info" title="Cancellation requested">
          IDEEZA decides it. {order.manufacturerName} keeps working until then, and the
          money stays held.
        </Alert>
      )}

      {refundRequested && (
        <Alert tone="info" title="Refund claim recorded">
          The payout is stopped while it is decided. {order.manufacturerName} is asked to
          answer it.
        </Alert>
      )}

      {order.status === 'cancel_requested' && (
        <Alert tone="warning" title="A cancellation request is open">
          Only IDEEZA can cancel an order that is being made. Until it is decided,
          production continues and the money stays held.
        </Alert>
      )}

      {liveRefund !== undefined && (
        <Alert
          tone="warning"
          title="A refund claim is open"
          actions={
            <Link
              href={`/manufacturing/orders/${order.orderId}/refund`}
              className={buttonAppearance({ variant: 'secondary' })}
            >
              See the claim
            </Link>
          }
        >
          {claimReference(liveRefund.id)} · {order.currency}{' '}
          {major(BigInt(liveRefund.requestedMinor))} claimed ·{' '}
          {issueReasonLabel(liveRefund.reason)} ·{' '}
          {refundStatusLabel(liveRefund.status)}.
          {liveRefund.approvedMinor === null ? (
            ' No money reaches the manufacturer while this is open.'
          ) : (
            <span className="mt-1 block font-medium text-heading">
              {order.manufacturerName} accepts {order.currency}{' '}
              {major(BigInt(liveRefund.approvedMinor))} of it. IDEEZA decides the
              outcome, and no money reaches the manufacturer while this is open.
            </span>
          )}
        </Alert>
      )}

      {liveDispute !== undefined && (
        <Alert
          tone="danger"
          title="A dispute is in progress"
          actions={
            <Link
              href={`/manufacturing/orders/${order.orderId}/dispute/${liveDispute.id}`}
              className={buttonAppearance({ variant: 'secondary' })}
            >
              Open the case
            </Link>
          }
        >
          {caseReference(liveDispute.id)} · {issueReasonLabel(liveDispute.reason)} ·{' '}
          {order.currency} {major(BigInt(liveDispute.claimedMinor))} claimed ·{' '}
          {disputeStatusLabel(liveDispute.status)}. IDEEZA decides it on the record.
        </Alert>
      )}

      {justConfirmed && (
        <Alert tone="success" title="Delivery confirmed">
          The order is complete and the money has left escrow. The record of what was
          made, and of your confirmation, stays with the order.
        </Alert>
      )}

      {order.status === 'delivered' && delivery !== null && (
        <Alert
          tone="info"
          title="The units have arrived"
          actions={
            <Link
              href={`/manufacturing/orders/${order.orderId}/confirm-delivery`}
              className={buttonAppearance()}
            >
              Confirm delivery
            </Link>
          }
        >
          {delivery.reviewWindowOpen
            ? `You have ${delivery.reviewWindowDaysLeft} day${
                delivery.reviewWindowDaysLeft === 1 ? '' : 's'
              } of the ${REVIEW_WINDOW_DAYS}-day review window left. Confirming releases the money; if something is wrong, request a refund or open a dispute instead. If you do nothing, the window closing releases it.`
            : 'The review window has closed. Confirming records that what arrived was right.'}
        </Alert>
      )}

      {order.status === 'completed' && delivery !== null && (
        <Alert tone="success" title="This order is complete">
          {delivery.payoutStatus === 'released'
            ? `The money was released to ${order.manufacturerName} against your delivery confirmation.`
            : 'The order is closed. The payout is held while an issue is open.'}
        </Alert>
      )}

      {openAlerts.length > 0 && (
        <Alert
          tone="warning"
          title={`${openAlerts.length} part${openAlerts.length === 1 ? '' : 's'} short — the manufacturer is waiting on you`}
        >
          Production of the affected part is paused until you answer. Your answer is
          recorded against the accepted terms; it never rewrites them.
        </Alert>
      )}

      {openAlerts.length > 0 && (
        <div className="flex flex-col gap-3">
          {openAlerts.map((alert) => (
            <InventoryAlertCard
              key={alert.id}
              alert={{
                id: alert.id,
                status: alert.status,
                partReference: alert.partReference,
                partName: alert.partName,
                shortfallQuantity: alert.shortfallQuantity,
                note: alert.note,
                suggestedPartName: alert.suggestedPartName,
                technicalJustification: alert.technicalJustification,
                currency: alert.currency,
                priceImpactMajor: major(BigInt(alert.priceImpactMinor)),
                creditMajor: major(BigInt(alert.creditMinor)),
                leadTimeImpactDays: alert.leadTimeImpactDays,
                restockLeadTimeDays: alert.restockLeadTimeDays,
                raisedByName: alert.raisedByName,
                raisedOn: day(alert.raisedAt),
                decidedOn: alert.decidedAt === null ? null : day(alert.decidedAt),
                decisionNote: alert.decisionNote,
              }}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              title="Production scope"
              description="Locked from the accepted quote — to change it, request a new quote."
            />
            <ul aria-label="Production scope" className="mt-4 flex flex-col gap-2.5">
              {order.requestedServices.length === 0 ? (
                <li>
                  <Text tone="muted" size="sm">
                    The quote covers the package as one lot.
                  </Text>
                </li>
              ) : (
                order.requestedServices.map((service) => (
                  <li
                    key={service}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex items-center gap-2 text-body">
                      <span
                        aria-hidden
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-success-weak text-[11px] font-bold text-success"
                      >
                        ✓
                      </span>
                      {SERVICE_LABEL[service] ?? service.replace(/_/g, ' ')}
                    </span>
                    <span className="text-success">Included</span>
                  </li>
                ))
              )}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Items in this order" />
            <ul aria-label="Items in this order" className="mt-4 flex flex-col gap-3">
              <li className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="h-11 w-11 shrink-0 rounded-md bg-gradient-to-br from-brand-weak to-info-weak"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-heading">
                    {order.productName}
                  </p>
                  <Text tone="muted" size="xs">
                    {order.materialProcessNotes}
                  </Text>
                </div>
                <Tag tone="brand">{order.quantity} pcs · as quoted</Tag>
              </li>
            </ul>
            <div className="mt-4">
              <Link
                href={`/manufacturing/orders/${order.orderId}/items`}
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                See every line and its spec
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="Shipping" />
            <DefinitionList
              className="mt-4"
              items={[
                {
                  label: 'Shipping method',
                  value:
                    SHIPPING_METHOD[order.shippingChoice] ?? order.shippingChoice,
                },
                { label: 'As required', value: order.shippingRequirement },
                {
                  label: 'Address',
                  value: `${order.deliveryAddress.line1}${
                    order.deliveryAddress.line2 === null
                      ? ''
                      : `, ${order.deliveryAddress.line2}`
                  }, ${order.deliveryAddress.city}${
                    order.deliveryAddress.region === null
                      ? ''
                      : `, ${order.deliveryAddress.region}`
                  } ${order.deliveryAddress.postalCode ?? ''} ${order.deliveryAddress.countryCode}`,
                },
                {
                  label: 'Tracking',
                  value:
                    production?.canTrackShipment === true
                      ? 'Recorded by the manufacturer on the shipped stage'
                      : 'Available once shipped',
                },
              ]}
            />
          </Card>

          <Card>
            <CardHeader
              title="The accepted terms"
              description="An immutable, checksummed copy of the quote, taken at the moment it was accepted."
            />
            <DefinitionList
              className="mt-4"
              columns={2}
              items={[
                { label: 'Manufacturer', value: order.manufacturerName },
                { label: 'Quantity', value: String(order.quantity) },
                {
                  label: 'Per unit',
                  value: `${order.currency} ${major(order.unitPriceMinor)}`,
                },
                {
                  label: 'Units total',
                  value: `${order.currency} ${major(order.totalPriceMinor)}`,
                },
                {
                  label: 'Shipping',
                  value:
                    order.shippingEstimateMinor === null
                      ? 'Not quoted'
                      : `${order.currency} ${major(order.shippingEstimateMinor)}`,
                },
                {
                  label: 'Tooling / setup',
                  value:
                    order.toolingSetupCostMinor === null
                      ? 'None'
                      : `${order.currency} ${major(order.toolingSetupCostMinor)}`,
                },
                { label: 'Lead time', value: `${order.leadTimeDays} days` },
                { label: 'Accepted', value: day(order.capturedAt) },
                { label: 'Snapshot checksum', value: order.checksum },
                {
                  label: 'Approved replacements',
                  value:
                    order.approvedSubstitutionIds.length === 0
                      ? 'None'
                      : String(order.approvedSubstitutionIds.length),
                },
              ]}
            />
            <Text tone="muted" size="xs" className="mt-3">
              The checksum is what makes this record admissible later: if a term ever
              looked different, the checksum would not match.
            </Text>
          </Card>

          {decidedAlerts.length > 0 && (
            <Card>
              <CardHeader
                title="Changes decided during production"
                description="Answers to shortages the manufacturer hit. They are recorded against the frozen terms, never inside them."
              />
              <ul className="mt-4 flex flex-col gap-3">
                {decidedAlerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-heading">
                        {alert.partReference} · {alert.partName}
                      </p>
                      <Text tone="muted" size="xs">
                        {alert.decisionNote ?? 'No note'} · answered{' '}
                        {alert.decidedAt === null ? '—' : day(alert.decidedAt)}
                      </Text>
                    </div>
                    <StatusChip status={alert.status} withDot />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <div className="flex items-center gap-3">
              <Avatar name={order.manufacturerName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-heading">
                  {order.manufacturerName}
                </p>
                <Text tone="muted" size="xs">
                  {order.manufacturerRating === null
                    ? 'Not rated yet'
                    : `★ ${order.manufacturerRating.toFixed(1)}`}{' '}
                  · {order.manufacturerCity}, {order.manufacturerCountry}
                </Text>
              </div>
              <Link
                href={threadId === null ? '/messages' : `/messages/${threadId}`}
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                Message
              </Link>
            </div>
          </Card>

          <OrderSummaryCard
            summary={summary}
            orderId={String(order.orderId)}
            canTrackShipment={production?.canTrackShipment ?? false}
            awaitingPayment={awaitingPayment}
          />

          {delivery !== null && (delivery.deliveredAt !== null || delivery.review !== null) && (
            <DeliveryActionsPanel
              orderId={String(order.orderId)}
              manufacturerName={order.manufacturerName}
              reviewed={delivery.review !== null}
              canReview={delivery.canReview}
              reviewBlockedReason={delivery.reviewBlockedReason}
              review={
                delivery.review === null
                  ? null
                  : {
                      rating: delivery.review.rating,
                      body: delivery.review.body,
                      anonymous: delivery.review.anonymous,
                      publishedOn: day(delivery.review.createdAt),
                    }
              }
            />
          )}

          <Card tone="brand">
            <Heading level={4}>Where this order is</Heading>
            <Text className="mt-2" size="sm">
              {production === null || production.stages.length === 0
                ? 'The ten production stages appear as soon as the funds are held.'
                : `${production.completedStageCount} of ${production.stages.length} stages complete${
                    production.currentStage === null
                      ? ''
                      : ` · now: ${production.currentStage.label}`
                  }.`}
            </Text>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/manufacturing/orders/${order.orderId}/progress`}
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                Production progress
              </Link>
              <Link
                href={`/manufacturing/orders/${order.orderId}/records`}
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                Order records
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="Where it came from" />
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href={`/manufacturing/rfq/${order.rfqId}/accepted`}
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                The accepted quote
              </Link>
              <Link
                href={`/manufacturing/rfq/${order.rfqId}`}
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                The request
              </Link>
              <Link
                href={`/products/${order.productId}`}
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                The product
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </OrderShell>
  );
};

export default OrderPage;
