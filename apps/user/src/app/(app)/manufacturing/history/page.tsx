import { HubSection } from '@/components/hub-section.js';
import { HistoryList } from '@/components/order/history-list.js';
import { major } from '@/components/rfq/quote-money.js';
import { listHistory } from '@/data/delivery.js';
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
 * The Order History tab.
 *
 * A delivered order appears here as well as in Active Orders: nothing is being
 * made any more, and what is left is the buyer's decision about it. The row
 * carries the real outcome rather than one label for every past order.
 */
const Page = async () => {
  const actor = await requireBuyer('/manufacturing/history');
  const [orders, counts] = await Promise.all([
    listHistory(actor.userId),
    hubCounts(actor.userId),
  ]);

  return (
    <HubSection
      path={'/manufacturing/history'}
      activeId="history"
      panel={
        <HistoryList
          orders={orders.map((row) => ({
            orderId: String(row.orderId),
            rfqId: row.rfqId,
            productName: row.productName,
            manufacturerName: row.manufacturerName,
            status: row.status,
            outcome: row.outcome,
            currency: row.currency,
            totalMajor: major(BigInt(row.totalMinor)),
            fileCount: row.fileCount,
            typesIncluded:
              row.requestedServices.length === 0
                ? [KIND_TAG[row.packageKind] ?? row.packageKind]
                : row.requestedServices.map(
                    (service) => SERVICE_TAG[service] ?? service.replace(/_/g, ' '),
                  ),
            closedOn: day(row.closedAt),
            reviewed: row.reviewed,
            canReview: row.canReview,
            reviewWindowDaysLeft: row.reviewWindowDaysLeft,
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
