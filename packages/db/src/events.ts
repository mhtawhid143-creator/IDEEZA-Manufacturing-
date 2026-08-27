import type { DomainEventKind } from '@ideeza/domain';
import { DOMAIN_EVENT_KINDS } from '@ideeza/domain';
import type { $Enums } from '@prisma/client';

/**
 * The domain names an event "rfq.submitted"; the database enum spells the same
 * value "rfq_submitted", because a dot is not a valid PostgreSQL enum label.
 *
 * One translation, in one place, checked by a test that walks every kind.
 */
export const toDatabaseEventKind = (
  kind: DomainEventKind,
): $Enums.DomainEventKind =>
  kind.replace(/\./g, '_') as $Enums.DomainEventKind;

/**
 * Back the other way.
 *
 * The label alone cannot say which underscore was the dot — "partial_refund"
 * is one subject with an underscore in its name — so the answer comes from the
 * domain list rather than from string surgery.
 */
export const toDomainEventKind = (
  kind: $Enums.DomainEventKind,
): DomainEventKind => {
  const match = DOMAIN_EVENT_KINDS.find(
    (candidate) => toDatabaseEventKind(candidate) === kind,
  );
  if (match === undefined) {
    throw new Error(`unmapped database event kind "${kind}"`);
  }
  return match;
};
