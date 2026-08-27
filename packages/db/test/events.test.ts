import { describe, expect, it } from 'vitest';
import { $Enums } from '@prisma/client';
import { DOMAIN_EVENT_KINDS } from '@ideeza/domain';
import { toDatabaseEventKind, toDomainEventKind } from '../src/events.js';

const DATABASE_KINDS = Object.keys($Enums.DomainEventKind);

describe('domain event kinds cross the database boundary', () => {
  it('maps every domain kind onto a real database label', () => {
    for (const kind of DOMAIN_EVENT_KINDS) {
      expect(DATABASE_KINDS).toContain(toDatabaseEventKind(kind));
    }
  });

  it('maps every database label back onto a domain kind', () => {
    for (const label of DATABASE_KINDS) {
      const kind = toDomainEventKind(label as never);
      expect(DOMAIN_EVENT_KINDS).toContain(kind);
      expect(toDatabaseEventKind(kind)).toBe(label);
    }
  });

  it('covers the two vocabularies completely, in both directions', () => {
    expect(DATABASE_KINDS).toHaveLength(DOMAIN_EVENT_KINDS.length);
  });

  it('refuses a label the domain does not know', () => {
    expect(() => toDomainEventKind('not_a_kind' as never)).toThrow(/unmapped/);
  });
});
