/**
 * ESLint rule: design-tokens
 *
 * Every colour, type size, tracking, layer, opacity and duration the panels
 * draw comes from the design system (`@ideeza/tokens`), through the names the
 * Tailwind preset gives them. This rule is what keeps that true after the fact:
 * it refuses the three ways a value slips past the system in a class string or
 * a style —
 *
 *   - a literal colour: `#7c3aed`, `rgb(...)`, `hsl(...)`
 *   - a Tailwind default that the preset does not define, which Tailwind would
 *     otherwise emit silently: `text-white`, `bg-slate-100`, `shadow-md`,
 *     `z-50`, `opacity-60`, `duration-150`, `font-light`, `leading-none`
 *   - an arbitrary value where a token exists: `text-[11px]`, `tracking-[-0.02em]`,
 *     `bg-[#fff]`, `z-[999]`, `rounded-[3px]`
 *
 * Layout measurements are not tokens and are not flagged: `min-w-[150px]`,
 * `grid-cols-[...]`, `h-[calc(...)]` describe a frame, not a look.
 *
 * A place that must hold a literal colour — the physical colour of a solder
 * mask, artwork generated from a product's own hue — says so with an
 * `eslint-disable` comment that names its reason. That is the point: the
 * exceptions are listed, in the code, where they are.
 *
 * Comments are ignored, so prose may name a hex value to explain one.
 */

const DEFAULT_PALETTE =
  'white|black|slate|zinc|neutral|stone|indigo|purple|fuchsia|pink|rose|emerald|teal|cyan|sky|amber|lime';
/**
 * The system's own primitives. They exist as CSS variables, and nowhere else:
 * a primitive is a swatch, and a swatch does not know whether it is a surface,
 * a word or a border, so it cannot follow the theme. Colour in a screen is
 * always the semantic token — bg-bg-*, text-text-*, border-border-*, text-icon-*,
 * button-*, input-* — which carries both themes with it.
 */
const SYSTEM_PRIMITIVES = 'violet|gray|blue|green|red|yellow|orange';
const COLOUR_UTILITIES =
  'bg|text|border|ring|ring-offset|fill|stroke|from|to|via|divide|outline|decoration|shadow|accent|caret|placeholder';

/** Each check: what to look for, and what the design system offers instead. */
const CHECKS = [
  {
    pattern: new RegExp(
      `(?:^|[\\s'"\`:])(?:${COLOUR_UTILITIES})-(?:${SYSTEM_PRIMITIVES})-\\d{2,3}(?:/\\d+)?(?=$|[\\s'"\`])`,
    ),
    hint: 'the semantic token for what this is — bg-bg-success-subtle for a success surface, text-text-error for error words, bg-icon for a neutral dot — never the primitive swatch',
  },
  {
    pattern: new RegExp(
      `(?:^|[\\s'"\`:])(?:${COLOUR_UTILITIES})-(?:bg|text|border|icon|button|input|badge|tag|toast|card|modal|ai|chart)-[a-z-]+/\\d+(?=$|[\\s'"\`])`,
    ),
    hint: 'the token as it is — a token is a CSS variable, so an opacity modifier (/40) is silently dropped by Tailwind; use the -subtle token for a paler surface',
  },
  {
    pattern: /var\(--color-(?:violet|gray|blue|green|red|yellow|orange|white|black)-?\d*\)/,
    hint: 'a semantic variable — var(--color-bg-brand-subtle), var(--color-border-strong) — never a primitive swatch',
  },
  {
    pattern: /(^|[^\w&])#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{1}|[0-9a-fA-F]{3}|[0-9a-fA-F]{5})?(?![\w-])/,
    hint: 'a colour from the system — bg-bg-*, text-text-*, border-border-*, or a named primitive',
  },
  {
    pattern: /\b(?:rgb|rgba|hsl|hsla)\(/,
    hint: 'a colour from the system — bg-bg-*, text-text-*, border-border-*, or a named primitive',
  },
  {
    pattern: new RegExp(
      `(?:^|[\\s'"\`:])(?:${COLOUR_UTILITIES})-(?:${DEFAULT_PALETTE})(?:-\\d{2,3})?(?:/\\d+)?(?=$|[\\s'"\`])`,
    ),
    hint: 'a semantic colour — text-text-on-brand for words on brand, bg-bg-surface for a surface, or a primitive the preset names',
  },
  {
    pattern: new RegExp(`(?:^|[\\s'"\`:])(?:${COLOUR_UTILITIES})-\\[[^\\]]*(?:#|rgb|hsl)[^\\]]*\\]`),
    hint: 'a colour from the system, not an arbitrary value',
  },
  {
    pattern: /(?:^|[\s'"`:])text-\[[^\]]*(?:px|rem|em)\]/,
    hint: 'a size from the system ramp — text-3xs (10) to text-7xl; the ramp is the only source of type sizes',
  },
  {
    pattern: /(?:^|[\s'"`:])(?:tracking|leading)-\[/,
    hint: 'tracking-caps / tracking-near / tracking-slight … and leading-xs … leading-xl, which are the system’s',
  },
  {
    pattern: /(?:^|[\s'"`:])leading-(?:none|tight|snug|normal|relaxed|loose|\d+)(?=$|[\s'"`])/,
    hint: 'leading-3xs … leading-xl, the line heights the system pairs with its sizes',
  },
  {
    pattern: /(?:^|[\s'"`:])(?:rounded(?:-[a-z]+)?|shadow|z|opacity|duration|delay|ease|font)-\[/,
    hint: 'the named step from the system instead of an arbitrary value',
  },
  {
    pattern: /(?:^|[\s'"`:])shadow-(?:sm|md|lg|xl|2xl)(?=$|[\s'"`])/,
    hint: 'shadow-1 … shadow-6, the system’s elevations',
  },
  {
    pattern: /(?:^|[\s'"`:])z-\d+(?=$|[\s'"`])/,
    hint: 'a named layer — z-sticky, z-dropdown, z-popover, z-modal, z-toast',
  },
  {
    pattern: /(?:^|[\s'"`:])opacity-(?:[1-9]\d?|95)(?=$|[\s'"`])/,
    hint: 'opacity-disabled / opacity-muted / opacity-overlay / opacity-hover / opacity-pressed',
  },
  {
    pattern: /(?:^|[\s'"`:])(?:duration|delay)-\d+(?=$|[\s'"`])/,
    hint: 'duration-fast / duration-normal / duration-slow, the system’s motion',
  },
  {
    pattern: /(?:^|[\s'"`:])ease-(?:linear|in|out|in-out)(?=$|[\s'"`])/,
    hint: 'ease-standard / ease-decelerate / ease-accelerate / ease-sharp / ease-spring',
  },
  {
    pattern: /(?:^|[\s'"`:])font-(?:thin|extralight|light|black)(?=$|[\s'"`])/,
    hint: 'font-normal / font-medium / font-semibold / font-bold / font-extrabold, the weights the system carries',
  },
  {
    pattern: /(?:^|[\s'"`:])text-(?:8xl|9xl)(?=$|[\s'"`])/,
    hint: 'the ramp ends at text-7xl (the system’s 8xl, 72px)',
  },
];

const findOffence = (text) => {
  for (const check of CHECKS) {
    const match = check.pattern.exec(text);
    if (match !== null) return { found: match[0].trim(), hint: check.hint };
  }
  return null;
};

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Every colour, type size, tracking, layer, opacity and duration comes from the design system through the preset; no literal or Tailwind default may stand in for one.',
    },
    schema: [],
    messages: {
      hardcoded:
        '"{{found}}" is not a design-system token. Use {{hint}}. If this value genuinely cannot be a token, disable this rule on the line and say why.',
    },
  },
  create(context) {
    const check = (node, text) => {
      if (typeof text !== 'string' || text.length === 0) return;
      const offence = findOffence(text);
      if (offence !== null) {
        context.report({ node, messageId: 'hardcoded', data: offence });
      }
    };

    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value?.cooked ?? node.value?.raw ?? '');
      },
    };
  },
};

export const designTokensRule = rule;
export default rule;
