import { describe, expect, it } from 'vitest';
import {
  InvariantViolationError,
  asId,
  assertDraftEditable,
  assertPackageIncludesFiles,
  assertQuantityIsProducible,
  type FileId,
  type RfqId,
} from '../src/index.js';

const rfq = asId<RfqId>('rfq_1');
const file = asId<FileId>('file_1');

describe('preparing a request', () => {
  it('lets a draft be edited', () => {
    expect(() => assertDraftEditable(rfq, 'draft')).not.toThrow();
  });

  it('refuses to edit a request that is out for quotes', () => {
    expect(() => assertDraftEditable(rfq, 'submitted')).toThrow(InvariantViolationError);
  });

  it('refuses to edit a finished request', () => {
    expect(() => assertDraftEditable(rfq, 'closed')).toThrow(/can no longer be edited/);
    expect(() => assertDraftEditable(rfq, 'withdrawn')).toThrow(/can no longer be edited/);
  });

  it('requires at least one file to travel with the package', () => {
    expect(() => assertPackageIncludesFiles([file])).not.toThrow();
    expect(() => assertPackageIncludesFiles([])).toThrow(InvariantViolationError);
  });

  it('requires a whole number of units above zero', () => {
    expect(() => assertQuantityIsProducible(1)).not.toThrow();
    expect(() => assertQuantityIsProducible(500)).not.toThrow();
    for (const quantity of [0, -5, 2.5, Number.NaN]) {
      expect(() => assertQuantityIsProducible(quantity)).toThrow(InvariantViolationError);
    }
  });
});
