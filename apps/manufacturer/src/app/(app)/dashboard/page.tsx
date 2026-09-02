import Link from 'next/link';
import {
  Alert,
  Avatar,
  buttonAppearance,
  Card,
  CardHeader,
  cn,
  PageHeader,
  StatusChip,
  Tag,
  Text,
  majorAmount as major,
} from '@ideeza/ui';
import { getDashboardSections, getHeadlineTiles } from '@/data/dashboard.js';
import { listDisputes } from '@/data/resolution.js';
import { getShopContext } from '@/data/shop.js';
import { linkIfBuilt } from '@/lib/navigation.js';
import { readProgress } from '@/data/tour.js';
import { stopHref, TOURS } from '@/data/tours.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';


const percent = (rate: number | null): string =>
  rate === null ? '—' : `${Math.round(rate * 100)}%`;

const day = (at: Date): string =>
  at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/**
 * How long ago, in the shortest true form.
 *
 * A feed of things that just happened is read for recency, and "Aug 30" does not
 * say whether that was this morning or last month. Past a week the date is the
 * more useful answer, so it goes back to one.
 */
const ago = (at: Date, now: number): string => {
  const seconds = Math.max(0, Math.round((now - at.getTime()) / 1_000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days}d ago`;
  return day(at);
};

/**
 * The dot beside a line of the feed: what kind of news it is.
 *
 * The three hues are the design system's own, in this order, because adjacent
 * hues have to stay apart for a reader who cannot separate them by colour —
 * measured, not chosen by eye — and the words beside the dot carry the meaning
 * in any case.
 */
const ACTIVITY_DOT: Readonly<Record<string, string>> = {
  request: 'bg-bg-brand',
  quote: 'bg-bg-success',
  order: 'bg-bg-info',
  money: 'bg-bg-warning',
  problem: 'bg-bg-error',
};

/** The donut's slices, in the fixed order the palette was validated in. */
const MIX_COLOUR = [
  'var(--color-bg-brand)',
  'var(--color-text-success)',
  'var(--color-text-link)',
];

/**
 * The work mix as a ring.
 *
 * Part of a whole, at a glance, with three kinds at most — which is what a ring
 * is for. The counts sit beside it in the legend rather than on the slices,
 * because a number on every slice is noise and the ring is the shape of the
 * answer, not the answer itself.
 */
const WorkMixRing = ({
  slices,
}: {
  readonly slices: readonly { readonly label: string; readonly count: number }[];
}) => {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  if (total === 0) return null;

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0" role="img" aria-label="Work mix">
      <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--color-border-subtle)" strokeWidth="16" />
      {slices.map((slice, index) => {
        const length = (slice.count / total) * circumference;
        // A hairline of the card behind each slice keeps two of them apart.
        const dash = `${Math.max(0, length - 2)} ${circumference - Math.max(0, length - 2)}`;
        const rotation = (offset / circumference) * 360;
        offset += length;
        return (
          <circle
            key={slice.label}
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={MIX_COLOUR[index % MIX_COLOUR.length]}
            strokeWidth="16"
            strokeDasharray={dash}
            transform={`rotate(${rotation - 90} 70 70)`}
          />
        );
      })}
    </svg>
  );
};

/**
 * Event kinds, said in a sentence a shop floor would recognise.
 *
 * The log stores machine names because two panels and a test read them. The feed
 * translates rather than renames, so a kind that has no entry here still shows
 * up — unreadable is better than hidden.
 */
const ACTIVITY_LABEL: Readonly<Record<string, string>> = {
  rfq_submitted: 'Request received',
  rfq_withdrawn: 'Request withdrawn',
  rfq_recipient_viewed: 'Request opened',
  rfq_recipient_declined: 'Request declined',
  rfq_recipient_expired: 'Request expired',
  rfq_clarification_requested: 'Clarification asked for',
  quote_submitted: 'Quote sent',
  quote_revision_requested: 'Revision asked for',
  quote_revised: 'Quote revised',
  quote_accepted: 'Quote accepted',
  quote_rejected: 'Quote rejected',
  quote_expired: 'Quote expired',
  quote_withdrawn: 'Quote withdrawn',
  substitution_suggested: 'Substitute suggested',
  substitution_approved: 'Substitute approved',
  substitution_rejected: 'Substitute rejected',
  payment_initiated: 'Payment started',
  payment_secured: 'Payment held by IDEEZA',
  payment_failed: 'Payment failed',
  order_created: 'Order created',
  order_confirmed: 'Order confirmed',
  order_production_started: 'Production started',
  order_stage_advanced: 'Stage advanced',
  order_task_updated: 'Task updated',
  order_shipped: 'Shipment recorded',
  order_delivered: 'Delivery recorded',
  order_delivery_confirmed: 'Delivery confirmed',
  order_completed: 'Order completed',
  order_cancel_requested: 'Cancellation asked for',
  order_cancelled: 'Order cancelled',
  refund_requested: 'Refund asked for',
  refund_approved: 'Refund approved',
  refund_rejected: 'Refund declined',
  dispute_opened: 'Issue opened',
  dispute_statement_added: 'Statement added',
  dispute_resolved: 'Issue resolved',
  payout_released: 'Payout released',
  inventory_low_stock: 'Part running low',
  inventory_out_of_stock: 'Part out of stock',
};

/**
 * What kind of news a line is, which is what its dot says before the words are
 * read. Anything that blocks work is the one that has to carry across a room.
 */
const ACTIVITY_TONE: Readonly<Record<string, 'request' | 'quote' | 'order' | 'money' | 'problem'>> =
  {
    rfq_recipient_declined: 'problem',
    rfq_recipient_expired: 'problem',
    quote_rejected: 'problem',
    quote_expired: 'problem',
    payment_failed: 'problem',
    order_cancel_requested: 'problem',
    order_cancelled: 'problem',
    refund_requested: 'problem',
    dispute_opened: 'problem',
    inventory_low_stock: 'problem',
    inventory_out_of_stock: 'problem',
  };

interface TileProps {
  readonly label: string;
  readonly value: string;
  readonly note: string;
  readonly tone?: 'neutral' | 'warning' | 'danger';
  readonly href?: string;
}

/**
 * One number and what it means.
 *
 * The design puts six of these across the top. Each one carries the sentence
 * underneath that says where the number came from, because a figure a shop plans
 * its week around has to be traceable.
 */
const Tile = ({ label, value, note, tone = 'neutral', href }: TileProps) => {
  const body = (
    <Card
      interactive={href !== undefined}
      className={cn(
        'h-full',
        tone === 'danger' && 'border-border-error',
        tone === 'warning' && 'border-border-warning',
      )}
    >
      <p className="text-sm font-medium text-text-tertiary">{label}</p>
      <p
        data-numeric
        className="mt-2 text-3xl font-semibold tracking-near text-text-primary"
      >
        {value}
      </p>
      <Text
        tone={tone === 'danger' ? 'danger' : 'muted'}
        size="xs"
        className="mt-1.5 block"
      >
        {note}
      </Text>
    </Card>
  );

  const target = href === undefined ? undefined : linkIfBuilt(href);
  if (target === undefined) return body;
  return (
    <Link
      href={target}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
    >
      {body}
    </Link>
  );
};

/**
 * The manufacturer dashboard.
 *
 * Six headline numbers, then where the work is: the production board, the work
 * mix, the orders on the line, the requests waiting on an answer, stock health,
 * what is owed, and what just happened. Every figure is a query against this
 * shop’s own rows — nothing here is a placeholder waiting for data.
 */
const DashboardPage = async () => {
  const actor = await requireManufacturer('/dashboard');
  const [shop, tiles, sections, disputes, walked] = await Promise.all([
    getShopContext(actor.manufacturerId, actor.userId),
    getHeadlineTiles(actor.manufacturerId),
    getDashboardSections(actor.manufacturerId),
    listDisputes(actor.manufacturerId),
    readProgress(actor.userId),
  ]);

  // A dispute is the one thing on this panel that is waiting on the shop and
  // costs it money to ignore: the payout stays held until the case is decided.
  // So it is said at the top of the first screen rather than left to be found.
  const openDisputes = disputes.filter((dispute) => dispute.status !== 'resolved');
  const unanswered = openDisputes.filter((dispute) => dispute.status === 'open');

  // The tour is offered here exactly once in somebody's life on this panel:
  // until they have started one. A guided tour nobody finds is a guided tour
  // nobody takes, and the rail row alone was not finding anybody. It disappears
  // the moment a tour is begun rather than needing to be dismissed, because a
  // dismissal is a preference to store for something that answers itself.
  const firstTour = Object.keys(walked).length === 0 ? TOURS[0] : undefined;

  const now = Date.now();
  const orderTrend =
    sections.ordersLastPeriod === 0
      ? `${sections.ordersThisPeriod} in the last 30 days`
      : `${sections.ordersThisPeriod >= sections.ordersLastPeriod ? '+' : ''}${Math.round(
          ((sections.ordersThisPeriod - sections.ordersLastPeriod) /
            sections.ordersLastPeriod) *
            100,
        )}% vs the 30 days before`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analytics"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {shop !== null && (
              <StatusChip
                status={shop.verified ? 'accepted' : 'pending'}
                label={shop.verified ? 'Verified shop' : 'Verification pending'}
                withDot
              />
            )}
            <Link href="/inventory" className={buttonAppearance()}>
              Add inventory
            </Link>
          </div>
        }
      />

      {openDisputes.length > 0 && (
        <div data-tour="dashboard-notice">
          <Alert
            tone="danger"
            title={
              openDisputes.length === 1
                ? `A dispute is open on ${openDisputes[0]?.productName ?? 'an order'}`
                : `${String(openDisputes.length)} disputes are open on your orders`
            }
            actions={
              <div className="flex flex-wrap gap-2">
                <Link
                  href={
                    openDisputes[0] === undefined
                      ? '/orders'
                      : `/orders/${openDisputes[0].orderId}/disputes/${openDisputes[0].id}`
                  }
                  className={buttonAppearance({ variant: 'primary', size: 'sm' })}
                >
                  {unanswered.length > 0 ? 'Answer it' : 'Open the case'}
                </Link>
                {openDisputes.length > 1 && (
                  <Link
                    href="/settings"
                    className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
                  >
                    See all of them
                  </Link>
                )}
              </div>
            }
          >
            {unanswered.length > 0
              ? `${String(unanswered.length)} of them has had no answer from you yet. IDEEZA decides a dispute on what is written on the case, and the payout stays held until it does.`
              : 'Answered and with IDEEZA. The payout stays held until the case is decided.'}
          </Alert>
        </div>
      )}

      {firstTour !== undefined && (
        <Card tone="brand" data-tour="dashboard-tour-offer">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">
                New here? Let the panel show you round.
              </p>
              <Text size="sm" tone="muted" className="mt-1 block max-w-measure">
                {firstTour.stops.length} stops on the real screens, about{' '}
                {firstTour.minutes} minutes, and you can stop in the middle — {firstTour.promise.toLowerCase()}
              </Text>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={stopHref(firstTour, 0)}
                className={buttonAppearance({ variant: 'primary', size: 'sm' })}
              >
                Start the tour
              </Link>
              <Link
                href="/tour"
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                All five tours
              </Link>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile
          label="Open RFQs"
          value={String(tiles.openRfqs)}
          note={`${tiles.newThisWeek} new this week · ${tiles.needResponse} with a deadline`}
          href="/rfqs"
        />
        <Tile
          label="Quotes awaiting a decision"
          value={String(tiles.quotesSubmitted)}
          note={`${tiles.quotesAccepted} of your quotes have been accepted, all time`}
          href="/quotes"
        />
        <Tile
          label="Delayed orders"
          value={String(tiles.delayedOrders)}
          note={
            tiles.delayedOrders === 0
              ? `${tiles.ordersInFlight} orders in flight, all inside their lead time`
              : 'Past the lead time you quoted'
          }
          tone={tiles.delayedOrders === 0 ? 'neutral' : 'danger'}
          href="/orders"
        />
        <Tile
          label="On-time delivery"
          value={percent(tiles.onTimeDeliveryRate)}
          note="Recorded by the platform across your completed orders"
        />
        <Tile
          label="Low stock items"
          value={String(tiles.lowStockItems)}
          note={
            tiles.criticalStockItems === 0
              ? 'None out of stock'
              : `${tiles.criticalStockItems} out of stock — reorder now`
          }
          tone={tiles.criticalStockItems === 0 ? 'warning' : 'danger'}
          href="/inventory"
        />
        <Tile
          label="Pending payouts"
          value={`${tiles.currency} ${major(tiles.pendingPayoutMinor)}`}
          note={`${tiles.pendingPayoutCount} awaiting a documented release`}
          href="/payouts"
        />
      </div>


      {/* ----------------------------------------------- where the work is */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Production status"
            description="Every order you hold, by where it has got to."
            actions={
              <Link
                href="/orders"
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                View all
              </Link>
            }
          />
          <ul aria-label="Production status" className="mt-4 flex flex-col gap-3">
            {sections.production.map((bar) => (
              <li key={bar.label} className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-sm text-text-secondary">{bar.label}</span>
                <span className="w-8 shrink-0 text-sm font-semibold text-text-primary">
                  {bar.count}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-subtle">
                  <span
                    className={
                      bar.label === 'Needing attention'
                        ? 'block h-full bg-bg-error'
                        : 'block h-full bg-bg-brand'
                    }
                    style={{ width: `${Math.max(bar.count === 0 ? 0 : 4, bar.share)}%` }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right text-xs text-text-tertiary">
                  {bar.share}%
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Orders" description="What kind of work they are." />

          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <p className="text-2xl font-bold text-text-primary">{sections.orderCount}</p>
            <Text tone="muted" size="xs">
              {orderTrend}
            </Text>
          </div>

          {sections.workMix.length === 0 ? (
            <Text tone="muted" size="sm" className="mt-4">
              No orders yet.
            </Text>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-5">
              <WorkMixRing slices={sections.workMix} />
              <ul aria-label="Work mix" className="flex min-w-40 flex-1 flex-col gap-2">
                {sections.workMix.map((slice, index) => (
                  <li key={slice.label} className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: MIX_COLOUR[index % MIX_COLOUR.length] }}
                    />
                    <span className="flex-1 text-sm text-text-secondary">{slice.label}</span>
                    <span className="text-sm font-semibold text-text-primary">{slice.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      {/* ------------------------------------- what is on the line and waiting */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card padded={false}>
          <div className="px-4 py-4 md:px-6">
            <CardHeader
              title="Orders in production"
              actions={
                <Link
                  href="/orders?status=in_flight"
                  className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
                >
                  View all
                </Link>
              }
            />
          </div>
          {sections.ordersInProduction.length === 0 ? (
            <div className="px-4 pb-6 md:px-6">
              <Text tone="muted" size="sm">
                Nothing on the line right now.
              </Text>
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-border-subtle">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Orders in production</caption>
                <thead>
                  <tr className="bg-bg-page">
                    <th scope="col" className="px-4 py-2.5 text-left font-semibold text-text-primary md:px-6">
                      Name
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-left font-semibold text-text-primary">
                      Order
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold text-text-primary">
                      Qty
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-left font-semibold text-text-primary md:px-6">
                      Current stage
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sections.ordersInProduction.map((order) => (
                    <tr key={order.orderId} className="border-t border-border-subtle">
                      <td className="px-4 py-3 md:px-6">
                        <Link
                          href={`/orders/${order.orderId}`}
                          className="block max-w-[22ch] truncate py-0.5 font-semibold text-text-primary hover:text-text-brand"
                        >
                          {order.productName}
                        </Link>
                        <Text tone="muted" size="xs">
                          {order.buyerName}
                        </Text>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-text-tertiary">
                        {order.orderReference}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-text-secondary">
                        {order.quantity}
                      </td>
                      <td className="px-4 py-3 md:px-6">
                        <span className="block h-1.5 w-full min-w-24 overflow-hidden rounded-full bg-bg-subtle">
                          <span
                            className="block h-full bg-bg-success"
                            style={{
                              width: `${Math.round(
                                (order.completedStages / order.totalStages) * 100,
                              )}%`,
                            }}
                          />
                        </span>
                        <Text tone="muted" size="xs" className="mt-1 block">
                          {order.stageLabel} · {order.completedStages}/{order.totalStages}
                        </Text>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card padded={false}>
          <div className="px-4 py-4 md:px-6">
            <CardHeader
              title="Requests needing an answer"
              actions={
                <Link
                  href="/rfqs?status=routed"
                  className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
                >
                  View all
                </Link>
              }
            />
          </div>
          {sections.requestsNeedingAction.length === 0 ? (
            <div className="px-4 pb-6 md:px-6">
              <Text tone="muted" size="sm">
                Nothing waiting on you.
              </Text>
            </div>
          ) : (
            <ul aria-label="Requests needing an answer" className="border-t border-border-subtle">
              {sections.requestsNeedingAction.map((request) => (
                <li
                  key={request.rfqId}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0 md:px-6"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {request.reference}
                    </p>
                    <Text tone="muted" size="xs">
                      {request.productName} · {request.kindLabel} · {request.quantity} units
                      {request.respondBy === null
                        ? ''
                        : ` · reply by ${day(request.respondBy)}`}
                    </Text>
                  </div>
                  <Link
                    href={`/rfqs/${request.rfqId}`}
                    className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
                  >
                    Send quote
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ----------------------------------------- stock and what is owed */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card padded={false}>
          <div className="px-4 py-4 md:px-6">
            <CardHeader
              title="Inventory health"
              actions={
                <Link
                  href="/inventory"
                  className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
                >
                  View all
                </Link>
              }
            />
          </div>
          {sections.inventoryHealth.length === 0 ? (
            <div className="px-4 pb-6 md:px-6">
              <Text tone="muted" size="sm">
                No parts yet. A buyer&rsquo;s bill of materials is matched against these.
              </Text>
            </div>
          ) : (
            <div className="w-full overflow-x-auto border-t border-border-subtle">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Inventory health</caption>
                <thead>
                  <tr className="border-b border-border-subtle bg-bg-surface-raised">
                    {['Part', 'MOQ', 'Available', 'Status'].map((header) => (
                      <th
                        key={header}
                        scope="col"
                        className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-caps text-text-tertiary"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sections.inventoryHealth.map((part) => (
                    <tr key={part.id} className="border-b border-border-subtle last:border-0">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/inventory/${part.id}`}
                          className="text-sm text-text-primary hover:text-text-brand"
                        >
                          {part.partName}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">
                        {part.minimumOrderQuantity ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">{part.available}</td>
                      <td className="px-4 py-2.5">
                        <Tag
                          tone={
                            part.level === 'in_stock'
                              ? 'success'
                              : part.level === 'low_stock'
                                ? 'warning'
                                : 'danger'
                          }
                        >
                          {part.level === 'in_stock'
                            ? 'In stock'
                            : part.level === 'low_stock'
                              ? 'Low stock'
                              : 'Out of stock'}
                        </Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card padded={false}>
          <div className="px-4 py-4 md:px-6">
            <CardHeader
              title="Recent payouts"
              actions={
                <Link
                  href="/payouts"
                  className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
                >
                  View all
                </Link>
              }
            />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border-subtle p-3">
                <Text tone="muted" size="xs" className="block">
                  Held
                </Text>
                <p className="text-lg font-bold text-text-primary">
                  {sections.currency} {major(sections.pendingPayoutMinor)}
                </p>
              </div>
              <div className="rounded-lg border border-border-subtle p-3">
                <Text tone="muted" size="xs" className="block">
                  Released
                </Text>
                <p className="text-lg font-bold text-text-primary">
                  {sections.currency} {major(sections.releasedPayoutMinor)}
                </p>
              </div>
            </div>
          </div>
          {sections.payouts.length === 0 ? (
            <div className="px-4 pb-6 md:px-6">
              <Text tone="muted" size="sm">
                No payouts yet.
              </Text>
            </div>
          ) : (
            <ul aria-label="Recent payouts" className="border-t border-border-subtle">
              {sections.payouts.map((payout) => (
                <li
                  key={payout.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0 md:px-6"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={payout.buyerName} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {payout.buyerName}
                      </p>
                      <Text tone="muted" size="xs">
                        {payout.orderReference}
                      </Text>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-text-primary">
                      {sections.currency} {major(payout.netAmountMinor)}
                    </span>
                    <StatusChip status={payout.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------ what just happened */}
      <Card padded={false}>
        <div className="px-4 py-4 md:px-6">
          <CardHeader
            title="Recent activity"
            description="From the platform's own event log, newest first."
          />
        </div>
        {sections.activity.length === 0 ? (
          <div className="px-4 pb-6 md:px-6">
            <Text tone="muted" size="sm">
              Nothing recorded yet.
            </Text>
          </div>
        ) : (
          <ol aria-label="Recent activity" className="border-t border-border-subtle">
            {sections.activity.map((entry) => {
              const tone = ACTIVITY_TONE[entry.kind] ?? entry.tone;
              return (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border-subtle px-4 py-3 transition-colors last:border-b-0 hover:bg-bg-surface-raised md:px-6"
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm">
                    <span
                      aria-hidden
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-sm',
                        ACTIVITY_DOT[tone] ?? 'bg-icon',
                      )}
                    />
                    <span className="font-medium text-text-secondary">
                      {ACTIVITY_LABEL[entry.kind] ?? entry.kind.replace(/_/g, ' ')}
                    </span>
                    <span aria-hidden className="text-text-tertiary">
                      ·
                    </span>
                    {entry.href === null ? (
                      <span className="font-medium text-text-brand">{entry.reference}</span>
                    ) : (
                      <Link
                        href={entry.href}
                        className="py-0.5 font-medium text-text-brand underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current"
                      >
                        {entry.reference}
                      </Link>
                    )}
                    {entry.detail !== null && (
                      <>
                        <span aria-hidden className="text-text-tertiary">
                          ·
                        </span>
                        <span className="truncate text-xs text-text-tertiary">{entry.detail}</span>
                      </>
                    )}
                  </span>
                  <Text tone="muted" size="xs" className="shrink-0">
                    {ago(entry.at, now)}
                  </Text>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <Card tone="brand">
        <CardHeader
          title="How work reaches you"
          description="The parts of this that are yours to move, and the parts that are not."
        />
        <ol className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
          {[
            {
              step: 'A request arrives',
              detail: 'A buyer sends it to the shops it chose. It lands in Request Quote.',
            },
            {
              step: 'You quote it, or decline',
              detail: 'Read the files, the specification and the bill of materials first.',
            },
            {
              step: 'A shortage goes to the buyer',
              detail: 'You propose a substitute. They decide — you never decide for them.',
            },
            {
              step: 'The money is held',
              detail: 'One quote is accepted, IDEEZA holds the money, and production may start.',
            },
            {
              step: 'You move the ten stages',
              detail: 'Each one takes its evidence, and the buyer reads them as you go.',
            },
            {
              step: 'The money is released',
              detail: 'Against delivery confirmed, the review window closing, or a resolved issue.',
            },
          ].map((entry, index) => (
            <li key={entry.step} className="flex gap-3">
              <span
                aria-hidden
                className="mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg-surface text-2xs font-semibold text-text-brand ring-1 ring-focus"
              >
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-text-primary">{entry.step}</span>
                <span className="mt-0.5 block text-xs text-text-tertiary">{entry.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      {shop !== null && shop.profileCompleteness < 100 && (
        <Card>
          <CardHeader
            title="What buyers match you on"
            description="A request only reaches shops whose published capabilities cover it."
            actions={
              (
                <Link
                  href="/profile"
                  className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
                >
                  Open the profile
                </Link>
              )
            }
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {shop.services.length === 0 ? (
              <Tag tone="warning">No services published</Tag>
            ) : (
              shop.services.map((service) => (
                <Tag key={service} tone="brand">
                  {service.replace(/_/g, ' ')}
                </Tag>
              ))
            )}
            {shop.servedRegions.length === 0 ? (
              <Tag tone="warning">No regions served</Tag>
            ) : (
              shop.servedRegions.map((region) => (
                <Tag key={region} tone="neutral">
                  {region}
                </Tag>
              ))
            )}
            {shop.minimumOrderQuantity === null && (
              <Tag tone="warning">No minimum order quantity</Tag>
            )}
            {shop.standardLeadTimeDays === null && (
              <Tag tone="warning">No standard lead time</Tag>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default DashboardPage;
