import { describe, expect, it } from 'vitest';
import {
  InvalidTransitionError,
  InvariantViolationError,
  acceptedQuoteCountOnRfq,
  applyTransition,
  assertSingleAcceptedQuote,
  assertSubstitutionsDecided,
  asId,
  quoteMachine,
  type QuoteId,
} from '@ideeza/domain';

const quoteA = asId<QuoteId>('quote_a');
const quoteB = asId<QuoteId>('quote_b');
const quoteC = asId<QuoteId>('quote_c');

describe('only one quote per request can be accepted', () => {
  const quotes = [
    { id: quoteA, status: 'accepted' as const },
    { id: quoteB, status: 'submitted' as const },
    { id: quoteC, status: 'submitted' as const },
  ];

  it('rejects accepting a second quote on the same request', () => {
    expect(() => assertSingleAcceptedQuote(quotes, quoteB)).toThrow(
      InvariantViolationError,
    );
  });

  it('is idempotent for the quote that is already accepted', () => {
    expect(() => assertSingleAcceptedQuote(quotes, quoteA)).not.toThrow();
  });

  it('blocks the machine transition too, so the rule cannot be bypassed', () => {
    expect(() =>
      applyTransition(quoteMachine, 'submitted', 'accepted', {
        acceptedQuoteCountOnRfq: acceptedQuoteCountOnRfq(quotes, quoteB),
        pendingSubstitutionCount: 0,
      }),
    ).toThrow(InvalidTransitionError);
  });

  it('allows the first acceptance when nothing is accepted yet', () => {
    const open = [
      { id: quoteB, status: 'submitted' as const },
      { id: quoteC, status: 'submitted' as const },
    ];
    expect(acceptedQuoteCountOnRfq(open, quoteB)).toBe(0);
    expect(
      applyTransition(quoteMachine, 'submitted', 'accepted', {
        acceptedQuoteCountOnRfq: 0,
        pendingSubstitutionCount: 0,
      }),
    ).toBe('accepted');
  });
});

describe('undecided replacement parts block acceptance', () => {
  it('refuses acceptance while a suggestion is still open', () => {
    expect(() => assertSubstitutionsDecided(2)).toThrow(InvariantViolationError);
    expect(() =>
      applyTransition(quoteMachine, 'submitted', 'accepted', {
        acceptedQuoteCountOnRfq: 0,
        pendingSubstitutionCount: 2,
      }),
    ).toThrow(/waiting for a buyer decision/);
  });

  it('allows acceptance once every suggestion is decided', () => {
    expect(() => assertSubstitutionsDecided(0)).not.toThrow();
  });
});
