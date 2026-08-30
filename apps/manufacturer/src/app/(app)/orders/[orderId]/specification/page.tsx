import { notFound } from 'next/navigation';
import { Alert, Card, CardHeader, Text } from '@ideeza/ui';
import {
  OPEN_ANSWER,
  asId,
  type DocumentRow,
  type OrderId,
  type RfqId,
} from '@ideeza/domain';
import { OrderShell } from '@/components/order/order-shell.js';
import { REVIEW_WINDOW_DAYS } from '@/lib/review-window.js';
import { getClientProfile } from '@/data/clients.js';
import { getOrder } from '@/data/orders.js';
import { getRoutedRequest } from '@/data/rfqs.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

/** The same grid the request's specification uses, for the same document. */
const SpecGrid = ({ rows }: { readonly rows: readonly DocumentRow[] }) => (
  <dl className="mt-4 grid grid-cols-1 overflow-hidden rounded-lg border border-border-subtle md:grid-cols-2">
    {rows.map((row, index) => (
      <div
        key={row.label}
        className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 border-b border-border-subtle px-3 py-2.5 md:[&:nth-last-child(-n+2)]:border-b-0 ${
          index % 2 === 0 ? 'md:border-r' : ''
        }`}
      >
        <dt className="text-sm text-text-tertiary">{row.label}</dt>
        <dd
          className={
            row.value === OPEN_ANSWER
              ? 'text-sm italic text-text-tertiary'
              : 'text-sm font-medium text-text-primary'
          }
        >
          {row.value}
        </dd>
      </div>
    ))}
  </dl>
);

/**
 * The specification this order is built to.
 *
 * Read by the same domain function as the request and the buyer's own screens, so
 * an order in production is never built to a differently worded version of what
 * was agreed.
 */
const OrderSpecificationPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly orderId: string }>;
}) => {
  const { orderId } = await params;
  const actor = await requireManufacturer(`/orders/${orderId}/specification`);
  const order = await getOrder(actor.manufacturerId, asId<OrderId>(orderId));
  if (order === null) notFound();

  const [client, request] = await Promise.all([
    getClientProfile(order.buyerId, actor.manufacturerId),
    getRoutedRequest(actor.manufacturerId, asId<RfqId>(order.rfqId)),
  ]);

  return (
    <OrderShell
      order={order}
      client={client}
      creatorName={order.creatorName}
      activeTab="specification"
      reviewWindowDays={REVIEW_WINDOW_DAYS}
      stock={[]}
    >
      {request === null ? (
        <Alert tone="warning" title="The request behind this order is not readable">
          Its routing record is gone, so the specification cannot be shown here. The
          terms on the Quote Details tab are the binding ones either way.
        </Alert>
      ) : (
        <>
          <Card>
            <CardHeader
              title="Production requirement"
              description="What the buyer specified, frozen when the request was sent."
            />
            <SpecGrid rows={request.requirementRows} />
          </Card>

          {request.hasBoard && request.boardSpecRows.length > 0 && (
            <Card>
              <CardHeader
                title={`${order.productName} — board specification`}
                description="The fabrication detail this order is built to."
              />
              <SpecGrid rows={request.boardSpecRows} />
            </Card>
          )}

          <Card tone="brand">
            <CardHeader title="If reality disagrees with this" />
            <Text size="sm" className="mt-2 block">
              Raise it rather than working around it. A part you cannot source is a
              shortage the buyer decides on; anything else that stops you building to
              this specification is a message or a cancellation request — not a
              substitution made quietly on the floor.
            </Text>
          </Card>
        </>
      )}
    </OrderShell>
  );
};

export default OrderSpecificationPage;
