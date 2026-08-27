import { InvariantViolationError } from '../errors.js';

/**
 * How a shop's own stock is allowed to change.
 *
 * Two rules carry everything here. Stock is never a number somebody typed over:
 * it moves by a recorded amount, or it is corrected by a count that says what it
 * was and what it is now. And what is reserved for orders can never exceed what
 * is on the shelf, because a part promised twice is a part that will be late
 * once.
 */
export const STOCK_MOVEMENTS = [
  'stock_in',
  'stock_out',
  'stock_count',
  'price_change',
  'reserved',
  'released',
] as const;
export type StockMovement = (typeof STOCK_MOVEMENTS)[number];

export interface StockState {
  readonly stockQuantity: number;
  readonly reservedQuantity: number;
}

export const availableStock = (state: StockState): number =>
  Math.max(0, state.stockQuantity - state.reservedQuantity);

/** A part that is on the shelf, running low, or gone. */
export const STOCK_STATES = ['in_stock', 'low_stock', 'out_of_stock'] as const;
export type StockLevel = (typeof STOCK_STATES)[number];

/**
 * What the status column means.
 *
 * Availability, not stock: parts already promised to an order are not available
 * to promise again, so a shop with a full shelf and a full order book is out of
 * stock for the purpose of quoting — which is the only purpose this figure has.
 */
export const stockLevelOf = (
  state: StockState & { readonly lowStockThreshold: number },
): StockLevel => {
  const available = availableStock(state);
  if (available <= 0) return 'out_of_stock';
  if (available <= state.lowStockThreshold) return 'low_stock';
  return 'in_stock';
};

export interface StockChange {
  readonly kind: StockMovement;
  /** Positive for anything that adds, and read as an amount, never a total. */
  readonly quantity: number;
  readonly note?: string | undefined;
}

export interface StockResult {
  readonly stockQuantity: number;
  readonly reservedQuantity: number;
  readonly quantityDelta: number;
}

/**
 * Applies one movement to a stock state, or refuses it.
 *
 * The arithmetic is here rather than in the app because both the shop's own
 * screens and the order lifecycle move the same numbers, and a reservation that
 * the two disagreed about would be a shortage nobody could see.
 */
export const applyStockChange = (
  state: StockState,
  change: StockChange,
): StockResult => {
  if (!Number.isInteger(change.quantity) || change.quantity < 0) {
    throw new InvariantViolationError(
      'stock-amount',
      'a quantity is a whole number of parts, and it is never negative — say what kind of movement it is instead',
    );
  }

  switch (change.kind) {
    case 'stock_in': {
      if (change.quantity === 0) {
        throw new InvariantViolationError('stock-amount', 'nothing came in');
      }
      return {
        stockQuantity: state.stockQuantity + change.quantity,
        reservedQuantity: state.reservedQuantity,
        quantityDelta: change.quantity,
      };
    }
    case 'stock_out': {
      if (change.quantity === 0) {
        throw new InvariantViolationError('stock-amount', 'nothing went out');
      }
      if (change.quantity > availableStock(state)) {
        throw new InvariantViolationError(
          'stock-out-exceeds-available',
          `only ${availableStock(state)} are free to take out; the rest is reserved for orders`,
        );
      }
      return {
        stockQuantity: state.stockQuantity - change.quantity,
        reservedQuantity: state.reservedQuantity,
        quantityDelta: -change.quantity,
      };
    }
    case 'stock_count': {
      // A count is the one movement that states a total: it is what the shelf
      // actually holds, and the difference from the record is the interesting
      // part of it.
      if (change.quantity < state.reservedQuantity) {
        throw new InvariantViolationError(
          'stock-count-below-reserved',
          `${state.reservedQuantity} parts are reserved for orders, so a count of ${change.quantity} would leave an order unbuildable — release the reservation first or say what happened`,
        );
      }
      return {
        stockQuantity: change.quantity,
        reservedQuantity: state.reservedQuantity,
        quantityDelta: change.quantity - state.stockQuantity,
      };
    }
    case 'reserved': {
      if (change.quantity === 0) {
        throw new InvariantViolationError('stock-amount', 'nothing was reserved');
      }
      if (change.quantity > availableStock(state)) {
        throw new InvariantViolationError(
          'reservation-exceeds-available',
          `only ${availableStock(state)} are available to reserve`,
        );
      }
      return {
        stockQuantity: state.stockQuantity,
        reservedQuantity: state.reservedQuantity + change.quantity,
        quantityDelta: change.quantity,
      };
    }
    case 'released': {
      if (change.quantity === 0) {
        throw new InvariantViolationError('stock-amount', 'nothing was released');
      }
      if (change.quantity > state.reservedQuantity) {
        throw new InvariantViolationError(
          'release-exceeds-reserved',
          `only ${state.reservedQuantity} are reserved, so ${change.quantity} cannot be released`,
        );
      }
      return {
        stockQuantity: state.stockQuantity,
        reservedQuantity: state.reservedQuantity - change.quantity,
        quantityDelta: -change.quantity,
      };
    }
    case 'price_change': {
      return {
        stockQuantity: state.stockQuantity,
        reservedQuantity: state.reservedQuantity,
        quantityDelta: 0,
      };
    }
  }
};

export interface PartDefinition {
  readonly partName: string;
  readonly sku: string;
  readonly category: string;
  readonly stockQuantity: number;
  readonly lowStockThreshold: number;
  readonly unitCostMinor: number;
  readonly leadTimeDays: number;
  readonly minimumOrderQuantity?: number | null;
  readonly storageLocation?: string | null;
}

/**
 * What a part has to say about itself to be usable.
 *
 * A part with no lead time or no cost cannot be quoted from, and a part with no
 * SKU cannot be matched to a bill of materials — which is the only reason the
 * platform holds inventory at all.
 */
export const assertPartDefinitionUsable = (part: PartDefinition): void => {
  if (part.partName.trim().length < 2) {
    throw new InvariantViolationError('part-name', 'give the part a name');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{1,63}$/.test(part.sku.trim())) {
    throw new InvariantViolationError(
      'part-sku',
      'a SKU is letters, digits, dots, dashes, slashes or underscores — it is what a bill of materials is matched on',
    );
  }
  if (part.category.trim() === '') {
    throw new InvariantViolationError(
      'part-category',
      'choose a category; it is what substitutes are looked for in',
    );
  }
  if (!Number.isInteger(part.stockQuantity) || part.stockQuantity < 0) {
    throw new InvariantViolationError(
      'part-stock',
      'the stock quantity is a whole number of parts, or zero',
    );
  }
  if (!Number.isInteger(part.lowStockThreshold) || part.lowStockThreshold < 0) {
    throw new InvariantViolationError(
      'part-threshold',
      'the low-stock threshold is a whole number of parts, or zero',
    );
  }
  if (!Number.isInteger(part.unitCostMinor) || part.unitCostMinor <= 0) {
    throw new InvariantViolationError(
      'part-cost',
      'the price per unit has to be above zero; it is what a substitute’s price impact is worked out from',
    );
  }
  if (!Number.isInteger(part.leadTimeDays) || part.leadTimeDays <= 0) {
    throw new InvariantViolationError(
      'part-lead-time',
      'the lead time has to be at least one day; it is what a substitute’s delay is worked out from',
    );
  }
  if (
    part.minimumOrderQuantity !== null &&
    part.minimumOrderQuantity !== undefined &&
    (!Number.isInteger(part.minimumOrderQuantity) || part.minimumOrderQuantity <= 0)
  ) {
    throw new InvariantViolationError(
      'part-moq',
      'a minimum order quantity is a whole number of parts above zero',
    );
  }
};

/**
 * A part may only be deleted while nothing depends on it.
 *
 * Once a part has been reserved for an order or named in a substitute
 * suggestion, deleting it would leave a record pointing at nothing. Switching it
 * off for matching is the answer then: it stops being offered without erasing
 * what has already happened.
 */
export const assertPartDeletable = (usage: {
  readonly reservedQuantity: number;
  readonly suggestionCount: number;
  readonly movementCount: number;
}): void => {
  if (usage.reservedQuantity > 0) {
    throw new InvariantViolationError(
      'part-reserved',
      'parts of this are reserved for an order, so it cannot be deleted — switch it off for matching instead',
    );
  }
  if (usage.suggestionCount > 0) {
    throw new InvariantViolationError(
      'part-suggested',
      'this part has been suggested to a buyer as a substitute, so it stays on the record — switch it off for matching instead',
    );
  }
  if (usage.movementCount > 1) {
    throw new InvariantViolationError(
      'part-has-history',
      'this part has stock movements recorded against it — switch it off for matching instead of deleting its history',
    );
  }
};
