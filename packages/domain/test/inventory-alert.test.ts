import { describe, expect, it } from 'vitest';
import {
  InvariantViolationError,
  assertAlertIsOpen,
  assertNoOpenAlerts,
  assertOrderCanAnswerAlerts,
  assertResolutionIsAvailable,
  orderSchedule,
  RESOLUTION_STATUS,
  resolutionDelayDays,
  resolutionSettlementMinor,
  TRANSIT_DAYS,
} from '../src/index.js';

const alert = {
  status: 'open' as const,
  suggestedPartName: 'BMP390 barometer',
  priceImpactMinor: 9_000,
  creditMinor: 6_400,
  leadTimeImpactDays: 2,
  restockLeadTimeDays: 26,
};

describe('answering a shortage found in production', () => {
  it('can be answered while the order is being made', () => {
    for (const status of ['confirmed', 'in_production', 'quality_check'] as const) {
      expect(() => assertOrderCanAnswerAlerts(status)).not.toThrow();
    }
  });

  it('cannot be answered before funding or after the units have shipped', () => {
    for (const status of [
      'awaiting_payment',
      'shipped',
      'delivered',
      'completed',
      'cancelled',
    ] as const) {
      expect(() => assertOrderCanAnswerAlerts(status)).toThrow(InvariantViolationError);
    }
  });

  it('is answered once', () => {
    expect(() => assertAlertIsOpen('alert_1', 'open')).not.toThrow();
    expect(() => assertAlertIsOpen('alert_1', 'substitute_approved')).toThrow(
      /already answered/,
    );
  });

  it('refuses to approve a substitute that was never suggested', () => {
    expect(() =>
      assertResolutionIsAvailable('approve_substitute', {
        ...alert,
        suggestedPartName: null,
      }),
    ).toThrow(InvariantViolationError);
  });

  it('refuses to wait for stock when no restock date was given', () => {
    expect(() =>
      assertResolutionIsAvailable('wait_for_stock', {
        ...alert,
        restockLeadTimeDays: null,
      }),
    ).toThrow(InvariantViolationError);
  });

  it('always allows the part to be dropped', () => {
    expect(() =>
      assertResolutionIsAvailable('drop_part', {
        ...alert,
        suggestedPartName: null,
        restockLeadTimeDays: null,
      }),
    ).not.toThrow();
  });

  it('says what each answer does to the money', () => {
    expect(resolutionSettlementMinor('approve_substitute', alert)).toBe(9_000);
    expect(resolutionSettlementMinor('drop_part', alert)).toBe(-6_400);
    expect(resolutionSettlementMinor('wait_for_stock', alert)).toBe(0);
  });

  it('says what each answer does to the dates', () => {
    expect(resolutionDelayDays('approve_substitute', alert)).toBe(2);
    expect(resolutionDelayDays('drop_part', alert)).toBe(0);
    expect(resolutionDelayDays('wait_for_stock', alert)).toBe(26);
  });

  it('leaves the alert in the state the answer implies', () => {
    expect(RESOLUTION_STATUS['approve_substitute']).toBe('substitute_approved');
    expect(RESOLUTION_STATUS['drop_part']).toBe('part_dropped');
    expect(RESOLUTION_STATUS['wait_for_stock']).toBe('stock_awaited');
  });

  it('blocks production while a shortage is unanswered', () => {
    expect(() => assertNoOpenAlerts(0)).not.toThrow();
    expect(() => assertNoOpenAlerts(1)).toThrow(/1 unanswered shortage/);
    expect(() => assertNoOpenAlerts(3)).toThrow(/3 unanswered shortages/);
  });
});

describe('the dates an order promises', () => {
  const confirmedAt = new Date('2026-06-01T00:00:00.000Z');

  it('counts the quoted lead time from the moment the funds were held', () => {
    const schedule = orderSchedule({
      confirmedAt,
      leadTimeDays: 18,
      shippingChoice: 'standard',
    });
    expect(schedule.estimatedShipAt.toISOString().slice(0, 10)).toBe('2026-06-19');
    expect(schedule.estimatedDeliveryAt.toISOString().slice(0, 10)).toBe('2026-06-26');
  });

  it('arrives sooner when the buyer paid for express', () => {
    const standard = orderSchedule({
      confirmedAt,
      leadTimeDays: 18,
      shippingChoice: 'standard',
    });
    const express = orderSchedule({
      confirmedAt,
      leadTimeDays: 18,
      shippingChoice: 'express',
    });
    const differenceDays =
      (standard.estimatedDeliveryAt.getTime() - express.estimatedDeliveryAt.getTime()) /
      86_400_000;
    expect(differenceDays).toBe(TRANSIT_DAYS.standard - TRANSIT_DAYS.express);
  });

  it('pushes both dates out by a delay the buyer accepted', () => {
    const delayed = orderSchedule({
      confirmedAt,
      leadTimeDays: 18,
      shippingChoice: 'standard',
      extraLeadTimeDays: 26,
    });
    expect(delayed.estimatedShipAt.toISOString().slice(0, 10)).toBe('2026-07-15');
  });
});
