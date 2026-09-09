import { describe, expect, it } from 'vitest';
import {
  REQUEST_LIFECYCLE,
  REQUEST_LIFECYCLE_LABEL,
  packageKindsIncluding,
  requestLifecycle,
} from '../src/index.js';

const ROUTINGS = ['routed', 'viewed', 'quoted', 'declined', 'expired'] as const;

describe('where a request got to', () => {
  it('is exactly one of six, for every combination of the facts', () => {
    // The whole point of the six is that the counts above the inbox can be
    // checked against the total, which only holds if nothing falls outside.
    for (const routing of ROUTINGS) {
      for (const withdrawn of [false, true]) {
        for (const won of [false, true]) {
          const value = requestLifecycle({
            routing,
            requestWithdrawn: withdrawn,
            myQuoteStatuses: won ? ['accepted'] : [],
          });
          expect(REQUEST_LIFECYCLE).toContain(value);
          expect(REQUEST_LIFECYCLE_LABEL[value].length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('counts a won request as accepted whatever the routing row says', () => {
    // The routing row stays "quoted" after the buyer accepts, which is why an
    // inbox reading it alone could not tell a shop what it had won.
    expect(
      requestLifecycle({
        routing: 'quoted',
        requestWithdrawn: false,
        myQuoteStatuses: ['accepted'],
      }),
    ).toBe('accepted');
  });

  it('keeps this shop’s own closure over a later withdrawal', () => {
    expect(
      requestLifecycle({
        routing: 'declined',
        requestWithdrawn: true,
        myQuoteStatuses: [],
      }),
    ).toBe('declined');
    expect(
      requestLifecycle({
        routing: 'viewed',
        requestWithdrawn: true,
        myQuoteStatuses: [],
      }),
    ).toBe('withdrawn');
  });

  it('does not promote a revision request into a status of its own', () => {
    // A quote awaiting revision is still "Quote sent"; the reason rides beside
    // the pill. Six near-duplicates of Quoted would break the arithmetic.
    expect(
      requestLifecycle({
        routing: 'quoted',
        requestWithdrawn: false,
        myQuoteStatuses: ['revision_requested'],
      }),
    ).toBe('quoted');
  });
});

describe('which kinds of work a package involves', () => {
  it('puts a combined package under both single-kind filters', () => {
    expect(packageKindsIncluding('pcb')).toEqual(['pcb', 'full_product']);
    expect(packageKindsIncluding('module_3d')).toEqual(['module_3d', 'full_product']);
  });

  it('keeps "needs both" as its own narrower question', () => {
    expect(packageKindsIncluding('full_product')).toEqual(['full_product']);
  });
});
