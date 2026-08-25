import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../eslint/legacy-vocabulary.mjs';

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('legacy-vocabulary lint rule', () => {
  it('accepts manufacturing vocabulary and rejects the retired words', () => {
    ruleTester.run('legacy-vocabulary', rule, {
      valid: [
        { code: 'const quote = { unitPrice: 1 };' },
        { code: 'const rfqRecipient = "routed";' },
        { code: 'const productionStage = "quality_check";' },
        { code: 'const payout = { status: "pending_release" };' },
        { code: 'const substitution = { status: "proposed" };' },
        // a comment may name a retired word in order to explain it
        { code: '// the word proposal is retired\nconst quote = 1;' },
      ],
      invalid: [
        {
          code: 'const proposal = {};',
          errors: [{ messageId: 'retired' }],
        },
        {
          code: 'const activeContract = {};',
          errors: [{ messageId: 'retired' }],
        },
        {
          code: 'const label = "Requested Proposals";',
          errors: [{ messageId: 'retired' }],
        },
        {
          code: 'const status = "milestone";',
          errors: [{ messageId: 'retired' }],
        },
        {
          code: 'const recentTransactions = [];',
          errors: [{ messageId: 'retired' }],
        },
        {
          code: 'function sendOffer() {}',
          errors: [{ messageId: 'retired' }],
        },
        {
          code: 'const workScope = "";',
          errors: [{ messageId: 'retired' }],
        },
      ],
    });
  });
});
