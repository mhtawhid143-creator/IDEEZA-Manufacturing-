'use server';

import { DomainError } from '@ideeza/domain';
import {
  addPart,
  deletePart,
  editPart,
  updatePrice,
  updateStock,
} from '@/data/inventory.js';
import { requireManufacturer } from '@/lib/auth.js';

export interface PartActionState {
  readonly partId?: string;
  readonly error?: string;
}

const wholeOf = (value: string): number | null => {
  const text = value.trim();
  if (text === '') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.round(parsed) : Number.NaN;
};

const minorOf = (major: string): number | null => {
  const text = major.trim();
  if (text === '') return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return Number.NaN;
  return Math.round(value * 100);
};

const optional = (value: string): string | null => {
  const text = value.trim();
  return text === '' ? null : text;
};

export interface AddPartPayload {
  readonly partName: string;
  readonly sku: string;
  readonly category: string;
  readonly stockQuantity: string;
  readonly lowStockThreshold: string;
  readonly unitPriceMajor: string;
  readonly currency: string;
  readonly leadTimeDays: string;
  readonly minimumOrderQuantity: string;
  readonly storageLocation: string;
  readonly enabledForMatching: boolean;
}

/** Adds a part to this shop's inventory. */
export const addPartAction = async (
  payload: AddPartPayload,
): Promise<PartActionState> => {
  const actor = await requireManufacturer('/inventory/new');

  const stock = wholeOf(payload.stockQuantity);
  const threshold = wholeOf(payload.lowStockThreshold);
  const price = minorOf(payload.unitPriceMajor);
  const leadTime = wholeOf(payload.leadTimeDays);
  const moq = wholeOf(payload.minimumOrderQuantity);

  if (stock === null || Number.isNaN(stock)) {
    return { error: 'Say how many are on the shelf, or zero.' };
  }
  if (threshold === null || Number.isNaN(threshold)) {
    return { error: 'Set the low-stock threshold, or zero.' };
  }
  if (price === null || Number.isNaN(price)) {
    return { error: 'Enter the price per unit.' };
  }
  if (leadTime === null || Number.isNaN(leadTime)) {
    return { error: 'Enter the lead time in days.' };
  }
  if (moq !== null && Number.isNaN(moq)) {
    return { error: 'That minimum order quantity is not a number.' };
  }

  try {
    const result = await addPart(actor.manufacturerId, actor.userId, {
      partName: payload.partName,
      sku: payload.sku,
      category: payload.category,
      stockQuantity: stock,
      lowStockThreshold: threshold,
      unitCostMinor: price,
      currency: payload.currency,
      leadTimeDays: leadTime,
      minimumOrderQuantity: moq,
      storageLocation: optional(payload.storageLocation),
      enabledForMatching: payload.enabledForMatching,
    });
    return result.ok ? { partId: result.partId } : { error: result.message };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
};

export interface EditPartPayload {
  readonly partId: string;
  readonly partName: string;
  readonly category: string;
  readonly lowStockThreshold: string;
  readonly leadTimeDays: string;
  readonly minimumOrderQuantity: string;
  readonly storageLocation: string;
  readonly enabledForMatching: boolean;
}

/** Edits what a part is. Its stock and price move through their own movements. */
export const editPartAction = async (
  payload: EditPartPayload,
): Promise<PartActionState> => {
  const actor = await requireManufacturer(`/inventory/${payload.partId}`);

  const threshold = wholeOf(payload.lowStockThreshold);
  const leadTime = wholeOf(payload.leadTimeDays);
  const moq = wholeOf(payload.minimumOrderQuantity);
  if (threshold === null || Number.isNaN(threshold)) {
    return { error: 'Set the low-stock threshold, or zero.' };
  }
  if (leadTime === null || Number.isNaN(leadTime)) {
    return { error: 'Enter the lead time in days.' };
  }
  if (moq !== null && Number.isNaN(moq)) {
    return { error: 'That minimum order quantity is not a number.' };
  }

  try {
    const result = await editPart(actor.manufacturerId, payload.partId, {
      partName: payload.partName,
      category: payload.category,
      lowStockThreshold: threshold,
      leadTimeDays: leadTime,
      minimumOrderQuantity: moq,
      storageLocation: optional(payload.storageLocation),
      enabledForMatching: payload.enabledForMatching,
    });
    return result.ok ? { partId: result.partId } : { error: result.message };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
};

export interface StockPayload {
  readonly partId: string;
  readonly kind: string;
  readonly quantity: string;
  readonly note: string;
}

/** Records a stock movement: parts in, parts out, or a count. */
export const updateStockAction = async (
  payload: StockPayload,
): Promise<PartActionState> => {
  const actor = await requireManufacturer(`/inventory/${payload.partId}`);

  const quantity = wholeOf(payload.quantity);
  if (quantity === null || Number.isNaN(quantity)) {
    return { error: 'Say how many parts.' };
  }
  if (
    payload.kind !== 'stock_in' &&
    payload.kind !== 'stock_out' &&
    payload.kind !== 'stock_count'
  ) {
    return { error: 'That is not one of the movements on the list.' };
  }

  try {
    const result = await updateStock(actor.manufacturerId, actor.userId, payload.partId, {
      kind: payload.kind,
      quantity,
      note: payload.note,
    });
    return result.ok ? { partId: result.partId } : { error: result.message };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
};

export interface PricePayload {
  readonly partId: string;
  readonly unitPriceMajor: string;
  readonly effectiveFrom: string;
  readonly note: string;
}

/** Changes the price a part is quoted from, keeping the old one on the record. */
export const updatePriceAction = async (
  payload: PricePayload,
): Promise<PartActionState> => {
  const actor = await requireManufacturer(`/inventory/${payload.partId}`);

  const price = minorOf(payload.unitPriceMajor);
  if (price === null || Number.isNaN(price)) {
    return { error: 'Enter the price per unit.' };
  }

  const effective =
    payload.effectiveFrom.trim() === ''
      ? null
      : new Date(`${payload.effectiveFrom.trim()}T00:00:00.000Z`);
  if (effective !== null && Number.isNaN(effective.getTime())) {
    return { error: 'That date could not be read.' };
  }

  try {
    const result = await updatePrice(
      actor.manufacturerId,
      actor.userId,
      payload.partId,
      price,
      effective,
      payload.note,
    );
    return result.ok ? { partId: result.partId } : { error: result.message };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
};

/** Deletes a part, when nothing on the record points at it. */
export const deletePartAction = async (partId: string): Promise<PartActionState> => {
  const actor = await requireManufacturer(`/inventory/${partId}`);
  try {
    const result = await deletePart(actor.manufacturerId, partId);
    return result.ok ? { partId: result.partId } : { error: result.message };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
};
