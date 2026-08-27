import {
  applyStockChange,
  assertPartDefinitionUsable,
  assertPartDeletable,
  availableStock,
  stockLevelOf,
  type ManufacturerId,
  type StockLevel,
  type StockMovement,
  type UserId,
} from '@ideeza/domain';
import { database } from '@/lib/db.js';

const identifier = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export interface PartRow {
  readonly id: string;
  readonly partName: string;
  readonly sku: string;
  readonly category: string;
  readonly stockQuantity: number;
  readonly reservedQuantity: number;
  readonly available: number;
  readonly lowStockThreshold: number;
  readonly level: StockLevel;
  readonly currency: string;
  readonly unitCostMinor: number;
  readonly leadTimeDays: number;
  readonly minimumOrderQuantity: number | null;
  readonly storageLocation: string | null;
  readonly enabledForMatching: boolean;
  readonly updatedAt: Date;
  readonly lastCountedAt: Date | null;
}

export interface InventoryCounters {
  readonly totalSkus: number;
  readonly lowStock: number;
  readonly outOfStock: number;
  readonly disabled: number;
  readonly reservedParts: number;
}

export interface InventoryFilters {
  readonly search?: string;
  readonly category?: string | 'all';
  readonly level?: StockLevel | 'all';
  /** The design's "All Parts": everything, only matched, or only switched off. */
  readonly matching?: 'all' | 'enabled' | 'disabled';
  readonly page?: number;
  readonly pageSize?: number;
}

export interface InventoryPage {
  readonly rows: readonly PartRow[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
  readonly categories: readonly string[];
}

const toRow = (item: {
  readonly id: string;
  readonly partName: string;
  readonly sku: string;
  readonly category: string;
  readonly stockQuantity: number;
  readonly reservedQuantity: number;
  readonly lowStockThreshold: number;
  readonly currency: string;
  readonly unitCostMinor: bigint;
  readonly leadTimeDays: number;
  readonly minimumOrderQuantity: number | null;
  readonly storageLocation: string | null;
  readonly enabledForMatching: boolean;
  readonly updatedAt: Date;
  readonly lastCountedAt: Date | null;
}): PartRow => ({
  id: item.id,
  partName: item.partName,
  sku: item.sku,
  category: item.category,
  stockQuantity: item.stockQuantity,
  reservedQuantity: item.reservedQuantity,
  available: availableStock(item),
  lowStockThreshold: item.lowStockThreshold,
  level: stockLevelOf(item),
  currency: item.currency,
  unitCostMinor: Number(item.unitCostMinor),
  leadTimeDays: item.leadTimeDays,
  minimumOrderQuantity: item.minimumOrderQuantity,
  storageLocation: item.storageLocation,
  enabledForMatching: item.enabledForMatching,
  updatedAt: item.updatedAt,
  lastCountedAt: item.lastCountedAt,
});

/**
 * This shop's parts.
 *
 * The status column is availability rather than stock, because what is already
 * promised to an order cannot be promised again — and quoting is the only thing
 * this figure is for. Filtering by level therefore happens after the rows are
 * read: it is a judgement about two columns, not a stored value.
 */
export const listParts = async (
  manufacturerId: ManufacturerId,
  filters: InventoryFilters = {},
): Promise<InventoryPage> => {
  const search = filters.search?.trim() ?? '';
  const pageSize = filters.pageSize ?? 12;

  const where = {
    manufacturerId,
    ...(filters.category === undefined || filters.category === 'all'
      ? {}
      : { category: filters.category }),
    ...(filters.matching === undefined || filters.matching === 'all'
      ? {}
      : { enabledForMatching: filters.matching === 'enabled' }),
    ...(search === ''
      ? {}
      : {
          OR: [
            { partName: { contains: search, mode: 'insensitive' as const } },
            { sku: { contains: search, mode: 'insensitive' as const } },
          ],
        }),
  };

  const all = await database().inventoryItem.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }],
  });

  const level = filters.level ?? 'all';
  const matching =
    level === 'all' ? all : all.filter((item) => stockLevelOf(item) === level);

  const total = matching.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const rows = matching
    .slice((page - 1) * pageSize, page * pageSize)
    .map((item) => toRow(item));

  const categories = await database().inventoryItem.findMany({
    where: { manufacturerId },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });

  return {
    rows,
    total,
    page,
    pageCount,
    categories: categories.map((row) => row.category),
  };
};

export const inventoryCounters = async (
  manufacturerId: ManufacturerId,
): Promise<InventoryCounters> => {
  const items = await database().inventoryItem.findMany({
    where: { manufacturerId },
    select: {
      stockQuantity: true,
      reservedQuantity: true,
      lowStockThreshold: true,
      enabledForMatching: true,
    },
  });

  return {
    totalSkus: items.length,
    lowStock: items.filter((item) => stockLevelOf(item) === 'low_stock').length,
    outOfStock: items.filter((item) => stockLevelOf(item) === 'out_of_stock').length,
    disabled: items.filter((item) => !item.enabledForMatching).length,
    reservedParts: items.reduce((total, item) => total + item.reservedQuantity, 0),
  };
};

export interface MovementRow {
  readonly id: string;
  readonly kind: StockMovement;
  readonly quantityDelta: number;
  readonly resultingStock: number;
  readonly resultingReserved: number;
  readonly unitCostMinor: number | null;
  readonly effectiveFrom: Date | null;
  readonly note: string | null;
  readonly orderId: string | null;
  readonly actorName: string | null;
  readonly occurredAt: Date;
}

export interface PartDetail extends PartRow {
  readonly movements: readonly MovementRow[];
  /** Whether this part has ever been suggested to a buyer as a substitute. */
  readonly suggestionCount: number;
  readonly deletable: boolean;
  readonly undeletableReason: string | null;
}

export const getPart = async (
  manufacturerId: ManufacturerId,
  partId: string,
): Promise<PartDetail | null> => {
  const item = await database().inventoryItem.findFirst({
    where: { id: partId, manufacturerId },
    include: {
      movements: {
        orderBy: { occurredAt: 'desc' },
        include: { actor: { select: { displayName: true } } },
      },
      _count: { select: { substitutions: true, movements: true } },
    },
  });
  if (item === null) return null;

  let undeletableReason: string | null = null;
  try {
    assertPartDeletable({
      reservedQuantity: item.reservedQuantity,
      suggestionCount: item._count.substitutions,
      movementCount: item._count.movements,
    });
  } catch (error) {
    undeletableReason =
      error instanceof Error ? error.message : 'this part cannot be deleted';
  }

  return {
    ...toRow(item),
    movements: item.movements.map((movement) => ({
      id: movement.id,
      kind: movement.kind,
      quantityDelta: movement.quantityDelta,
      resultingStock: movement.resultingStock,
      resultingReserved: movement.resultingReserved,
      unitCostMinor:
        movement.unitCostMinor === null ? null : Number(movement.unitCostMinor),
      effectiveFrom: movement.effectiveFrom,
      note: movement.note,
      orderId: movement.orderId,
      actorName: movement.actor?.displayName ?? null,
      occurredAt: movement.occurredAt,
    })),
    suggestionCount: item._count.substitutions,
    deletable: undeletableReason === null,
    undeletableReason,
  };
};

export interface PartInput {
  readonly partName: string;
  readonly sku: string;
  readonly category: string;
  readonly stockQuantity: number;
  readonly lowStockThreshold: number;
  readonly unitCostMinor: number;
  readonly currency: string;
  readonly leadTimeDays: number;
  readonly minimumOrderQuantity: number | null;
  readonly storageLocation: string | null;
  readonly enabledForMatching: boolean;
}

export type PartOutcome =
  | { readonly ok: true; readonly partId: string }
  | { readonly ok: false; readonly message: string };

/**
 * Adds a part, with its opening stock recorded as a movement.
 *
 * The opening figure is a count, not a delivery: it says what is on the shelf at
 * the moment the part is put on the platform, which is exactly what a count
 * means. From then on nothing changes the number without a movement behind it.
 */
export const addPart = async (
  manufacturerId: ManufacturerId,
  actorId: UserId,
  input: PartInput,
  now: Date = new Date(),
): Promise<PartOutcome> => {
  try {
    assertPartDefinitionUsable(input);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'that part cannot be added',
    };
  }

  const sku = input.sku.trim();
  const clash = await database().inventoryItem.findFirst({
    where: { manufacturerId, sku },
    select: { id: true },
  });
  if (clash !== null) {
    return { ok: false, message: `You already hold a part with the SKU ${sku}.` };
  }

  const partId = identifier('inv');

  await database().$transaction(async (transaction) => {
    await transaction.inventoryItem.create({
      data: {
        id: partId,
        manufacturerId,
        partName: input.partName.trim(),
        sku,
        category: input.category.trim(),
        stockQuantity: input.stockQuantity,
        reservedQuantity: 0,
        lowStockThreshold: input.lowStockThreshold,
        currency: input.currency,
        unitCostMinor: BigInt(input.unitCostMinor),
        leadTimeDays: input.leadTimeDays,
        minimumOrderQuantity: input.minimumOrderQuantity,
        storageLocation: input.storageLocation,
        enabledForMatching: input.enabledForMatching,
        lastCountedAt: now,
        createdAt: now,
      },
    });
    await transaction.inventoryMovement.create({
      data: {
        id: identifier('mov'),
        itemId: partId,
        kind: 'stock_count',
        quantityDelta: input.stockQuantity,
        resultingStock: input.stockQuantity,
        resultingReserved: 0,
        unitCostMinor: BigInt(input.unitCostMinor),
        note: 'Opening stock when the part was added',
        actorUserId: actorId,
        occurredAt: now,
      },
    });
  });

  return { ok: true, partId };
};

export interface PartEdit {
  readonly partName?: string;
  readonly category?: string;
  readonly lowStockThreshold?: number;
  readonly leadTimeDays?: number;
  readonly minimumOrderQuantity?: number | null;
  readonly storageLocation?: string | null;
  readonly enabledForMatching?: boolean;
}

/**
 * Edits what a part *is*, never how much of it there is.
 *
 * Quantities and prices move through their own recorded movements. Keeping the
 * two apart is what stops a stock figure being changed by editing a form.
 */
export const editPart = async (
  manufacturerId: ManufacturerId,
  partId: string,
  edit: PartEdit,
): Promise<PartOutcome> => {
  const item = await database().inventoryItem.findFirst({
    where: { id: partId, manufacturerId },
  });
  if (item === null) return { ok: false, message: 'That part is not in your inventory.' };

  try {
    assertPartDefinitionUsable({
      partName: edit.partName ?? item.partName,
      sku: item.sku,
      category: edit.category ?? item.category,
      stockQuantity: item.stockQuantity,
      lowStockThreshold: edit.lowStockThreshold ?? item.lowStockThreshold,
      unitCostMinor: Number(item.unitCostMinor),
      leadTimeDays: edit.leadTimeDays ?? item.leadTimeDays,
      minimumOrderQuantity:
        edit.minimumOrderQuantity === undefined
          ? item.minimumOrderQuantity
          : edit.minimumOrderQuantity,
      storageLocation:
        edit.storageLocation === undefined ? item.storageLocation : edit.storageLocation,
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'that change cannot be saved',
    };
  }

  await database().inventoryItem.update({
    where: { id: partId },
    data: {
      ...(edit.partName === undefined ? {} : { partName: edit.partName.trim() }),
      ...(edit.category === undefined ? {} : { category: edit.category.trim() }),
      ...(edit.lowStockThreshold === undefined
        ? {}
        : { lowStockThreshold: edit.lowStockThreshold }),
      ...(edit.leadTimeDays === undefined ? {} : { leadTimeDays: edit.leadTimeDays }),
      ...(edit.minimumOrderQuantity === undefined
        ? {}
        : { minimumOrderQuantity: edit.minimumOrderQuantity }),
      ...(edit.storageLocation === undefined
        ? {}
        : { storageLocation: edit.storageLocation }),
      ...(edit.enabledForMatching === undefined
        ? {}
        : { enabledForMatching: edit.enabledForMatching }),
    },
  });

  return { ok: true, partId };
};

export interface StockUpdate {
  readonly kind: 'stock_in' | 'stock_out' | 'stock_count';
  readonly quantity: number;
  readonly note?: string | undefined;
}

/**
 * Moves stock, and records why.
 *
 * The movement is written in the same transaction as the new figure, so there is
 * no state in which the number has changed and nothing says how.
 */
export const updateStock = async (
  manufacturerId: ManufacturerId,
  actorId: UserId,
  partId: string,
  update: StockUpdate,
  now: Date = new Date(),
): Promise<PartOutcome> => {
  const item = await database().inventoryItem.findFirst({
    where: { id: partId, manufacturerId },
  });
  if (item === null) return { ok: false, message: 'That part is not in your inventory.' };

  let result;
  try {
    result = applyStockChange(item, {
      kind: update.kind,
      quantity: update.quantity,
      note: update.note,
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'that movement is not allowed',
    };
  }

  await database().$transaction(async (transaction) => {
    await transaction.inventoryItem.update({
      where: { id: partId },
      data: {
        stockQuantity: result.stockQuantity,
        ...(update.kind === 'stock_count' ? { lastCountedAt: now } : {}),
      },
    });
    await transaction.inventoryMovement.create({
      data: {
        id: identifier('mov'),
        itemId: partId,
        kind: update.kind,
        quantityDelta: result.quantityDelta,
        resultingStock: result.stockQuantity,
        resultingReserved: result.reservedQuantity,
        ...(update.note === undefined || update.note.trim() === ''
          ? {}
          : { note: update.note.trim() }),
        actorUserId: actorId,
        occurredAt: now,
      },
    });
  });

  return { ok: true, partId };
};

/**
 * Changes the price a part is quoted from, with the date it takes effect.
 *
 * The old price stays in the movement history, because quotes already sent were
 * priced from it and a shop has to be able to see what its costing was at the
 * time.
 */
export const updatePrice = async (
  manufacturerId: ManufacturerId,
  actorId: UserId,
  partId: string,
  unitCostMinor: number,
  effectiveFrom: Date | null,
  note: string | undefined,
  now: Date = new Date(),
): Promise<PartOutcome> => {
  const item = await database().inventoryItem.findFirst({
    where: { id: partId, manufacturerId },
  });
  if (item === null) return { ok: false, message: 'That part is not in your inventory.' };

  if (!Number.isInteger(unitCostMinor) || unitCostMinor <= 0) {
    return { ok: false, message: 'The price per unit has to be above zero.' };
  }
  if (unitCostMinor === Number(item.unitCostMinor)) {
    return { ok: false, message: 'That is the price it is already.' };
  }

  await database().$transaction(async (transaction) => {
    await transaction.inventoryItem.update({
      where: { id: partId },
      data: { unitCostMinor: BigInt(unitCostMinor) },
    });
    await transaction.inventoryMovement.create({
      data: {
        id: identifier('mov'),
        itemId: partId,
        kind: 'price_change',
        quantityDelta: 0,
        resultingStock: item.stockQuantity,
        resultingReserved: item.reservedQuantity,
        unitCostMinor: BigInt(unitCostMinor),
        ...(effectiveFrom === null ? {} : { effectiveFrom }),
        ...(note === undefined || note.trim() === '' ? {} : { note: note.trim() }),
        actorUserId: actorId,
        occurredAt: now,
      },
    });
  });

  return { ok: true, partId };
};

/**
 * Deletes a part, when nothing depends on it.
 *
 * A part that has been reserved, suggested to a buyer or moved more than once is
 * part of the record; switching it off for matching stops it being offered
 * without erasing what happened.
 */
export const deletePart = async (
  manufacturerId: ManufacturerId,
  partId: string,
): Promise<PartOutcome> => {
  const item = await database().inventoryItem.findFirst({
    where: { id: partId, manufacturerId },
    include: { _count: { select: { substitutions: true, movements: true } } },
  });
  if (item === null) return { ok: false, message: 'That part is not in your inventory.' };

  try {
    assertPartDeletable({
      reservedQuantity: item.reservedQuantity,
      suggestionCount: item._count.substitutions,
      movementCount: item._count.movements,
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'that part cannot be deleted',
    };
  }

  // The opening count goes with it, which is why the guard allows exactly one
  // movement: a part nobody has touched since it was added.
  await database().$transaction(async (transaction) => {
    await transaction.inventoryMovement.deleteMany({ where: { itemId: partId } });
    await transaction.inventoryItem.delete({ where: { id: partId } });
  });

  return { ok: true, partId };
};

export interface ReservationLine {
  readonly sku: string;
  readonly quantity: number;
}

/**
 * Reserves the parts a confirmed order needs, as far as the shop holds them.
 *
 * Called when an order is funded: from that moment the parts are promised, and
 * they stop being available to quote from. What the shop does not hold is not
 * reserved and not invented — the order's own shortage handling is what covers
 * that, and this reports what it could not reserve.
 */
export const reserveForOrder = async (
  manufacturerId: ManufacturerId,
  orderId: string,
  lines: readonly ReservationLine[],
  now: Date = new Date(),
): Promise<{
  readonly reserved: readonly { readonly sku: string; readonly quantity: number }[];
  readonly short: readonly {
    readonly sku: string;
    readonly wanted: number;
    readonly reserved: number;
  }[];
}> => {
  const reserved: { sku: string; quantity: number }[] = [];
  const short: { sku: string; wanted: number; reserved: number }[] = [];

  for (const line of lines) {
    const item = await database().inventoryItem.findFirst({
      where: { manufacturerId, sku: line.sku },
    });
    if (item === null) {
      short.push({ sku: line.sku, wanted: line.quantity, reserved: 0 });
      continue;
    }

    const takeable = Math.min(line.quantity, availableStock(item));
    if (takeable <= 0) {
      short.push({ sku: line.sku, wanted: line.quantity, reserved: 0 });
      continue;
    }

    const result = applyStockChange(item, { kind: 'reserved', quantity: takeable });
    await database().$transaction(async (transaction) => {
      await transaction.inventoryItem.update({
        where: { id: item.id },
        data: { reservedQuantity: result.reservedQuantity },
      });
      await transaction.inventoryMovement.create({
        data: {
          id: identifier('mov'),
          itemId: item.id,
          kind: 'reserved',
          quantityDelta: result.quantityDelta,
          resultingStock: result.stockQuantity,
          resultingReserved: result.reservedQuantity,
          note: 'Reserved for a confirmed order',
          orderId,
          occurredAt: now,
        },
      });
    });

    reserved.push({ sku: line.sku, quantity: takeable });
    if (takeable < line.quantity) {
      short.push({ sku: line.sku, wanted: line.quantity, reserved: takeable });
    }
  }

  return { reserved, short };
};

/**
 * Releases what an order had reserved.
 *
 * Two things end a reservation: the parts are consumed, or the order is not going
 * to happen. Consumption takes them off the shelf as well, so the caller says
 * which it is — and either way the reservation stops hiding stock the shop can
 * quote from.
 */
export const releaseForOrder = async (
  manufacturerId: ManufacturerId,
  orderId: string,
  outcome: 'consumed' | 'cancelled',
  now: Date = new Date(),
): Promise<{ readonly released: number }> => {
  const reservations = await database().inventoryMovement.findMany({
    where: { orderId, kind: 'reserved', item: { manufacturerId } },
    select: { itemId: true, quantityDelta: true },
  });
  // Only releases settle a reservation. A `stock_out` written alongside one is
  // the shelf moving, not the promise being let go, and counting it here would
  // make the next reservation look already released.
  const releases = await database().inventoryMovement.findMany({
    where: { orderId, kind: 'released', item: { manufacturerId } },
    select: { itemId: true, quantityDelta: true },
  });

  const outstanding = new Map<string, number>();
  for (const movement of reservations) {
    outstanding.set(
      movement.itemId,
      (outstanding.get(movement.itemId) ?? 0) + movement.quantityDelta,
    );
  }
  for (const movement of releases) {
    outstanding.set(
      movement.itemId,
      (outstanding.get(movement.itemId) ?? 0) + movement.quantityDelta,
    );
  }

  let released = 0;

  for (const [itemId, quantity] of outstanding) {
    if (quantity <= 0) continue;
    const item = await database().inventoryItem.findUniqueOrThrow({
      where: { id: itemId },
    });

    const freed = applyStockChange(item, { kind: 'released', quantity });
    const consumed =
      outcome === 'consumed'
        ? applyStockChange(
            { stockQuantity: freed.stockQuantity, reservedQuantity: freed.reservedQuantity },
            { kind: 'stock_out', quantity },
          )
        : null;

    await database().$transaction(async (transaction) => {
      await transaction.inventoryItem.update({
        where: { id: itemId },
        data: {
          reservedQuantity: freed.reservedQuantity,
          ...(consumed === null ? {} : { stockQuantity: consumed.stockQuantity }),
        },
      });
      await transaction.inventoryMovement.create({
        data: {
          id: identifier('mov'),
          itemId,
          kind: 'released',
          quantityDelta: freed.quantityDelta,
          resultingStock: freed.stockQuantity,
          resultingReserved: freed.reservedQuantity,
          note:
            outcome === 'consumed'
              ? 'Released as the order consumed them'
              : 'Released because the order will not go ahead',
          orderId,
          occurredAt: now,
        },
      });
      if (consumed !== null) {
        await transaction.inventoryMovement.create({
          data: {
            id: identifier('mov'),
            itemId,
            kind: 'stock_out',
            quantityDelta: consumed.quantityDelta,
            resultingStock: consumed.stockQuantity,
            resultingReserved: consumed.reservedQuantity,
            note: 'Built into a confirmed order',
            orderId,
            occurredAt: now,
          },
        });
      }
    });

    released += quantity;
  }

  return { released };
};
