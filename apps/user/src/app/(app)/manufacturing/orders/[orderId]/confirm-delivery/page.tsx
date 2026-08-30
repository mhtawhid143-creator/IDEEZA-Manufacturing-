import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Alert,
  Card,
  CardHeader,
  DefinitionList,
  PageHeader,
  StatusChip,
  Text,
  buttonAppearance,
} from '@ideeza/ui';
import { ConfirmDeliveryForm } from '@/components/order/confirm-delivery-form.js';
import { Crumbs } from '@/components/crumbs.js';
import { day, major } from '@/components/rfq/quote-money.js';
import { REVIEW_WINDOW_DAYS, getDelivery } from '@/data/delivery.js';
import { requireBuyer } from '@/lib/auth.js';
import { asId, type OrderId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

/**
 * Confirming delivery: the buyer's side of the escrow.
 *
 * The platform has held the money since checkout. This screen states what
 * confirming does, what the alternatives are, and what happens if the buyer does
 * nothing until the review window closes — because silence releases the money
 * too, and that has to be said before it happens rather than after.
 */
const ConfirmDeliveryPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly orderId: string }>;
}) => {
  const { orderId } = await params;
  const actor = await requireBuyer(`/manufacturing/orders/${orderId}/confirm-delivery`);
  const delivery = await getDelivery(actor.userId, asId<OrderId>(orderId));
  if (delivery === null) notFound();

  const held = `${delivery.currency} ${major(BigInt(delivery.heldMinor))}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Confirm delivery"
        description={`${delivery.productName} · ${delivery.quantity} units · ${delivery.manufacturerName}`}
        breadcrumbs={
          <Crumbs
            items={[
              { label: 'Manufacturing', href: '/manufacturing' },
              { label: 'Active Orders', href: '/manufacturing/orders' },
              { label: 'Order', href: `/manufacturing/orders/${orderId}` },
              { label: 'Confirm delivery' },
            ]}
          />
        }
        actions={<StatusChip status={delivery.status} withDot />}
      />

      {!delivery.canConfirmDelivery && (
        <Alert
          tone="info"
          title="This order cannot be confirmed"
          actions={
            <Link
              href={`/manufacturing/orders/${orderId}`}
              className={buttonAppearance({ variant: 'secondary' })}
            >
              Back to the order
            </Link>
          }
        >
          {delivery.confirmBlockedReason ??
            'Delivery is confirmed once the manufacturer has recorded it.'}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              title="What confirming does"
              description="One action, three consequences. All of them are recorded."
            />
            <ol className="mt-4 flex flex-col gap-2.5">
              {[
                `${held} leaves escrow and is released to ${delivery.manufacturerName}.`,
                'The order is marked complete, which closes production.',
                'Your confirmation is kept as evidence, with anything you write below.',
              ].map((line, index) => (
                <li key={line} className="max-w-measure flex gap-2 text-sm text-text-secondary">
                  <span
                    aria-hidden
                    className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg-brand-subtle text-[11px] font-semibold text-text-brand"
                  >
                    {index + 1}
                  </span>
                  {line}
                </li>
              ))}
            </ol>
          </Card>

          {delivery.canConfirmDelivery && (
            <Card>
              <CardHeader title="Confirm" />
              <div className="mt-4">
                <ConfirmDeliveryForm
                  orderId={orderId}
                  manufacturerName={delivery.manufacturerName}
                  heldLabel={held}
                />
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="If something is wrong"
              description="Both of these keep the money held while it is sorted out."
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/manufacturing/orders/${orderId}/refund`}
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                Request a refund
              </Link>
              <Link
                href={`/manufacturing/orders/${orderId}/dispute`}
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                Open a dispute
              </Link>
            </div>
            <Text tone="muted" size="xs" className="mt-3">
              A refund request or a dispute stops the payout, including the automatic
              release at the end of the review window.
            </Text>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card tone="brand">
            <CardHeader title="The review window" />
            <DefinitionList
              className="mt-3"
              items={[
                { label: 'Delivered', value: day(delivery.deliveredAt) },
                {
                  label: 'Window closes',
                  value: day(delivery.reviewWindowEndsAt),
                },
                {
                  label: 'Time left',
                  value: delivery.reviewWindowOpen
                    ? `${delivery.reviewWindowDaysLeft} day${delivery.reviewWindowDaysLeft === 1 ? '' : 's'}`
                    : 'Closed',
                },
                { label: 'Held by IDEEZA', value: held },
                { label: 'Payout', value: delivery.payoutStatus ?? 'Not created yet' },
              ]}
            />
            <Text size="sm" className="mt-3">
              The window is {REVIEW_WINDOW_DAYS} days from delivery. If you neither
              confirm nor raise an issue, its expiry is itself a documented event and
              the money is released to the manufacturer.
            </Text>
            <Text tone="muted" size="xs" className="mt-2">
              The length is an IDEEZA platform setting, not part of the accepted terms.
            </Text>
          </Card>

          <Card>
            <CardHeader title="Delivery record" />
            {delivery.deliveryRecords.length === 0 ? (
              <Text tone="muted" size="sm" className="mt-3">
                Nothing recorded against shipping or delivery yet.
              </Text>
            ) : (
              <ul aria-label="Delivery record" className="mt-3 flex flex-col gap-2">
                {delivery.deliveryRecords.map((record) => (
                  <li key={record.id} className="text-sm">
                    <p className="font-semibold text-text-primary">{record.title}</p>
                    <Text tone="muted" size="xs">
                      {record.kind.replace(/_/g, ' ')} · {day(record.capturedAt)}
                    </Text>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeliveryPage;
