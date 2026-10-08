import { describe, expect, it } from 'vitest';
import {
  caseReference,
  claimReference,
  orderReference,
  partReference,
  payoutReference,
  projectReference,
  quoteReference,
  requestReference,
  withdrawalReference,
} from '../src/index.js';

/**
 * UIUX-138. Every record a person can quote back carries a `#`, because that is
 * what the design writes — `#13611` on an order, `#13617` on a stage — and a
 * reference without it reads as a code the platform uses rather than a number
 * you can give someone.
 *
 * All nine are built by one function, so the hash cannot be on some records and
 * not others. These hold that.
 */
const BUILDERS = [
  ['project', projectReference, 'PRJ'],
  ['request', requestReference, 'RFQ'],
  ['quote', quoteReference, 'QUOTE'],
  ['order', orderReference, 'ORDER'],
  ['payout', payoutReference, 'PAYOUT'],
  ['part', partReference, 'PART'],
  ['case', caseReference, 'CASE'],
  ['claim', claimReference, 'CLAIM'],
  ['withdrawal', withdrawalReference, 'WD'],
] as const;

describe('how a record is quoted back', () => {
  it.each(BUILDERS)('gives a %s a hash, a prefix and eight characters', (_name, build, prefix) => {
    expect(build('row_1a2b3c')).toMatch(new RegExp(`^#${prefix}-[0-9A-Z]{8}$`));
  });

  it('is the same reference for the same row, every time', () => {
    expect(requestReference('rfq_1')).toBe(requestReference('rfq_1'));
  });

  it('tells two rows apart', () => {
    expect(requestReference('rfq_1')).not.toBe(requestReference('rfq_2'));
  });

  it('never carries the stored row id, which is not anybody’s to quote', () => {
    expect(requestReference('mfrfix_rfq_driver')).not.toContain('mfrfix');
  });
});
