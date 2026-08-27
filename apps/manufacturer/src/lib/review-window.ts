/**
 * How long the buyer has to inspect what arrived before the money moves.
 *
 * The business model names the window and what its expiry does, but not its
 * length: that is a platform parameter. The buyer's app holds the same number,
 * and both panels state it on screen wherever it applies, so nothing pretends it
 * came from the agreed terms.
 */
export const REVIEW_WINDOW_DAYS = 7;
