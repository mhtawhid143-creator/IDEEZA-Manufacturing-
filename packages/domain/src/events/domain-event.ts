import type { DomainEventId, IsoTimestamp } from '../ids.js';
import type { ActorRole } from '../status/index.js';
import type { DomainEventKind, EventSubjectKind } from './kinds.js';

export interface EventActor {
  readonly role: ActorRole;
  readonly userId?: string | undefined;
  readonly manufacturerId?: string | undefined;
}

export interface EventSubject {
  readonly kind: EventSubjectKind;
  readonly id: string;
}

/**
 * An append-only record of a structured business action.
 *
 * Nothing in the system may update or delete one of these: the audit trail is
 * the evidence base for refunds, payout release and dispute decisions.
 */
export interface DomainEvent<TPayload = Readonly<Record<string, unknown>>> {
  readonly id: DomainEventId;
  readonly kind: DomainEventKind;
  readonly actor: EventActor;
  readonly subject: EventSubject;
  readonly orderId?: string | undefined;
  readonly payload: TPayload;
  readonly occurredAt: IsoTimestamp;
}

export interface NewDomainEventInput<TPayload = Readonly<Record<string, unknown>>> {
  readonly id: DomainEventId;
  readonly kind: DomainEventKind;
  readonly actor: EventActor;
  readonly subject: EventSubject;
  readonly orderId?: string | undefined;
  readonly payload?: TPayload | undefined;
  readonly occurredAt: IsoTimestamp;
}

/** Builds a frozen event. Freezing makes the append-only rule enforceable. */
export const recordDomainEvent = <TPayload extends Readonly<Record<string, unknown>>>(
  input: NewDomainEventInput<TPayload>,
): DomainEvent<TPayload> => {
  const payload = (input.payload ?? ({} as TPayload)) satisfies TPayload;
  const event: DomainEvent<TPayload> = {
    id: input.id,
    kind: input.kind,
    actor: Object.freeze({ ...input.actor }),
    subject: Object.freeze({ ...input.subject }),
    orderId: input.orderId,
    payload: Object.freeze({ ...payload }) as TPayload,
    occurredAt: input.occurredAt,
  };
  return Object.freeze(event);
};

export const eventsOfKind = <TKind extends DomainEventKind>(
  events: readonly DomainEvent[],
  kind: TKind,
): readonly DomainEvent[] => events.filter((event) => event.kind === kind);

export const hasEvent = (
  events: readonly DomainEvent[],
  kind: DomainEventKind,
): boolean => events.some((event) => event.kind === kind);
