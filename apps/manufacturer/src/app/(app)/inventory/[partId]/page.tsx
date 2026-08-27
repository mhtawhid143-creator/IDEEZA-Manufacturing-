import { notFound } from 'next/navigation';
import {
  Alert,
  Card,
  CardHeader,
  DefinitionList,
  EmptyState,
  Tag,
  Text,
} from '@ideeza/ui';
import type { StockMovement } from '@ideeza/domain';
import { Crumbs } from '@/components/crumbs.js';
import { PartForm } from '@/components/inventory/part-form.js';
import { StockControls } from '@/components/inventory/stock-controls.js';
import { getPart, listParts } from '@/data/inventory.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const day = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);

const when = (value: Date): string =>
  `${value.toISOString().slice(0, 10)} at ${value.toISOString().slice(11, 16)} UTC`;

const major = (minor: number): string => (minor / 100).toFixed(2);

const MOVEMENT_WORDS: Readonly<Record<StockMovement, string>> = {
  stock_in: 'Stock in',
  stock_out: 'Stock out',
  stock_count: 'Counted',
  price_change: 'Price changed',
  reserved: 'Reserved for an order',
  released: 'Released from an order',
};

const LEVEL_WORDS: Readonly<Record<string, string>> = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
};

/**
 * One part, and every movement behind its numbers.
 *
 * The history is the point of this screen: a stock figure that cannot be
 * explained is a stock figure nobody should quote from. It is append-only — the
 * database refuses updates to it — so what it says happened, happened.
 */
const PartDetailPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly partId: string }>;
}) => {
  const { partId } = await params;
  const actor = await requireManufacturer(`/inventory/${partId}`);

  const part = await getPart(actor.manufacturerId, partId);
  if (part === null) notFound();
  const { categories } = await listParts(actor.manufacturerId, { pageSize: 1 });

  return (
    <div className="flex flex-col gap-6">
      <Crumbs
        items={[{ label: 'Inventory', href: '/inventory' }, { label: part.partName }]}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <h1 className="text-xl font-bold text-heading">{part.partName}</h1>
              <Text tone="muted" size="sm">
                {part.sku} · {part.category}
              </Text>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Tag
                tone={
                  part.level === 'in_stock'
                    ? 'success'
                    : part.level === 'low_stock'
                      ? 'warning'
                      : 'danger'
                }
              >
                {LEVEL_WORDS[part.level] ?? part.level}
              </Tag>
              {!part.enabledForMatching && <Tag tone="neutral">Not matched</Tag>}
            </div>
          </div>

          <Card>
            <CardHeader
              title="What this part is"
              description="Everything here is what a request is matched against."
            />
            <DefinitionList
              className="mt-4"
              columns={2}
              items={[
                { label: 'On the shelf', value: `${part.stockQuantity} pcs` },
                { label: 'Reserved for orders', value: `${part.reservedQuantity} pcs` },
                { label: 'Free to promise', value: `${part.available} pcs` },
                { label: 'Low stock below', value: `${part.lowStockThreshold} pcs` },
                {
                  label: 'Price per unit',
                  value: `${part.currency} ${major(part.unitCostMinor)}`,
                },
                { label: 'Lead time', value: `${part.leadTimeDays} days` },
                {
                  label: 'Minimum order quantity',
                  value:
                    part.minimumOrderQuantity === null
                      ? 'None'
                      : `${part.minimumOrderQuantity} pcs`,
                },
                { label: 'Storage location', value: part.storageLocation ?? 'Not given' },
                { label: 'Last counted', value: day(part.lastCountedAt) },
                {
                  label: 'Matched to requests',
                  value: part.enabledForMatching ? 'Yes' : 'No',
                },
              ]}
            />
          </Card>

          <Card padded={false}>
            <div className="px-4 py-4 md:px-6">
              <CardHeader
                title="Movement history"
                description="Append-only: every figure above is the result of one of these."
              />
            </div>

            {part.movements.length === 0 ? (
              <div className="px-4 pb-6 md:px-6">
                <EmptyState
                  title="No movements yet"
                  description="Adding the part recorded its opening count; anything after that appears here."
                />
              </div>
            ) : (
              <ol aria-label="Movement history" className="border-t border-line">
                {part.movements.map((movement) => (
                  <li
                    key={movement.id}
                    className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0 md:px-6"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-heading">
                        {MOVEMENT_WORDS[movement.kind]}
                        {movement.kind === 'price_change'
                          ? movement.unitCostMinor === null
                            ? ''
                            : ` to ${part.currency} ${major(movement.unitCostMinor)}`
                          : ` ${movement.quantityDelta > 0 ? '+' : ''}${movement.quantityDelta} pcs`}
                      </p>
                      <Text tone="muted" size="xs">
                        left {movement.resultingStock} on the shelf ·{' '}
                        {movement.resultingReserved} reserved
                        {movement.actorName === null ? '' : ` · ${movement.actorName}`}
                        {movement.orderId === null ? '' : ` · order ${movement.orderId}`}
                      </Text>
                      {movement.note !== null && (
                        <Text size="sm" className="mt-1 block">
                          {movement.note}
                        </Text>
                      )}
                    </div>
                    <Text tone="muted" size="xs">
                      {when(movement.occurredAt)}
                    </Text>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <Text size="sm" className="font-semibold text-heading">
              Change this part
            </Text>
            <StockControls
              partId={part.id}
              partName={part.partName}
              currency={part.currency}
              stockQuantity={part.stockQuantity}
              reservedQuantity={part.reservedQuantity}
              unitPriceMajor={major(part.unitCostMinor)}
              deletable={part.deletable}
              undeletableReason={part.undeletableReason}
            />
            <PartForm
              mode="edit"
              currency={part.currency}
              categories={categories}
              triggerVariant="secondary"
              trigger="Edit what it is"
              defaults={{
                partId: part.id,
                partName: part.partName,
                sku: part.sku,
                category: part.category,
                lowStockThreshold: String(part.lowStockThreshold),
                leadTimeDays: String(part.leadTimeDays),
                minimumOrderQuantity:
                  part.minimumOrderQuantity === null
                    ? ''
                    : String(part.minimumOrderQuantity),
                storageLocation: part.storageLocation ?? '',
                enabledForMatching: part.enabledForMatching,
              }}
            />
          </Card>

          {part.reservedQuantity > 0 && (
            <Alert tone="info" title="Some of this stock is promised">
              {part.reservedQuantity} parts are reserved for confirmed orders. They are
              not available to quote from, and they cannot be taken out or counted away
              until the order releases them.
            </Alert>
          )}

          {part.suggestionCount > 0 && (
            <Alert tone="info" title="This part has been suggested to a buyer">
              It has been offered as a substitute {part.suggestionCount}{' '}
              {part.suggestionCount === 1 ? 'time' : 'times'}, so it stays on the record.
              Switch it off for matching if you no longer want it offered.
            </Alert>
          )}

          {!part.enabledForMatching && (
            <Alert tone="warning" title="Not matched to requests">
              This part counts for nothing when a buyer&rsquo;s bill of materials is
              matched against your stock.
            </Alert>
          )}
        </aside>
      </div>
    </div>
  );
};

export default PartDetailPage;
