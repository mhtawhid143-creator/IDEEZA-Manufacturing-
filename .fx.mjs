import { readFileSync, writeFileSync } from 'node:fs';
const edit = (path, from, to) => {
  const s = readFileSync(path, 'utf8');
  if (!s.includes(from)) throw new Error(path + ' — anchor missing:\n' + from.slice(0, 130));
  writeFileSync(path, s.replace(from, to));
  console.log('  patched ' + path);
};

// ── 1. The active tab, on the brand fill ────────────────────────────────────
//
// Measured 3.11:1 in dark mode and 7.16:1 in light, which is why it went
// unnoticed: `text-inverse` means "the opposite of the page", so in a dark
// theme it resolves to near-black — and near-black on violet is unreadable.
// A brand fill has its own token for the words on it.
edit(
  'packages/ui/src/components/tabs.tsx',
  `        ? 'bg-bg-brand text-text-inverse'`,
  `        ? 'bg-bg-brand text-text-on-brand'`,
);

// ── 2. The error badge in dark mode ─────────────────────────────────────────
edit(
  'packages/ui/src/components/badge.tsx',
  `export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {`,
  `/**
 * One tone the system's badge gets wrong, and the system's own answer for it.
 *
 * The subtle badge binds \`bg-{tone}-subtle\` with \`text-{tone}\`, and five of the
 * six tones clear AA comfortably in both themes. The error tone does not: in
 * dark mode it puts red-400 on red-900, which measures 3.62:1 against the 4.5
 * a 12px label needs. Light mode is fine at 5.91:1, which is why it survived.
 *
 * The system also ships a badge-specific pair for the same role, and that one
 * measures 6.93:1 in dark and 5.91:1 in light — so the fix is the system's own
 * token, not a colour invented here. Recorded as a gap in
 * \`docs/DESIGN-SYSTEM.md\` §11 for the design team; when the badge's own
 * compound variant is corrected upstream, this table goes away.
 */
const TONE_OVERRIDE: Partial<Record<Tone, string>> = {
  danger: 'bg-badge-error-bg text-badge-error-text',
};

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {`,
);

edit(
  'packages/ui/src/components/badge.tsx',
  `    className={cn('justify-center', size === 'sm' ? 'min-w-5' : 'min-w-6', className)}`,
  `    className={cn(
      'justify-center',
      size === 'sm' ? 'min-w-5' : 'min-w-6',
      TONE_OVERRIDE[tone],
      className,
    )}`,
);

// The chip takes the same correction, through the same table.
edit(
  'packages/ui/src/components/badge.tsx',
  `const COLOUR: Record<Tone, BadgeColour> = {`,
  `export const badgeToneOverride = (tone: Tone): string | undefined => TONE_OVERRIDE[tone];

const COLOUR: Record<Tone, BadgeColour> = {`,
);

edit(
  'packages/ui/src/components/status.tsx',
  `import type { BadgeColour, Tone } from './badge.js';`,
  `import { badgeToneOverride, type BadgeColour, type Tone } from './badge.js';`,
);

edit(
  'packages/ui/src/components/status.tsx',
  `      className={className}
      {...rest}`,
  `      className={cn(badgeToneOverride(presentation.tone), className)}
      {...rest}`,
);

// ── 3. The count on the bell ────────────────────────────────────────────────
edit(
  'packages/ui/src/components/icon-button.tsx',
  `            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bg-error px-1 text-3xs font-semibold text-text-on-brand"`,
  `            // White on the solid error fill measures 2.77:1 in dark and
            // 3.76:1 in light — both short of 4.5 — and 10px is below the
            // smallest size the system sets text at. The badge's own error
            // pair clears AA in both themes (6.93:1 / 5.91:1), and the pill
            // grows to 18px so a 12px numeral still sits centred in it.
            className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-badge-error-bg px-1 text-xs font-semibold text-badge-error-text"`,
);

// ── 4. A link in a table cell, big enough to hit ────────────────────────────
edit(
  'packages/ui/src/components/table.tsx',
  `                    'px-3 py-3 align-middle text-sm text-text-secondary',`,
  `                    'px-3 py-3 align-middle text-sm text-text-secondary',
                    // A cell's link was 20px tall — under the 24px a pointer
                    // target needs. Padding an inline box grows what can be
                    // clicked without growing the line it sits on, so the hit
                    // area reaches 24px and the row keeps its height.
                    '[&_a]:py-0.5',`,
);

console.log('all four applied');
