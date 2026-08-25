import { describe, expect, it } from 'vitest';
import { PermissionDeniedError, asId, type ManufacturerId, type UserId } from '@ideeza/domain';
import type { AuthenticatedActor } from '../src/actor.js';
import {
  authorizeInventoryAccess,
  authorizeOrderAccess,
  authorizePayoutAccess,
  authorizeQuoteAccess,
  authorizeRfqAccess,
  listVisibleQuotes,
} from '../src/boundaries.js';
import { fixtureBoundaryStore } from './fakes.js';

const store = fixtureBoundaryStore();

const makeActor = (
  role: AuthenticatedActor['role'],
  userId: string,
  manufacturerId?: string,
): AuthenticatedActor => ({
  sessionId: 'sess_1',
  userId: asId<UserId>(userId),
  email: `${userId}@example.test`,
  role,
  manufacturerId:
    manufacturerId === undefined ? undefined : asId<ManufacturerId>(manufacturerId),
});

const buyer = makeActor('buyer', 'buyer-1');
const otherBuyer = makeActor('buyer', 'buyer-2');
const manufacturerA = makeActor('manufacturer', 'member-a', 'mfr-a');
const manufacturerB = makeActor('manufacturer', 'member-b', 'mfr-b');
const outsider = makeActor('manufacturer', 'member-c', 'mfr-c');
const ops = makeActor('ops_admin', 'ops-1');

describe('request access', () => {
  it('lets the owning buyer read its request', async () => {
    const access = await authorizeRfqAccess(buyer, store, 'rfq-1');
    expect(access.rfqId).toBe('rfq-1');
  });

  it('refuses another buyer', async () => {
    await expect(authorizeRfqAccess(otherBuyer, store, 'rfq-1')).rejects.toThrow(
      PermissionDeniedError,
    );
  });

  it('lets a routed manufacturer read it', async () => {
    await expect(authorizeRfqAccess(manufacturerA, store, 'rfq-1')).resolves.toBeDefined();
    await expect(authorizeRfqAccess(manufacturerB, store, 'rfq-1')).resolves.toBeDefined();
  });

  it('refuses a manufacturer the request was never routed to', async () => {
    await expect(authorizeRfqAccess(outsider, store, 'rfq-1')).rejects.toThrow(
      /was not routed/,
    );
  });

  it('lets operations read it', async () => {
    await expect(authorizeRfqAccess(ops, store, 'rfq-1')).resolves.toBeDefined();
  });

  it('gives the same refusal for an unknown id as for a forbidden one', async () => {
    const unknown = await authorizeRfqAccess(buyer, store, 'rfq-404').catch(
      (error: unknown) => error,
    );
    expect(unknown).toBeInstanceOf(PermissionDeniedError);
  });
});

describe('quote access keeps competing prices apart', () => {
  it('lets the buyer read every quote on its own request', async () => {
    await expect(authorizeQuoteAccess(buyer, store, 'quote-a')).resolves.toBeDefined();
    await expect(authorizeQuoteAccess(buyer, store, 'quote-b')).resolves.toBeDefined();
  });

  it('lets a manufacturer read only its own quote', async () => {
    await expect(authorizeQuoteAccess(manufacturerA, store, 'quote-a')).resolves.toBeDefined();
    await expect(authorizeQuoteAccess(manufacturerA, store, 'quote-b')).rejects.toThrow(
      /only read its own quotes/,
    );
    await expect(authorizeQuoteAccess(manufacturerB, store, 'quote-a')).rejects.toThrow(
      PermissionDeniedError,
    );
  });

  it('refuses another buyer entirely', async () => {
    await expect(authorizeQuoteAccess(otherBuyer, store, 'quote-a')).rejects.toThrow(
      PermissionDeniedError,
    );
  });

  it('filters the comparison list per actor', async () => {
    expect((await listVisibleQuotes(buyer, store, 'rfq-1')).map((quote) => quote.id)).toEqual([
      'quote-a',
      'quote-b',
    ]);
    expect(
      (await listVisibleQuotes(manufacturerA, store, 'rfq-1')).map((quote) => quote.id),
    ).toEqual(['quote-a']);
    expect(
      (await listVisibleQuotes(manufacturerB, store, 'rfq-1')).map((quote) => quote.id),
    ).toEqual(['quote-b']);
    expect((await listVisibleQuotes(ops, store, 'rfq-1')).length).toBe(2);
  });
});

describe('order access is limited to the two counterparties', () => {
  it('lets the buyer and the assigned manufacturer read it', async () => {
    await expect(authorizeOrderAccess(buyer, store, 'order-1')).resolves.toBeDefined();
    await expect(authorizeOrderAccess(manufacturerA, store, 'order-1')).resolves.toBeDefined();
    await expect(authorizeOrderAccess(ops, store, 'order-1')).resolves.toBeDefined();
  });

  it('refuses the manufacturer that lost the request, and any other buyer', async () => {
    await expect(authorizeOrderAccess(manufacturerB, store, 'order-1')).rejects.toThrow(
      PermissionDeniedError,
    );
    await expect(authorizeOrderAccess(otherBuyer, store, 'order-1')).rejects.toThrow(
      PermissionDeniedError,
    );
  });
});

describe('inventory is manufacturer property', () => {
  it('lets the owner read and write it', async () => {
    await expect(authorizeInventoryAccess(manufacturerA, store, 'inv-a')).resolves.toBeDefined();
    await expect(
      authorizeInventoryAccess(manufacturerA, store, 'inv-a', 'write'),
    ).resolves.toBeDefined();
  });

  it('refuses another manufacturer', async () => {
    await expect(authorizeInventoryAccess(manufacturerB, store, 'inv-a')).rejects.toThrow(
      PermissionDeniedError,
    );
  });

  it('refuses a buyer at the capability level, before any lookup', async () => {
    await expect(authorizeInventoryAccess(buyer, store, 'inv-a')).rejects.toThrow(
      PermissionDeniedError,
    );
  });

  it('lets operations read but not write', async () => {
    await expect(authorizeInventoryAccess(ops, store, 'inv-a')).resolves.toBeDefined();
    await expect(authorizeInventoryAccess(ops, store, 'inv-a', 'write')).rejects.toThrow(
      PermissionDeniedError,
    );
  });
});

describe('payout access', () => {
  it('lets a manufacturer see its own payout', async () => {
    await expect(authorizePayoutAccess(manufacturerA, store, 'payout-1')).resolves.toBeDefined();
    await expect(authorizePayoutAccess(manufacturerB, store, 'payout-1')).rejects.toThrow(
      PermissionDeniedError,
    );
  });

  it('refuses a buyer', async () => {
    await expect(authorizePayoutAccess(buyer, store, 'payout-1')).rejects.toThrow(
      PermissionDeniedError,
    );
  });

  it('reserves releasing for operations', async () => {
    await expect(
      authorizePayoutAccess(ops, store, 'payout-1', 'release'),
    ).resolves.toBeDefined();
    await expect(
      authorizePayoutAccess(manufacturerA, store, 'payout-1', 'release'),
    ).rejects.toThrow(PermissionDeniedError);
  });
});
