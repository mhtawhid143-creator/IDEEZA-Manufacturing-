import { InvariantViolationError } from '../errors.js';
import type { FileId, RfqId } from '../ids.js';
import type { RfqStatus } from '../status/index.js';

/**
 * A request may only be edited while it is a draft.
 *
 * Once it has been sent, every recipient is quoting against the requirements as
 * they were sent: changing them afterwards would make the quotes answers to a
 * question nobody was asked.
 */
export const assertDraftEditable = (rfqId: RfqId, status: RfqStatus): void => {
  if (status !== 'draft') {
    throw new InvariantViolationError(
      'DraftEditableOnlyBeforeSending',
      `request ${rfqId} is ${status} and can no longer be edited`,
    );
  }
};

/**
 * Something has to be manufactured from.
 *
 * A request with no file carries no geometry, no gerber and no drawing, so a
 * manufacturer could only guess at what it is quoting.
 */
export const assertPackageIncludesFiles = (fileIds: readonly FileId[]): void => {
  if (fileIds.length === 0) {
    throw new InvariantViolationError(
      'PackageCarriesAtLeastOneFile',
      'a manufacturing package must include at least one model file',
    );
  }
};

/**
 * The requested quantity has to be a real production quantity.
 *
 * The database enforces this too; the rule lives here so the form and the
 * database cannot disagree about it.
 */
export const assertQuantityIsProducible = (quantity: number): void => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new InvariantViolationError(
      'QuantityIsProducible',
      `quantity ${quantity} is not a whole number of units above zero`,
    );
  }
};
