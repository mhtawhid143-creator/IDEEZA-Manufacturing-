import { notFound } from 'next/navigation';
import { Alert, Card, CardHeader, EmptyState, Tag, Text } from '@ideeza/ui';
import { asId, type OrderId, type RfqId } from '@ideeza/domain';
import { OrderShell } from '@/components/order/order-shell.js';
import { REVIEW_WINDOW_DAYS } from '@/lib/review-window.js';
import { getClientProfile } from '@/data/clients.js';
import { getOrder } from '@/data/orders.js';
import { getRoutedRequest, type RequestFile } from '@/data/rfqs.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Readonly<Record<RequestFile['kind'], string>> = {
  pcb: 'Board data',
  model_3d: '3D model',
  document: 'Document',
};

const size = (bytes: number): string =>
  bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Production files on an order: the same files the request carried.
 *
 * They are read through the request, because that is where they live — an order
 * does not get its own copy, so there is no way for the two to drift apart.
 */
const OrderFilesPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly orderId: string }>;
}) => {
  const { orderId } = await params;
  const actor = await requireManufacturer(`/orders/${orderId}/files`);
  const order = await getOrder(actor.manufacturerId, asId<OrderId>(orderId));
  if (order === null) notFound();

  const [client, request] = await Promise.all([
    getClientProfile(order.buyerId, actor.manufacturerId),
    getRoutedRequest(actor.manufacturerId, asId<RfqId>(order.rfqId)),
  ]);

  const files = request?.files ?? [];

  return (
    <OrderShell
      order={order}
      client={client}
      creatorName={order.creatorName}
      activeTab="files"
      reviewWindowDays={REVIEW_WINDOW_DAYS}
      stock={[]}
    >
      <Card padded={false}>
        <div className="px-4 py-4 md:px-6">
          <CardHeader
            title={`${order.productName} — production files`}
            description="The files that came with the request, unchanged."
          />
        </div>

        {files.length === 0 ? (
          <div className="px-4 pb-6 md:px-6">
            <EmptyState
              title="No production files on the request"
              description="Nothing was attached to the package this order came from."
            />
          </div>
        ) : (
          <ul aria-label="Production files" className="border-t border-border-subtle">
            {files.map((file) => (
              <li
                key={file.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0 md:px-6"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-surface-raised text-xs font-semibold text-text-tertiary"
                  >
                    {file.name.split('.').pop()?.slice(0, 4).toUpperCase() ?? 'FILE'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {file.name}
                    </p>
                    <Text tone="muted" size="xs">
                      {KIND_LABEL[file.kind]} · {size(file.byteSize)} · rev{' '}
                      {file.revision}
                    </Text>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tag tone="neutral">{KIND_LABEL[file.kind]}</Tag>
                  <code className="rounded bg-bg-surface-raised px-2 py-1 text-[11px] text-text-tertiary">
                    {file.contentHash.slice(0, 12)}…
                  </code>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Alert tone="info" title="File contents are not served in this environment">
        The platform records each file&rsquo;s name, revision, size and content hash. The
        hash is what you check the file against, and it is the same hash the buyer sees
        — so if what you were sent differs from what they think they sent, it shows.
      </Alert>
    </OrderShell>
  );
};

export default OrderFilesPage;
