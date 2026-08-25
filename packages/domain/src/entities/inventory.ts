import type { InventoryItemId, IsoTimestamp, ManufacturerId } from '../ids.js';
import type { Money } from './money.js';

/**
 * Manufacturer-owned stock record.
 *
 * Buyers never read this table. Its purpose is quote accuracy: it feeds the
 * pre-quote availability check and the substitution flow. Live accuracy is not
 * assumed, so lastCountedAt is part of the record and callers must surface it.
 */
export interface InventoryItem {
  readonly id: InventoryItemId;
  readonly manufacturerId: ManufacturerId;
  readonly partName: string;
  readonly sku: string;
  readonly category: string;
  readonly stockQuantity: number;
  readonly reservedQuantity: number;
  readonly lowStockThreshold: number;
  readonly unitCost: Money;
  readonly leadTimeDays: number;
  readonly substituteItemIds: readonly InventoryItemId[];
  readonly minimumOrderQuantity?: number | undefined;
  readonly storageLocation?: string | undefined;
  readonly enabledForMatching: boolean;
  readonly lastCountedAt?: IsoTimestamp | undefined;
  readonly updatedAt: IsoTimestamp;
}

export type InventoryAvailability = 'in_stock' | 'low_stock' | 'out_of_stock';

export const availabilityOf = (item: InventoryItem): InventoryAvailability => {
  const free = item.stockQuantity - item.reservedQuantity;
  if (free <= 0) return 'out_of_stock';
  if (free <= item.lowStockThreshold) return 'low_stock';
  return 'in_stock';
};
