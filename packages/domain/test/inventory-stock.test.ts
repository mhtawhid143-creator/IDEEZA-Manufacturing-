import { describe, expect, it } from 'vitest';
import {
  InvariantViolationError,
  applyStockChange,
  assertPartDefinitionUsable,
  assertPartDeletable,
  availableStock,
  stockLevelOf,
} from '../src/index.js';

describe('what is free to promise', () => {
  it('is the shelf minus what is already promised', () => {
    expect(availableStock({ stockQuantity: 500, reservedQuantity: 200 })).toBe(300);
    expect(availableStock({ stockQuantity: 100, reservedQuantity: 400 })).toBe(0);
  });

  it('reads the status from availability, not from the shelf', () => {
    expect(
      stockLevelOf({ stockQuantity: 500, reservedQuantity: 0, lowStockThreshold: 100 }),
    ).toBe('in_stock');
    expect(
      stockLevelOf({ stockQuantity: 500, reservedQuantity: 450, lowStockThreshold: 100 }),
    ).toBe('low_stock');
    expect(
      stockLevelOf({ stockQuantity: 500, reservedQuantity: 500, lowStockThreshold: 100 }),
    ).toBe('out_of_stock');
  });
});

describe('moving stock', () => {
  const state = { stockQuantity: 500, reservedQuantity: 200 };

  it('adds and subtracts by an amount', () => {
    expect(applyStockChange(state, { kind: 'stock_in', quantity: 100 })).toEqual({
      stockQuantity: 600,
      reservedQuantity: 200,
      quantityDelta: 100,
    });
    expect(applyStockChange(state, { kind: 'stock_out', quantity: 300 })).toEqual({
      stockQuantity: 200,
      reservedQuantity: 200,
      quantityDelta: -300,
    });
  });

  it('never takes out what is promised to an order', () => {
    expect(() => applyStockChange(state, { kind: 'stock_out', quantity: 301 })).toThrow(
      /only 300 are free/,
    );
  });

  it('takes a count as the total and reports the difference', () => {
    expect(applyStockChange(state, { kind: 'stock_count', quantity: 480 })).toEqual({
      stockQuantity: 480,
      reservedQuantity: 200,
      quantityDelta: -20,
    });
  });

  it('refuses a count that would leave an order unbuildable', () => {
    expect(() => applyStockChange(state, { kind: 'stock_count', quantity: 150 })).toThrow(
      /reserved for orders/,
    );
  });

  it('reserves only what is available, and releases only what is reserved', () => {
    expect(applyStockChange(state, { kind: 'reserved', quantity: 300 })).toEqual({
      stockQuantity: 500,
      reservedQuantity: 500,
      quantityDelta: 300,
    });
    expect(() => applyStockChange(state, { kind: 'reserved', quantity: 301 })).toThrow(
      /available to reserve/,
    );
    expect(applyStockChange(state, { kind: 'released', quantity: 200 })).toEqual({
      stockQuantity: 500,
      reservedQuantity: 0,
      quantityDelta: -200,
    });
    expect(() => applyStockChange(state, { kind: 'released', quantity: 201 })).toThrow(
      /only 200 are reserved/,
    );
  });

  it('refuses a negative amount, whatever the movement', () => {
    expect(() => applyStockChange(state, { kind: 'stock_in', quantity: -1 })).toThrow(
      InvariantViolationError,
    );
  });

  it('leaves the numbers alone on a price change', () => {
    expect(applyStockChange(state, { kind: 'price_change', quantity: 0 })).toEqual({
      stockQuantity: 500,
      reservedQuantity: 200,
      quantityDelta: 0,
    });
  });
});

describe('what a part has to say about itself', () => {
  const part = {
    partName: 'STM32G431 MCU',
    sku: 'MCU-STM32G431',
    category: 'Microcontrollers',
    stockQuantity: 900,
    lowStockThreshold: 200,
    unitCostMinor: 480,
    leadTimeDays: 6,
    minimumOrderQuantity: 100,
    storageLocation: 'A1-03',
  };

  it('accepts a part that could be quoted from', () => {
    expect(() => assertPartDefinitionUsable(part)).not.toThrow();
  });

  it('refuses one with no cost or no lead time, which a substitute is priced from', () => {
    expect(() => assertPartDefinitionUsable({ ...part, unitCostMinor: 0 })).toThrow(
      /price impact/,
    );
    expect(() => assertPartDefinitionUsable({ ...part, leadTimeDays: 0 })).toThrow(
      /delay is worked out/,
    );
  });

  it('refuses a SKU a bill of materials could not be matched on', () => {
    for (const sku of ['', 'a', 'has space', 'has#hash']) {
      expect(() => assertPartDefinitionUsable({ ...part, sku })).toThrow(/SKU/);
    }
  });
});

describe('when a part may be deleted', () => {
  it('allows one nobody has touched', () => {
    expect(() =>
      assertPartDeletable({ reservedQuantity: 0, suggestionCount: 0, movementCount: 1 }),
    ).not.toThrow();
  });

  it('refuses one that is reserved, suggested, or has history', () => {
    expect(() =>
      assertPartDeletable({ reservedQuantity: 5, suggestionCount: 0, movementCount: 1 }),
    ).toThrow(/reserved for an order/);
    expect(() =>
      assertPartDeletable({ reservedQuantity: 0, suggestionCount: 1, movementCount: 1 }),
    ).toThrow(/suggested to a buyer/);
    expect(() =>
      assertPartDeletable({ reservedQuantity: 0, suggestionCount: 0, movementCount: 4 }),
    ).toThrow(/stock movements recorded/);
  });
});
