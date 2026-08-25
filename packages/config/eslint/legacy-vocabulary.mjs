/**
 * ESLint rule: legacy-vocabulary
 *
 * The IDEEZA manufacturing model deliberately retires the freelancer-marketplace
 * vocabulary listed in the business model decision document (see docs/DOMAIN.md).
 * Those words must never re-enter the codebase as business identifiers, status
 * values or user-facing copy, because the design files still carry them and they
 * would silently reintroduce the wrong business model.
 *
 * The rule flags the retired words when they appear as:
 *   - identifiers (variables, functions, classes, types, properties)
 *   - string literals and template literal chunks
 *
 * It intentionally ignores comments: prose that explains *why* a word is retired
 * has to be able to name it.
 */

const RETIRED_WORDS = [
  'contract',
  'contracts',
  'contractual',
  'proposal',
  'proposals',
  'offer',
  'offers',
  'offering',
  'scope',
  'scopes',
  'milestone',
  'milestones',
  'transaction',
  'transactions',
];

const REPLACEMENTS = {
  contract: 'ManufacturingOrder / accepted quote snapshot',
  contracts: 'ManufacturingOrder / accepted quote snapshot',
  contractual: 'order terms',
  proposal: 'Quote (or Substitution for part suggestions)',
  proposals: 'Quote (or Substitution for part suggestions)',
  offer: 'RFQ (incoming request) or Quote (manufacturer response)',
  offers: 'RFQ (incoming request) or Quote (manufacturer response)',
  offering: 'quoting',
  scope: 'ManufacturingRequirements',
  scopes: 'ManufacturingRequirements',
  milestone: 'ProductionStage',
  milestones: 'ProductionStage',
  transaction: 'Payment / Payout',
  transactions: 'Payment / Payout',
};

const WORD_PATTERN = new RegExp(`\\b(${RETIRED_WORDS.join('|')})\\b`, 'i');
const CAMEL_PATTERN = new RegExp(`(${RETIRED_WORDS.join('|')})`, 'i');

function splitIdentifier(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-.]/g, ' ')
    .toLowerCase();
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow retired freelancer-marketplace vocabulary in manufacturing domain code.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      retired:
        'Retired business term "{{word}}" is not allowed here. Use {{replacement}} instead.',
    },
  },
  create(context) {
    const allow = new Set(
      (context.options[0]?.allow ?? []).map((entry) => entry.toLowerCase()),
    );

    function report(node, rawWord) {
      const word = rawWord.toLowerCase();
      if (allow.has(word)) return;
      context.report({
        node,
        messageId: 'retired',
        data: { word: rawWord, replacement: REPLACEMENTS[word] ?? 'the manufacturing term' },
      });
    }

    function checkIdentifier(node, name) {
      if (typeof name !== 'string' || name.length === 0) return;
      const spaced = splitIdentifier(name);
      const match = WORD_PATTERN.exec(spaced) ?? CAMEL_PATTERN.exec(name);
      if (match) report(node, match[1]);
    }

    function checkText(node, text) {
      if (typeof text !== 'string' || text.length === 0) return;
      const match = WORD_PATTERN.exec(text);
      if (match) report(node, match[1]);
    }

    return {
      Identifier(node) {
        checkIdentifier(node, node.name);
      },
      PrivateIdentifier(node) {
        checkIdentifier(node, node.name);
      },
      Literal(node) {
        if (typeof node.value === 'string') checkText(node, node.value);
      },
      TemplateElement(node) {
        checkText(node, node.value?.cooked ?? node.value?.raw ?? '');
      },
      TSTypeReference(node) {
        if (node.typeName?.type === 'Identifier') {
          checkIdentifier(node, node.typeName.name);
        }
      },
    };
  },
};

export const legacyVocabularyRule = rule;
export const retiredWords = RETIRED_WORDS;
export default rule;
