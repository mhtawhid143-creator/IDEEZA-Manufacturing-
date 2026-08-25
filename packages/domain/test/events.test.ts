import { describe, expect, it } from 'vitest';
import {
  DOMAIN_EVENT_KINDS,
  asId,
  asTimestamp,
  hasEvent,
  recordDomainEvent,
  type DomainEventId,
} from '@ideeza/domain';

describe('structured business actions', () => {
  it('covers every critical action the two panels can take', () => {
    for (const kind of [
      'quote.submitted',
      'quote.accepted',
      'substitution.approved',
      'payment.secured',
      'order.created',
      'order.confirmed',
      'order.production_started',
      'order.delivery_confirmed',
      'refund.requested',
      'dispute.opened',
      'dispute.resolved',
      'payout.released',
      'evidence.captured',
    ] as const) {
      expect(DOMAIN_EVENT_KINDS).toContain(kind);
    }
  });

  it('records an append-only, frozen event', () => {
    const event = recordDomainEvent({
      id: asId<DomainEventId>('event_1'),
      kind: 'quote.accepted',
      actor: { role: 'buyer', userId: 'user_1' },
      subject: { kind: 'quote', id: 'quote_1' },
      orderId: undefined,
      occurredAt: asTimestamp('2026-05-17T10:00:00.000Z'),
      payload: { quoteId: 'quote_1' },
    });

    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.payload)).toBe(true);
    expect(Object.isFrozen(event.actor)).toBe(true);
    expect(() => {
      (event as { kind: string }).kind = 'quote.rejected';
    }).toThrow(TypeError);
  });

  it('answers whether an action was recorded', () => {
    const events = [
      recordDomainEvent({
        id: asId<DomainEventId>('event_2'),
        kind: 'order.delivery_confirmed',
        actor: { role: 'buyer' },
        subject: { kind: 'order', id: 'order_1' },
        occurredAt: asTimestamp('2026-05-17T10:00:00.000Z'),
      }),
    ];
    expect(hasEvent(events, 'order.delivery_confirmed')).toBe(true);
    expect(hasEvent(events, 'payout.released')).toBe(false);
  });
});
