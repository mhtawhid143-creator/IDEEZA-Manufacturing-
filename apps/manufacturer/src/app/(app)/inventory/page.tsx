import { Card, PageHeader, Text, majorAmount as major } from '@ideeza/ui';
import { STOCK_STATES, type StockLevel } from '@ideeza/domain';
import { InventoryCards } from '@/components/inventory/inventory-cards.js';
import { PartForm } from '@/components/inventory/part-form.js';
import { PartList } from '@/components/inventory/part-list.js';
import { inventoryCounters, listParts } from '@/data/inventory.js';
import { getShopContext } from '@/data/shop.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const day = (value: Date): string => value.toISOString().slice(0, 10);

const levelFilter = (value: string | undefined): StockLevel | 'all' =>
  value !== undefined && (STOCK_STATES as readonly string[]).includes(value)
    ? (value as StockLevel)
    : 'all';

const matchingFilter = (value: string | undefined): 'all' | 'enabled' | 'disabled' =>
  value === 'enabled' || value === 'disabled' ? value : 'all';

const pageNumber = (value: string | undefined): number => {
  const parsed = Number(value ?? '1');
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
};

/**
 * Inventory management: what this shop holds.
 *
 * This is not a warehouse system; it is what the platform matches a buyer's bill
 * of materials against. So every figure here is the one that decides whether a
 * request can be answered — availability rather than stock, and the lead time and
 * unit cost a substitute's impact is worked out from.
 */
const InventoryPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const actor = await requireManufacturer('/inventory');
  const query = await searchParams;
  const single = (key: string): string | undefined => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const category = single('category') ?? 'all';
  const level = levelFilter(single('level'));
  const matching = matchingFilter(single('matching'));
  const reserved = single('reserved') === 'reserved' ? 'reserved' : 'all';
  const search = single('q') ?? '';

  const [counters, parts, shop] = await Promise.all([
    inventoryCounters(actor.manufacturerId),
    listParts(actor.manufacturerId, {
      search,
      category,
      level,
      matching,
      reserved,
      page: pageNumber(single('page')),
    }),
    getShopContext(actor.manufacturerId, actor.userId),
  ]);

  const currency = parts.rows[0]?.currency ?? 'USD';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventory management"
        description="The parts you hold, and what is free to promise."
        actions={
          <PartForm mode="add" currency={currency} categories={parts.categories} />
        }
      />

      {/*
        The counts, and the filter they are (UIUX-220). "Stock at cost" is the
        one that stays a plain card — it is money (UIUX-218), not a set of rows,
        so there is nothing for it to narrow the table to.
      */}
      <InventoryCards
        totalSkus={counters.totalSkus}
        disabled={counters.disabled}
        valueMajor={major(counters.inventoryValueMinor)}
        valueLabel={counters.currency}
        lowStock={counters.lowStock}
        outOfStock={counters.outOfStock}
        reservedParts={counters.reservedParts}
      />

      <Card padded={false}>
        <div className="flex flex-col gap-4 p-4 md:p-6">
          <PartList
            categories={parts.categories}
            page={parts.page}
            pageCount={parts.pageCount}
            filtered={
              category !== 'all' ||
              level !== 'all' ||
              matching !== 'all' ||
              search.trim() !== ''
            }
            rows={parts.rows.map((row) => ({
              id: row.id,
              partName: row.partName,
              sku: row.sku,
              category: row.category,
              available: row.available,
              stockQuantity: row.stockQuantity,
              reservedQuantity: row.reservedQuantity,
              unitPriceMajor: major(row.unitCostMinor),
              currency: row.currency,
              level: row.level,
              enabledForMatching: row.enabledForMatching,
              updatedOn: day(row.updatedAt),
            }))}
          />
        </div>
      </Card>

      <Card tone="brand">
        <p className="text-sm font-semibold text-text-primary">
          What your inventory decides
        </p>
        <Text size="sm" className="mt-2 block">
          A request&rsquo;s bill of materials is matched against these parts by SKU.
          What you hold enough of is covered; what you are short of has to be
          answered before you quote — with a substitute you suggest, or by sourcing
          the part as specified. A part switched off for matching counts for
          nothing, and neither does stock already reserved for an order.
          {shop !== null && !shop.verified && (
            <>
              {' '}
              Your shop is not verified yet, so buyers may not see it at all.
            </>
          )}
        </Text>
      </Card>
    </div>
  );
};

export default InventoryPage;
