import { notFound } from 'next/navigation';
import { Card, CardHeader, Text } from '@ideeza/ui';
import { OrderItems } from '@/components/order/order-items.js';
import { OrderShell } from '@/components/order/order-shell.js';
import { day, major } from '@/components/rfq/quote-money.js';
import { getOrder } from '@/data/orders.js';
import { getOrderItems, getProduction } from '@/data/production.js';
import { requireBuyer } from '@/lib/auth.js';
import { asId, type OrderId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

/**
 * Product Details: every line the accepted quote priced, and the spec it was
 * priced against.
 *
 * The design groups the lines by kind of work. Nothing in this domain classifies
 * an individual quote line as a board or a printed part — the kind belongs to the
 * package — so the grouping follows the package and says so, rather than guessing
 * a kind per row.
 */
const ItemsPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly orderId: string }>;
}) => {
  const { orderId } = await params;
  const actor = await requireBuyer(`/manufacturing/orders/${orderId}/items`);
  const id = asId<OrderId>(orderId);

  const [order, groups, production] = await Promise.all([
    getOrder(actor.userId, id),
    getOrderItems(actor.userId, id),
    getProduction(actor.userId, id),
  ]);
  if (order === null) notFound();

  return (
    <OrderShell
      order={order}
      activeTab="items"
      schedule={{
        orderedOn: day(order.confirmedAt ?? order.createdAt),
        estimatedShip:
          production?.schedule == null ? null : day(production.schedule.estimatedShipAt),
        estimatedDelivery:
          production?.schedule == null
            ? null
            : day(production.schedule.estimatedDeliveryAt),
      }}
    >
      <OrderItems
        currency={order.currency}
        spec={order.specRows}
        groups={groups.map((group) => ({
          id: group.id,
          title: group.title,
          grandTotalMajor: major(BigInt(group.grandTotalMinor)),
          items: group.items.map((item) => ({
            id: item.id,
            name: item.name,
            detail: item.detail,
            quantity: item.quantity,
            unitPriceMajor: major(BigInt(item.unitPriceMinor)),
            lineTotalMajor: major(BigInt(item.lineTotalMinor)),
            reference: item.reference,
            manufacturerPartNumber: item.manufacturerPartNumber,
            sku: item.sku,
          })),
        }))}
      />

      <Card>
        <CardHeader title="What these prices are" />
        <Text size="sm" className="mt-2">
          Every figure here is the manufacturer&rsquo;s own quoted line, frozen when you
          accepted the quote. Shipping, the platform fee and any coupon sit on the order,
          not on a line, and are shown in the order summary.
        </Text>
      </Card>
    </OrderShell>
  );
};

export default ItemsPage;
