import { describe, expect, it } from 'vitest';
import {
  PIPELINE_STAGES,
  orderReference,
  projectReference,
  projectSync,
  quoteReference,
  recordChain,
  requestReference,
} from '../src/index.js';

const PROJECT = { projectId: 'prod_beacon', projectName: 'Beacon Light Board' };

describe('one chain from the design to the order', () => {
  it('shows only the records that exist', () => {
    // A request nobody has quoted has two links, not four with two blanks: a
    // blank says the stage exists and is empty, which is a different and
    // untrue thing (UIUX-208).
    const early = recordChain({ ...PROJECT, rfqId: 'rfq_1', quoteId: null, orderId: null });
    expect(early.map((link) => link.stage)).toEqual(['project', 'request']);

    const whole = recordChain({
      ...PROJECT,
      rfqId: 'rfq_1',
      quoteId: 'q_1',
      orderId: 'o_1',
    });
    expect(whole.map((link) => link.stage)).toEqual([...PIPELINE_STAGES]);
  });

  it('never shows an order without the quote it was opened against', () => {
    // The three breaks the review found were all a later record with no way
    // back to an earlier one, so the chain is built oldest first and each stage
    // implies the ones before it.
    const chain = recordChain({ ...PROJECT, rfqId: 'rfq_1', quoteId: 'q_1', orderId: 'o_1' });
    const stages = chain.map((link) => link.stage);
    expect(stages.indexOf('quote')).toBeLessThan(stages.indexOf('order'));
    expect(stages.indexOf('project')).toBe(0);
  });

  it('quotes every record by the same reference both panels would print', () => {
    const chain = recordChain({ ...PROJECT, rfqId: 'rfq_1', quoteId: 'q_1', orderId: 'o_1' });
    expect(chain[0]?.reference).toBe(projectReference('prod_beacon'));
    expect(chain[1]?.reference).toBe(requestReference('rfq_1'));
    expect(chain[2]?.reference).toBe(quoteReference('q_1'));
    expect(chain[3]?.reference).toBe(orderReference('o_1'));
  });

  it('keeps the project’s name and its identifier apart', () => {
    // The finding was a field labelled "Project Name" showing the number 14,
    // which is what happens when one field is asked to be both (UIUX-146).
    const [project] = recordChain({ ...PROJECT, rfqId: 'rfq_1', quoteId: null, orderId: null });
    expect(project?.name).toBe('Beacon Light Board');
    expect(project?.reference).toMatch(/^PRJ-[0-9A-Z]{8}$/);
    expect(project?.reference).not.toContain('Beacon');
  });

  it('gives two different projects two different references', () => {
    expect(projectReference('prod_a')).not.toBe(projectReference('prod_b'));
    expect(projectReference('prod_a')).toBe(projectReference('prod_a'));
  });

  it('names only the project, because only the project has a name a reader knows', () => {
    const chain = recordChain({ ...PROJECT, rfqId: 'rfq_1', quoteId: 'q_1', orderId: 'o_1' });
    expect(chain.filter((link) => link.name !== null)).toHaveLength(1);
  });
});

describe('what a request is, relative to the design', () => {
  it('is frozen once the requirements are locked, and open before', () => {
    // The review asked for this to be decided rather than left undefined,
    // because the undefined case is the one that causes disputes (UIUX-146).
    expect(projectSync(new Date('2026-05-01T00:00:00.000Z'))).toBe('frozen');
    expect(projectSync(null)).toBe('open');
  });
});
