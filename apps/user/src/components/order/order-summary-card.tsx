import Link from 'next/link';
import { Card, CardHeader, Text, buttonAppearance } from '@ideeza/ui';
import { major } from '@/components/rfq/quote-money.js';
import type { OrderSummaryView } from '@/data/production.js';

const signed = (currency: string, minor: number): string =>
  `${minor < 0 ? '−' : ''}${currency} ${major(BigInt(Math.abs(minor)))}`;

export interface OrderSummaryCardProps {
  readonly summary: OrderSummaryView;
  readonly orderId: string;
  readonly canTrackShipment: boolean;
  readonly awaitingPayment: boolean;
}

/**
 * What the order costs, and what is still owed.
 *
 * The lines are the charge that was actually taken, not a fresh calculation, so
 * this card and the payment record can never disagree. Anything decided after
 * the funds were held — an approved substitute, a dropped part — is shown as its
 * own line and summed separately, because the frozen terms are not editable and
 * pretending otherwise would hide a change from the buyer.
 */
export const OrderSummaryCard = ({
  summary,
  orderId,
  canTrackShipment,
  awaitingPayment,
}: OrderSummaryCardProps) => (
  <Card>
    <CardHeader title="Order Summary" />

    <dl className="mt-4 flex flex-col gap-2">
      {summary.lines.map((line) => (
        <div key={line.label} className="flex items-baseline justify-between gap-4">
          <dt className="min-w-0 text-sm text-text-secondary">
            {line.label}
            {line.note !== undefined && (
              <span className="block text-xs text-text-tertiary">{line.note}</span>
            )}
          </dt>
          <dd className="shrink-0 text-sm font-semibold text-text-primary">
            {signed(summary.currency, line.amountMinor)}
          </dd>
        </div>
      ))}
    </dl>

    <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-border-subtle pt-4">
      <span className="text-sm font-semibold text-text-primary">
        {awaitingPayment ? 'To pay' : 'Paid and held'}
      </span>
      <span className="text-lg font-bold text-text-brand">
        {summary.currency} {major(BigInt(summary.paidMinor))}
      </span>
    </div>
    {!awaitingPayment && (
      <Text tone="muted" size="xs" className="mt-1">
        IDEEZA is holding this until you confirm delivery.
      </Text>
    )}

    {summary.adjustmentMinor !== 0 && (
      <div className="mt-3 rounded-lg border border-border-warning bg-bg-warning-subtle p-3">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm font-semibold text-text-primary">
            {summary.adjustmentMinor > 0 ? 'Still to settle' : 'Owed back to you'}
          </span>
          <span className="text-sm font-bold text-text-primary">
            {summary.currency} {major(BigInt(Math.abs(summary.adjustmentMinor)))}
          </span>
        </div>
        <Text tone="muted" size="xs" className="mt-1">
          Decided during production, so it sits outside the funds already held. It is
          settled before the money is released.
        </Text>
      </div>
    )}

    <div className="mt-4 flex flex-col gap-2">
      {canTrackShipment ? (
        <Link
          href={`/manufacturing/orders/${orderId}/progress`}
          className={buttonAppearance({ variant: 'secondary', fullWidth: true })}
        >
          Track Shipment
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className={buttonAppearance({ variant: 'secondary', fullWidth: true })}
          title="Tracking appears once the units have shipped"
        >
          Track Shipment
        </button>
      )}
      <Link
        href={`/manufacturing/orders/${orderId}/dispute`}
        className={buttonAppearance({ variant: 'ghost', fullWidth: true })}
      >
        Report a Problem
      </Link>
    </div>

    <Text tone="muted" size="xs" className="mt-3">
      The accepted terms govern this order. Money is released against the record of
      what was made and delivered.
    </Text>
  </Card>
);
