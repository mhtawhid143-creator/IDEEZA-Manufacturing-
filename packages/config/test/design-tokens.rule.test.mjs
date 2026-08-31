import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../eslint/design-tokens.mjs';

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('design-tokens lint rule', () => {
  it('accepts the system’s names and refuses literals and Tailwind defaults', () => {
    ruleTester.run('design-tokens', rule, {
      valid: [
        { code: 'const c = "bg-bg-surface text-text-primary border-border-subtle";' },
        { code: 'const c = "text-2xs tracking-caps leading-sm";' },
        { code: 'const c = "z-modal opacity-muted duration-fast ease-decelerate shadow-3";' },
        { code: 'const c = "bg-button-primary-bg text-icon border-input-border";' },
        // the semantic tones, which carry both themes
        { code: 'const c = "bg-bg-success-subtle text-text-success bg-bg-error-subtle text-text-error bg-icon";' },
        // layout is not a look
        { code: 'const c = "min-w-[150px] grid-cols-[minmax(0,1fr)_320px] h-[calc(100dvh-var(--x))]";' },
        // a variable is a token by definition
        { code: 'const c = "var(--color-bg-brand)";' },
        // an anchor is not a colour
        { code: 'const href = "/orders#items";' },
        // a comment may explain a colour
        { code: '// #7c3aed is the brand violet\nconst c = 1;' },
      ],
      invalid: [
        { code: 'const c = "#7c3aed";', errors: [{ messageId: 'hardcoded' }] },
        { code: 'const c = `hsl(${h} 40% 38%)`;', errors: [{ messageId: 'hardcoded' }] },
        { code: 'const c = "rounded-full bg-bg-brand text-white";', errors: [{ messageId: 'hardcoded' }] },
        { code: 'const c = "hover:bg-slate-100";', errors: [{ messageId: 'hardcoded' }] },
        { code: 'const c = "text-[11px]";', errors: [{ messageId: 'hardcoded' }] },
        { code: 'const c = "tracking-[-0.02em]";', errors: [{ messageId: 'hardcoded' }] },
        { code: 'const c = "leading-none";', errors: [{ messageId: 'hardcoded' }] },
        { code: 'const c = "shadow-md";', errors: [{ messageId: 'hardcoded' }] },
        { code: 'const c = "fixed inset-0 z-50";', errors: [{ messageId: 'hardcoded' }] },
        { code: 'const c = "opacity-60";', errors: [{ messageId: 'hardcoded' }] },
        { code: 'const c = "duration-150";', errors: [{ messageId: 'hardcoded' }] },
        { code: 'const c = "font-light";', errors: [{ messageId: 'hardcoded' }] },
        { code: 'const c = "bg-[#fff]";', errors: [{ messageId: 'hardcoded' }] },
        // a system primitive is a swatch, not a colour of the interface
        { code: 'const c = "bg-green-100 text-text-success";', errors: [{ messageId: 'hardcoded' }] },
        { code: 'const c = "text-red-700";', errors: [{ messageId: 'hardcoded' }] },
        { code: 'const c = "bg-gradient-to-br from-bg-brand-subtle to-blue-100";', errors: [{ messageId: 'hardcoded' }] },
        // an opacity modifier on a variable-backed token is dropped by Tailwind
        { code: 'const c = "border-border-error/40";', errors: [{ messageId: 'hardcoded' }] },
        { code: 'const c = "var(--color-violet-100)";', errors: [{ messageId: 'hardcoded' }] },
      ],
    });
  });
});
