import { notFound } from 'next/navigation';
import { Card, CardHeader, DefinitionList, Text, majorAmount as major } from '@ideeza/ui';
import { asId, type OrderId } from '@ideeza/domain';
import { OrderShell } from '@/components/order/order-shell.js';
import { REVIEW_WINDOW_DAYS } from '@/lib/review-window.js';
import { getClientProfile } from '@/data/clients.js';
import { getOrder } from '@/data/orders.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const day = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);


/**
 * Quote Details: the terms this order was opened against.
 *
 * They come from the immutable snapshot taken when the buyer accepted, not from
 * the quote row — the quote could in principle have been revised afterwards, and
 * what binds both sides is what was accepted. The checksum is shown because that
 * is what makes the claim checkable.
 */
const OrderTermsPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly orderId: string }>;
}) => {
  const { orderId } = await params;
  const actor = await requireManufacturer(`/orders/${orderId}/quote`);
  const order = await getOrder(actor.manufacturerId, asId<OrderId>(orderId));
  if (order === null) notFound();
  const client = await getClientProfile(order.buyerId, actor.manufacturerId);

  const goods = order.totalPriceMinor;
  const landed =
    goods + (order.shippingEstimateMinor ?? 0) + (order.toolingSetupCostMinor ?? 0);

  return (
    <OrderShell
      order={order}
      client={client}
      creatorName={order.creatorName}
      activeTab="quote"
      reviewWindowDays={REVIEW_WINDOW_DAYS}
      stock={[]}
    >
      <Card>
        <CardHeader
          title="The terms this order was opened against"
          description="Frozen when the buyer accepted. Neither side can change them now."
        />
        <DefinitionList
          className="mt-4"
          columns={2}
          items={[
            { label: 'Order', value: order.orderId },
            { label: 'Quote', value: order.quoteId },
            { label: 'Request', value: order.rfqId },
            { label: 'Quantity', value: `${order.quantity} units` },
            {
              label: 'Unit price',
              value: `${order.currency} ${major(order.unitPriceMinor)}`,
            },
            { label: 'Goods', value: `${order.currency} ${major(goods)}` },
            {
              label: 'Shipping estimate',
              value:
                order.shippingEstimateMinor === null
                  ? 'Not quoted'
                  : `${order.currency} ${major(order.shippingEstimateMinor)}`,
            },
            {
              label: 'Tooling and setup',
              value:
                order.toolingSetupCostMinor === null
                  ? 'None'
                  : `${order.currency} ${major(order.toolingSetupCostMinor)}`,
            },
            { label: 'Landed total', value: `${order.currency} ${major(landed)}` },
            { label: 'Lead time', value: `${order.leadTimeDays} days` },
            { label: 'Shipping choice', value: order.shippingChoice.replace(/_/g, ' ') },
            { label: 'Confirmed', value: day(order.confirmedAt) },
          ]}
        />
        <Text tone="muted" size="xs" className="mt-4 block">
          Snapshot checksum {order.snapshotChecksum.slice(0, 16)}… — the platform can
          prove these terms have not moved since the buyer accepted them.
        </Text>
      </Card>

      <Card>
        <CardHeader title="Materials, process and terms" />
        <Text size="sm" className="mt-3 block whitespace-pre-line">
          {order.materialProcessNotes}
        </Text>
        <div className="mt-4 border-t border-border-subtle pt-4">
          <p className="text-xs font-semibold uppercase tracking-caps text-text-tertiary">
            Terms
          </p>
          <Text size="sm" className="mt-1 block whitespace-pre-line">
            {order.terms}
          </Text>
        </div>
        {order.warrantyTerms !== null && (
          <div className="mt-4 border-t border-border-subtle pt-4">
            <p className="text-xs font-semibold uppercase tracking-caps text-text-tertiary">
              Warranty
            </p>
            <Text size="sm" className="mt-1 block whitespace-pre-line">
              {order.warrantyTerms}
            </Text>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Where it is going"
          description="The address the buyer gave at checkout."
        />
        <DefinitionList
          className="mt-4"
          columns={2}
          items={[
            { label: 'Line 1', value: order.shipTo.line1 },
            { label: 'Line 2', value: order.shipTo.line2 ?? '—' },
            { label: 'City', value: order.shipTo.city },
            { label: 'Region', value: order.shipTo.region ?? '—' },
            { label: 'Postal code', value: order.shipTo.postalCode ?? '—' },
            { label: 'Country', value: order.shipTo.countryCode },
          ]}
        />
      </Card>

      {order.approvedSubstitutionIds.length > 0 && (
        <Card tone="brand">
          <CardHeader
            title="Substitutes the buyer approved"
            description="Named in the accepted terms, so what you build is what they agreed to."
          />
          <Text size="sm" className="mt-2 block">
            {order.approvedSubstitutionIds.length} approved substitution
            {order.approvedSubstitutionIds.length === 1 ? '' : 's'} travel with this
            order. Anything else you cannot source has to be raised as a shortage.
          </Text>
        </Card>
      )}
    </OrderShell>
  );
};

export default OrderTermsPage;
