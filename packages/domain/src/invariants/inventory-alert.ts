import { InvariantViolationError } from '../errors.js';
import type { OrderStatus } from '../status/index.js';

/**
 * What the manufacturer can be waiting for, and what the buyer can answer.
 *
 * A shortage found after the terms were frozen is not a change the manufacturer
 * may make on its own, and it is not something the platform can decide either:
 * the snapshot is immutable, so the only honest move is to put the three real
 * options to the buyer and record which one was chosen.
 */
export const INVENTORY_ALERT_STATUSES = [
  'open',
  'substitute_approved',
  'part_dropped',
  'stock_awaited',
] as const;
export type InventoryAlertStatus = (typeof INVENTORY_ALERT_STATUSES)[number];

export const INVENTORY_RESOLUTIONS = [
  'approve_substitute',
  'drop_part',
  'wait_for_stock',
] as const;
export type InventoryResolution = (typeof INVENTORY_RESOLUTIONS)[number];

/** The status a decision leaves behind. */
export const RESOLUTION_STATUS: Readonly<
  Record<InventoryResolution, Exclude<InventoryAlertStatus, 'open'>>
> = Object.freeze({
  approve_substitute: 'substitute_approved',
  drop_part: 'part_dropped',
  wait_for_stock: 'stock_awaited',
});

export interface InventoryAlertFacts {
  readonly status: InventoryAlertStatus;
  readonly suggestedPartName: string | null;
  readonly priceImpactMinor: number;
  readonly creditMinor: number;
  readonly leadTimeImpactDays: number;
  readonly restockLeadTimeDays: number | null;
}

/**
 * Orders where a shortage can still be answered.
 *
 * Before the funds are held nothing is being made, so there is nothing to be
 * short of; once the units have shipped the answer would come too late to
 * change what was built.
 */
const ANSWERABLE_ORDER_STATUSES: readonly OrderStatus[] = Object.freeze([
  'confirmed',
  'in_production',
  'quality_check',
]);

export const assertOrderCanAnswerAlerts = (orderStatus: OrderStatus): void => {
  if (!ANSWERABLE_ORDER_STATUSES.includes(orderStatus)) {
    throw new InvariantViolationError(
      'inventory-alert-order-state',
      `an order that is "${orderStatus}" cannot answer a shortage`,
    );
  }
};

/** An answer is given once. A decided alert is part of the record. */
export const assertAlertIsOpen = (alertId: string, status: InventoryAlertStatus): void => {
  if (status !== 'open') {
    throw new InvariantViolationError(
      'inventory-alert-already-decided',
      `alert "${alertId}" was already answered as "${status}"`,
    );
  }
};

/** Only the options the manufacturer actually put forward can be chosen. */
export const assertResolutionIsAvailable = (
  resolution: InventoryResolution,
  alert: InventoryAlertFacts,
): void => {
  if (!INVENTORY_RESOLUTIONS.includes(resolution)) {
    throw new InvariantViolationError(
      'inventory-alert-unknown-resolution',
      `"${String(resolution)}" is not one of the answers to a shortage`,
    );
  }
  if (resolution === 'approve_substitute' && alert.suggestedPartName === null) {
    throw new InvariantViolationError(
      'inventory-alert-no-substitute',
      'no replacement part was suggested, so there is nothing to approve',
    );
  }
  if (resolution === 'wait_for_stock' && alert.restockLeadTimeDays === null) {
    throw new InvariantViolationError(
      'inventory-alert-no-restock-date',
      'the manufacturer gave no restock lead time, so waiting cannot be chosen',
    );
  }
};

/**
 * What the answer does to the money, in minor units.
 *
 * Positive is owed by the buyer, negative is owed back to the buyer, and zero
 * means the terms stand. Nothing here touches the frozen snapshot: it is an
 * adjustment recorded against the order.
 */
export const resolutionSettlementMinor = (
  resolution: InventoryResolution,
  alert: InventoryAlertFacts,
): number => {
  if (resolution === 'approve_substitute') return alert.priceImpactMinor;
  if (resolution === 'drop_part') return -alert.creditMinor;
  return 0;
};

/** What the answer does to the promised dates, in days. */
export const resolutionDelayDays = (
  resolution: InventoryResolution,
  alert: InventoryAlertFacts,
): number => {
  if (resolution === 'approve_substitute') return alert.leadTimeImpactDays;
  if (resolution === 'wait_for_stock') return alert.restockLeadTimeDays ?? 0;
  return 0;
};

/**
 * Production is blocked while a shortage is unanswered.
 *
 * The manufacturer cannot guess, and building around the gap would produce
 * units that do not match the accepted terms.
 */
export const assertNoOpenAlerts = (openCount: number): void => {
  if (openCount > 0) {
    throw new InvariantViolationError(
      'inventory-alert-blocks-production',
      `${openCount} unanswered shortage${openCount === 1 ? '' : 's'} on this order`,
    );
  }
};
