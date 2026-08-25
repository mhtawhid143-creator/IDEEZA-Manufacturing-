import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The retired freelancer-marketplace vocabulary. The design files still carry
 * these words, so this test is the second line of defence behind the lint rule.
 */
const RETIRED_WORDS = [
  'contract',
  'contractual',
  'proposal',
  'offer',
  'offering',
  'scope',
  'milestone',
  'transaction',
];

const SOURCE_ROOTS = ['packages/domain/src', 'packages/types/src'];

const collectFiles = (directory: string): readonly string[] => {
  const entries = readdirSync(directory);
  return entries.flatMap((entry) => {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) return collectFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
};

/** Comments may name a retired word in order to explain why it is retired. */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

const pattern = new RegExp(`\\b(${RETIRED_WORDS.join('|')})s?\\b`, 'i');

describe('retired business vocabulary never enters the domain code', () => {
  const files = SOURCE_ROOTS.flatMap((root) => collectFiles(resolve(process.cwd(), root)));

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it.each(files)('%s is free of retired terms', (file) => {
    const code = stripComments(readFileSync(file, 'utf8'));
    const match = pattern.exec(code);
    expect(
      match === null ? null : `${file} contains retired term "${match[1]}"`,
    ).toBeNull();
  });
});
