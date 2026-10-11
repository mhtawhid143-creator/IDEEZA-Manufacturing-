import { describe, expect, it } from 'vitest';
import { SHIPPING_CHOICES, SHIPPING_CHOICE_LABEL } from '../src/index.js';

/**
 * The audit after UIUX-123/217 found the same fault in two more places, and
 * this is one of them: the shop's order page printed the courier as
 * `shippingChoice.replace(/_/g, ' ')` — the stored word, in lower case, beside
 * rows that are all properly written — while the buyer's order page carried its
 * own map saying "Standard courier · tracked".
 *
 * One fact, two readings, which is the fault this review keeps returning to.
 * One map now, read by both panels.
 */
describe('how a courier choice is said out loud', () => {
  it('has a line for every choice the platform offers', () => {
    for (const choice of SHIPPING_CHOICES) {
      expect(SHIPPING_CHOICE_LABEL[choice]).toBeTruthy();
    }
  });

  it('keeps the words the buyer has been reading', () => {
    // Taken from the buyer panel's own map rather than invented here: the
    // buyer has been shown these words, and an audit is not the place to
    // change what a buyer is told.
    expect(SHIPPING_CHOICE_LABEL.standard).toBe('Standard courier · tracked');
    expect(SHIPPING_CHOICE_LABEL.express).toBe('Expedited courier · tracked');
  });

  it('starts each one with a capital, so none reads as a stored value', () => {
    for (const choice of SHIPPING_CHOICES) {
      const label = SHIPPING_CHOICE_LABEL[choice];
      expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase());
    }
  });

  it('never leaves an underscore in a line a person reads', () => {
    for (const choice of SHIPPING_CHOICES) {
      expect(SHIPPING_CHOICE_LABEL[choice]).not.toMatch(/_/);
    }
  });
});
