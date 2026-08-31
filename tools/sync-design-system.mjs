/**
 * Vendors the design system's React components into packages/ds-ui.
 *
 * The design team's repository (mehediuid/IDEEZA-Design-System) publishes its
 * components as TypeScript source with no build artefacts and under the name
 * `@ideeza/ui`, which this repository already uses. So the sources are taken
 * verbatim — this script downloads the repo at main, copies `packages/ui/src`
 * and the generated icon sources, rewrites the one cross-package import, and
 * stamps the commit it took. Nothing in packages/ds-ui/src is ever edited by
 * hand; to update, run this again:
 *
 *   node tools/sync-design-system.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'packages', 'ds-ui', 'src');
const REPO = 'https://github.com/mehediuid/IDEEZA-Design-System';

const sha = execSync(`git ls-remote ${REPO} refs/heads/main`, { encoding: 'utf8' })
  .split('\t')[0]
  .trim();

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ideeza-ds-'));
execSync(
  `curl -sL ${REPO.replace('github.com', 'codeload.github.com')}/tar.gz/${sha} | tar xz -C ${tmp} --strip-components=1`,
  { stdio: 'inherit', shell: '/bin/bash' },
);

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.cpSync(path.join(tmp, 'packages', 'ui', 'src'), target, { recursive: true });
fs.cpSync(path.join(tmp, 'packages', 'icons', 'src'), path.join(target, 'icons-vendor'), {
  recursive: true,
});

// The components import icons from `@ideeza/icons`; here that package lives
// inside this one, so the specifier becomes relative.
const rewrite = (file) => {
  const text = fs.readFileSync(file, 'utf8');
  const depth = path.relative(target, path.dirname(file)).split(path.sep).filter(Boolean).length;
  const prefix = depth === 0 ? './' : '../'.repeat(depth);
  let next = text.replaceAll('"@ideeza/icons"', `"${prefix}icons-vendor/index.js"`);
  // The design repo resolves extensionless relative imports (bundler mode);
  // this repo is NodeNext, which demands the `.js`. Appended mechanically:
  // a specifier that names a directory gets `/index.js`, a file gets `.js`.
  next = next.replace(/from "(\.{1,2}\/[^"]+)"/g, (whole, spec) => {
    if (/\.(js|json|css)$/.test(spec)) return whole;
    const abs = path.resolve(path.dirname(file), spec);
    const suffix = fs.existsSync(abs) && fs.statSync(abs).isDirectory() ? '/index.js' : '.js';
    return `from "${spec}${suffix}"`;
  });
  if (next !== text) fs.writeFileSync(file, next);
};
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(entry.name)) rewrite(p);
  }
};
walk(target);

fs.writeFileSync(
  path.join(root, 'packages', 'ds-ui', 'VENDORED.md'),
  `# Vendored design-system sources\n\nEverything under \`src/\` is copied verbatim from\n${REPO} at commit \`${sha}\`\n(\`packages/ui/src\` plus \`packages/icons/src\` as \`src/icons-vendor\`, with the\n\`@ideeza/icons\` import rewritten to the vendored path). Do not edit these\nfiles by hand — run \`node tools/sync-design-system.mjs\` to update.\n`,
);
fs.rmSync(tmp, { recursive: true, force: true });
process.stdout.write(`vendored ${sha}\n`);
