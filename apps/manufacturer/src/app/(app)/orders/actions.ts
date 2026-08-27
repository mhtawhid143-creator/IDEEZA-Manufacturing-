'use server';

import {
  DomainError,
  PRODUCTION_STAGES,
  asId,
  type OrderId,
  type ProductionStageKey,
} from '@ideeza/domain';
import {
  EVIDENCE_KINDS,
  attachEvidence,
  moveStage,
  raiseShortage,
  recordDelivery,
  recordShipment,
  requestCancellation,
  setTaskStatus,
  type ManufacturerEvidenceKind,
} from '@/data/orders.js';
import { requireManufacturer } from '@/lib/auth.js';
import { REVIEW_WINDOW_DAYS } from '@/lib/review-window.js';

export interface OrderActionState {
  readonly done: boolean;
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

const isStageKey = (value: string): value is ProductionStageKey =>
  (PRODUCTION_STAGES as readonly string[]).includes(value);

const isEvidenceKind = (value: string): value is ManufacturerEvidenceKind =>
  (EVIDENCE_KINDS as readonly string[]).includes(value);

const failed = (error: unknown): OrderActionState => {
  if (error instanceof DomainError) return { done: false, error: error.message };
  if (error instanceof Error) return { done: false, error: error.message };
  throw error;
};

/** Moves one production stage to in progress, or completes it. */
export const moveStageAction = async (
  orderIdInput: string,
  stageKey: string,
  to: string,
  note: string,
): Promise<OrderActionState> => {
  const actor = await requireManufacturer(`/orders/${orderIdInput}/production`);
  if (!isStageKey(stageKey)) {
    return { done: false, error: 'That is not a production stage.' };
  }
  if (to !== 'in_progress' && to !== 'completed') {
    return { done: false, error: 'A stage can only be started or completed.' };
  }

  try {
    const result = await moveStage(
      actor.manufacturerId,
      actor.userId,
      asId<OrderId>(orderIdInput),
      stageKey,
      to,
      note,
    );
    return result.ok ? { done: true } : { done: false, error: result.message };
  } catch (error) {
    return failed(error);
  }
};

/** Ticks one task inside a stage. */
export const setTaskAction = async (
  orderIdInput: string,
  taskId: string,
  to: string,
): Promise<OrderActionState> => {
  const actor = await requireManufacturer(`/orders/${orderIdInput}/production`);
  if (to !== 'in_progress' && to !== 'completed') {
    return { done: false, error: 'A task can only be started or completed.' };
  }

  try {
    const result = await setTaskStatus(
      actor.manufacturerId,
      actor.userId,
      asId<OrderId>(orderIdInput),
      taskId,
      to,
    );
    return result.ok ? { done: true } : { done: false, error: result.message };
  } catch (error) {
    return failed(error);
  }
};

export interface EvidencePayload {
  readonly orderId: string;
  readonly stageId: string;
  readonly kind: string;
  readonly title: string;
  readonly detail: string;
}

/** Attaches a record to a stage: a quality report, measurements, a photograph. */
export const attachEvidenceAction = async (
  payload: EvidencePayload,
): Promise<OrderActionState> => {
  const actor = await requireManufacturer(`/orders/${payload.orderId}/evidence`);
  if (!isEvidenceKind(payload.kind)) {
    return { done: false, error: 'That is not one of the kinds of record.' };
  }

  try {
    const result = await attachEvidence(
      actor.manufacturerId,
      actor.userId,
      asId<OrderId>(payload.orderId),
      payload.stageId,
      payload.kind,
      payload.title,
      payload.detail,
    );
    return result.ok ? { done: true } : { done: false, error: result.message };
  } catch (error) {
    return failed(error);
  }
};

/** Records the shipment, which completes the shipped stage. */
export const recordShipmentAction = async (
  orderIdInput: string,
  courier: string,
  trackingReference: string,
): Promise<OrderActionState> => {
  const actor = await requireManufacturer(`/orders/${orderIdInput}/shipment`);
  try {
    const result = await recordShipment(
      actor.manufacturerId,
      actor.userId,
      asId<OrderId>(orderIdInput),
      courier,
      trackingReference,
    );
    return result.ok ? { done: true } : { done: false, error: result.message };
  } catch (error) {
    return failed(error);
  }
};

/** Records that it arrived, which opens the buyer's review window. */
export const recordDeliveryAction = async (
  orderIdInput: string,
  note: string,
): Promise<OrderActionState> => {
  const actor = await requireManufacturer(`/orders/${orderIdInput}/shipment`);
  try {
    const result = await recordDelivery(
      actor.manufacturerId,
      actor.userId,
      asId<OrderId>(orderIdInput),
      note,
      REVIEW_WINDOW_DAYS,
    );
    return result.ok ? { done: true } : { done: false, error: result.message };
  } catch (error) {
    return failed(error);
  }
};

export interface ShortagePayload {
  readonly orderId: string;
  readonly partReference: string;
  readonly partName: string;
  readonly shortfallQuantity: string;
  readonly note: string;
  readonly suggestedInventoryItemId: string;
  readonly technicalJustification: string;
  readonly priceImpactMajor: string;
  readonly creditMajor: string;
  readonly leadTimeImpactDays: string;
  readonly restockLeadTimeDays: string;
}

/**
 * Raises a shortage on a live order.
 *
 * The buyer decides what to do about it — approve a substitute, drop the part
 * for a credit, or wait for stock — so everything this collects is what they need
 * to decide, and production holds until they have.
 */
export const raiseShortageAction = async (
  payload: ShortagePayload,
): Promise<OrderActionState> => {
  const actor = await requireManufacturer(`/orders/${payload.orderId}/shortage`);

  const shortfall = wholeOf(payload.shortfallQuantity);
  if (shortfall === null || Number.isNaN(shortfall)) {
    return { done: false, error: 'Say how many parts short you are.' };
  }
  const priceImpact = minorOf(payload.priceImpactMajor);
  const credit = minorOf(payload.creditMajor);
  const delay = wholeOf(payload.leadTimeImpactDays);
  const restock = wholeOf(payload.restockLeadTimeDays);
  for (const [label, value] of [
    ['price impact', priceImpact],
    ['credit', credit],
    ['delay', delay],
    ['restock lead time', restock],
  ] as const) {
    if (value !== null && Number.isNaN(value)) {
      return { done: false, error: `That ${label} is not a number.` };
    }
  }

  try {
    const result = await raiseShortage(
      actor.manufacturerId,
      actor.userId,
      asId<OrderId>(payload.orderId),
      {
        partReference: payload.partReference,
        partName: payload.partName,
        shortfallQuantity: shortfall,
        note: payload.note,
        ...(payload.suggestedInventoryItemId.trim() === ''
          ? {}
          : { suggestedInventoryItemId: payload.suggestedInventoryItemId.trim() }),
        ...(payload.technicalJustification.trim() === ''
          ? {}
          : { technicalJustification: payload.technicalJustification }),
        ...(priceImpact === null ? {} : { priceImpactMinor: priceImpact }),
        ...(credit === null ? {} : { creditMinor: credit }),
        ...(delay === null ? {} : { leadTimeImpactDays: delay }),
        ...(restock === null ? {} : { restockLeadTimeDays: restock }),
      },
    );
    return result.ok ? { done: true } : { done: false, error: result.message };
  } catch (error) {
    return failed(error);
  }
};

/** Asks IDEEZA to cancel a funded order. */
export const requestCancellationAction = async (
  orderIdInput: string,
  reason: string,
): Promise<OrderActionState> => {
  const actor = await requireManufacturer(`/orders/${orderIdInput}/cancel-request`);
  try {
    const result = await requestCancellation(
      actor.manufacturerId,
      actor.userId,
      asId<OrderId>(orderIdInput),
      reason,
    );
    return result.ok ? { done: true } : { done: false, error: result.message };
  } catch (error) {
    return failed(error);
  }
};
