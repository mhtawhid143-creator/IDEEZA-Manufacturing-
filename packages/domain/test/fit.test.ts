import { describe, expect, it } from 'vitest';
import {
  InvariantViolationError,
  compareManufacturerFit,
  assertRecipientCanTakeRequest,
  assertServicesRequested,
  evaluateManufacturerFit,
  type QuotedService,
} from '../src/index.js';

const request = (
  services: readonly QuotedService[],
  quantity = 200,
  leadTimeDays = 21,
) => ({ requestedServices: services, quantity, leadTimeDays });

const capable = {
  services: ['fabrication', 'assembly', 'parts_sourcing', 'testing'],
  minimumOrderQuantity: 5,
  standardLeadTimeDays: 18,
};

describe('reading a manufacturer against a request', () => {
  it('meets the request when it publishes everything asked for and can take the batch', () => {
    const fit = evaluateManufacturerFit(
      request(['pcb_fabrication', 'pcb_assembly', 'testing']),
      capable,
    );
    expect(fit.verdict).toBe('meets');
    expect(fit.missingServices).toEqual([]);
    expect(fit.belowMinimumOrderQuantity).toBe(false);
    expect(fit.slowerThanAsked).toBe(false);
  });

  it('is a partial fit when one of the services is not published', () => {
    const fit = evaluateManufacturerFit(
      request(['pcb_fabrication', 'enclosure_3d']),
      capable,
    );
    expect(fit.verdict).toBe('partial');
    expect(fit.missingServices).toEqual(['enclosure_3d']);
  });

  it('is a partial fit when it is usually slower than the lead time asked for', () => {
    const fit = evaluateManufacturerFit(
      request(['pcb_fabrication'], 200, 10),
      capable,
    );
    expect(fit.verdict).toBe('partial');
    expect(fit.slowerThanAsked).toBe(true);
  });

  it('cannot take a batch below its minimum order quantity', () => {
    const fit = evaluateManufacturerFit(request(['pcb_fabrication'], 2), capable);
    expect(fit.verdict).toBe('cannot');
    expect(fit.belowMinimumOrderQuantity).toBe(true);
  });

  it('cannot take a request when it publishes none of the work', () => {
    const fit = evaluateManufacturerFit(request(['enclosure_3d']), capable);
    expect(fit.verdict).toBe('cannot');
    expect(fit.missingServices).toEqual(['enclosure_3d']);
  });

  it('reads a stencil as fabrication, because that is who makes one', () => {
    expect(evaluateManufacturerFit(request(['stencil']), capable).verdict).toBe('meets');
  });

  it('treats an unpublished minimum or lead time as no obstacle', () => {
    const fit = evaluateManufacturerFit(request(['pcb_fabrication'], 1, 1), {
      services: ['fabrication'],
      minimumOrderQuantity: null,
      standardLeadTimeDays: null,
    });
    expect(fit.verdict).toBe('meets');
  });
});

describe('the rules behind sending a request', () => {
  it('needs the request to name the work', () => {
    expect(() => assertServicesRequested(['pcb_fabrication'])).not.toThrow();
    expect(() => assertServicesRequested([])).toThrow(InvariantViolationError);
  });

  it('refuses a recipient that could only decline', () => {
    const cannot = evaluateManufacturerFit(request(['enclosure_3d']), capable);
    expect(() => assertRecipientCanTakeRequest('PrecisionCircuit Co.', cannot)).toThrow(
      /cannot build this request/,
    );
  });

  it('allows a recipient that is only a partial fit, because a partial fit can still quote', () => {
    const partial = evaluateManufacturerFit(
      request(['pcb_fabrication', 'enclosure_3d']),
      capable,
    );
    expect(() => assertRecipientCanTakeRequest('PrecisionCircuit Co.', partial)).not.toThrow();
  });
});

describe('what a manufacturer already holds of the request', () => {
  const request = {
    requestedServices: ['pcb_fabrication'] as const,
    quantity: 400,
    leadTimeDays: 21,
  };
  const capable = {
    services: ['fabrication'],
    minimumOrderQuantity: null,
    standardLeadTimeDays: 14,
  };

  it('is a share of the buyer’s own lines, or nothing when there are none', () => {
    expect(
      evaluateManufacturerFit(request, {
        ...capable,
        partsInStock: { coveredLines: 3, totalLines: 4 },
      }).stockCoverage,
    ).toBe(0.75);
    expect(evaluateManufacturerFit(request, capable).stockCoverage).toBeNull();
    expect(
      evaluateManufacturerFit(request, {
        ...capable,
        partsInStock: { coveredLines: 0, totalLines: 0 },
      }).stockCoverage,
    ).toBeNull();
  });

  it('never turns a capable manufacturer away for not holding the parts', () => {
    const empty = evaluateManufacturerFit(request, {
      ...capable,
      partsInStock: { coveredLines: 0, totalLines: 5 },
    });
    expect(empty.verdict).toBe('meets');
    expect(empty.stockCoverage).toBe(0);
  });

  it('ranks the shop that holds the parts first, and what it can do before that', () => {
    const holdsThem = {
      displayName: 'Holds them',
      rating: 4.2,
      fit: evaluateManufacturerFit(request, {
        ...capable,
        partsInStock: { coveredLines: 4, totalLines: 4 },
      }),
    };
    const holdsNone = {
      displayName: 'Holds none',
      rating: 4.9,
      fit: evaluateManufacturerFit(request, {
        ...capable,
        partsInStock: { coveredLines: 0, totalLines: 4 },
      }),
    };
    const cannotDoIt = {
      displayName: 'Cannot do it',
      rating: 5,
      fit: evaluateManufacturerFit(request, {
        services: [],
        minimumOrderQuantity: null,
        standardLeadTimeDays: null,
        partsInStock: { coveredLines: 4, totalLines: 4 },
      }),
    };

    expect(
      [cannotDoIt, holdsNone, holdsThem]
        .sort(compareManufacturerFit)
        .map((option) => option.displayName),
    ).toEqual(['Holds them', 'Holds none', 'Cannot do it']);
  });
});
