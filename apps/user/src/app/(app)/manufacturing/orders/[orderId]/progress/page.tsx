import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Card, CardHeader, EmptyState, Text, buttonAppearance } from '@ideeza/ui';
import { OrderShell } from '@/components/order/order-shell.js';
import { ProductionProgress } from '@/components/order/production-progress.js';
import { day } from '@/components/rfq/quote-money.js';
import { getOrder } from '@/data/orders.js';
import { getProduction } from '@/data/production.js';
import { requireBuyer } from '@/lib/auth.js';
import { asId, type OrderId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Readonly<Record<string, string>> = {
  buyer: 'You',
  manufacturer: 'The manufacturer',
  ops_admin: 'IDEEZA',
  system: 'IDEEZA',
};

const moment = (value: Date): string =>
  `${value.toISOString().slice(0, 10)} · ${value.toISOString().slice(11, 16)} UTC`;

/**
 * Production Progress: the stages, and the record of who moved them.
 *
 * The buyer reads production; they never move it. Every entry underneath is a
 * domain event that was written when something actually happened, which is the
 * same record a dispute would later be decided on.
 */
const ProgressPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly orderId: string }>;
}) => {
  const { orderId } = await params;
  const actor = await requireBuyer(`/manufacturing/orders/${orderId}/progress`);
  const id = asId<OrderId>(orderId);

  const [order, production] = await Promise.all([
    getOrder(actor.userId, id),
    getProduction(actor.userId, id),
  ]);
  if (order === null || production === null) notFound();

  return (
    <OrderShell
      order={order}
      activeTab="progress"
      schedule={{
        orderedOn: day(order.confirmedAt ?? order.createdAt),
        estimatedShip:
          production.schedule === null ? null : day(production.schedule.estimatedShipAt),
        estimatedDelivery:
          production.schedule === null
            ? null
            : day(production.schedule.estimatedDeliveryAt),
      }}
    >
      {production.openAlerts.length > 0 && (
        <Alert
          tone="warning"
          title="Production is paused on one part"
          actions={
            <Link
              href={`/manufacturing/orders/${order.orderId}`}
              className={buttonAppearance({ size: 'sm' })}
            >
              Answer it
            </Link>
          }
        >
          The manufacturer is short of {production.openAlerts[0]?.partName ?? 'a part'} and
          is waiting for your decision.
        </Alert>
      )}

      {production.stages.length === 0 ? (
        <Card>
          <EmptyState
            title="Production has not started"
            description="The ten stages appear the moment IDEEZA holds the funds, because that is when the manufacturer may begin."
            action={
              order.status === 'awaiting_payment' ? (
                <Link
                  href={`/manufacturing/checkout/${order.orderId}`}
                  className={buttonAppearance()}
                >
                  Pay to confirm
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ProductionProgress
          stages={production.stages}
          delayDays={production.delayDays}
        />
      )}

      <Card>
        <CardHeader
          title="Activity"
          description="Every recorded event on this order, in the order it happened."
        />
        <ol aria-label="Order activity" className="mt-4 flex flex-col gap-3">
          {production.activity.length === 0 ? (
            <li>
              <Text tone="muted" size="sm">
                Nothing has been recorded on this order yet.
              </Text>
            </li>
          ) : (
            production.activity.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-subtle pb-3 last:border-b-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">
                    {entry.kind.replace(/[._]/g, ' ')}
                  </p>
                  <Text tone="muted" size="xs">
                    {ROLE_LABEL[entry.actorRole] ?? entry.actorRole}
                    {entry.detail === null ? '' : ` · ${entry.detail}`}
                  </Text>
                </div>
                <Text tone="muted" size="xs">
                  {moment(entry.occurredAt)}
                </Text>
              </li>
            ))
          )}
        </ol>
      </Card>
    </OrderShell>
  );
};

export default ProgressPage;
