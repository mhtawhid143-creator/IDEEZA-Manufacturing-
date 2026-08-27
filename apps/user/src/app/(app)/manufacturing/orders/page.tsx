import { HubSection } from '@/components/hub-section.js';
import { OrderList } from '@/components/order/order-list.js';
import { major } from '@/components/rfq/quote-money.js';
import { ACTIVE_ORDER_STATUSES, listOrders } from '@/data/orders.js';
import { hubCounts } from '@/data/requests.js';
import { requireBuyer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const SERVICE_TAG: Readonly<Record<string, string>> = {
  pcb_fabrication: 'PCB',
  pcb_assembly: 'Assembly',
  parts_sourcing: 'Parts',
  enclosure_3d: '3D',
  stencil: 'Stencil',
  testing: 'Test',
};

const KIND_TAG: Readonly<Record<string, string>> = {
  pcb: 'PCB',
  module_3d: '3D',
  full_product: 'Full product',
};

const day = (value: Date): string => value.toISOString().slice(0, 10);

/**
 * The Active Orders tab.
 *
 * "Active" is every order that is still moving, including one that is only
 * awaiting payment: the buyer has something to do on it, so hiding it would lose
 * the order. Finished orders live in Order History.
 */
const Page = async () => {
  const actor = await requireBuyer('/manufacturing/orders');
  const [orders, counts] = await Promise.all([
    listOrders(actor.userId, ACTIVE_ORDER_STATUSES),
    hubCounts(actor.userId),
  ]);

  return (
    <HubSection
      path={'/manufacturing/orders'}
      activeId="active"
      panel={
        <OrderList
          emptyTitle="No active orders"
          emptyDescription="An order opens when you accept a quote, and is confirmed once IDEEZA holds the funds."
          orders={orders.map((order) => ({
            orderId: String(order.orderId),
            rfqId: String(order.rfqId),
            productName: order.productName,
            manufacturerName: order.manufacturerName,
            status: order.status,
            quantity: order.quantity,
            currency: order.currency,
            totalMajor: major(order.totalPriceMinor),
            fileCount: order.fileCount,
            typesIncluded:
              order.requestedServices.length === 0
                ? [KIND_TAG[order.packageKind] ?? order.packageKind]
                : order.requestedServices.map(
                    (service) => SERVICE_TAG[service] ?? service.replace(/_/g, ' '),
                  ),
            openAlertCount: order.openAlertCount,
            orderedOn: day(order.confirmedAt ?? order.createdAt),
          }))}
        />
      }
      counts={{
        draft: counts.drafts,
        requests: counts.requests,
        active: counts.active,
        history: counts.history,
      }}
    />
  );
};

export default Page;
