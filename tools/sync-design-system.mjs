/**
 * Copy the design system's React components into `packages/ui/src/ds`.
 *
 * The system publishes its components as `@ideeza/ui` — the same name this
 * repository's own component package already has, and it ships only built
 * output that its git tarball does not contain. So the sources are copied in
 * at a pinned commit rather than installed, and this script is the copy: run
 * it to refresh, and the diff shows exactly what the design team changed.
 *
 *   node tools/sync-design-system.mjs            # refresh at the pinned commit
 *   node tools/sync-design-system.mjs --check    # fail if the copy has drifted
 *
 * The commit is the one `@ideeza/tokens` is pinned to in `pnpm-lock.yaml`, so
 * the components and the variables they name always come from the same place.
 * Nothing here is edited by hand; the one rewrite is the icon import, which
 * points at a local module because the system's icon package has the same
 * build problem and this repository already carries the same icon set.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const REPO = 'https://github.com/mehediuid/IDEEZA-Design-System.git';
const DESTINATION = 'packages/ui/src/ds';

const COMPONENTS = [
  'Badge',
  'Button',
  'Checkbox',
  'Field',
  'IconButton',
  'Input',
  'Radio',
  'Select',
  'Textarea',
  'Toggle',
];

const check = process.argv.includes('--check');

/** The commit the tokens package is locked to. One source, one version. */
const pinnedCommit = () => {
  const lock = readFileSync('pnpm-lock.yaml', 'utf8');
  const found = lock.match(/IDEEZA-Design-System\/tar\.gz\/([0-9a-f]{40})/);
  if (found === null) {
    throw new Error('pnpm-lock.yaml does not pin @ideeza/tokens to a commit');
  }
  return found[1];
};

/**
 * The system's components import their glyphs from its icon package. That
 * package is generated from the Figma icon library, which is the same set this
 * repository already installs, so the import is pointed at a local module that
 * re-exports those glyphs under the names the components ask for.
 */
const rewrite = (source) =>
  source
    // The system's icons, served from the set this repository already installs.
    // Its components reach them through its own `lib/icons` module, so both
    // that path and the package name point at the local re-export.
    // Three levels, not two: a copied component sits at
    // `src/ds/components/<Name>/`, so `src/lib` is three hops up.
    .replace(/(["'])@ideeza\/icons\1/g, "'../../../lib/ds-icons.js'")
    .replace(/(["'])(?:\.\.\/)+lib\/icons(?:\.js)?\1/g, "'../../../lib/ds-icons.js'")
    // The system's class merge, with this project's type scale declared — see
    // `src/lib/ds-cn.ts` for what goes wrong without it.
    .replace(/(["'])(?:\.\.\/)+lib\/cn(?:\.js)?\1/g, "'../../../lib/ds-cn.js'")
    // This package compiles with node16 module resolution, which wants the
    // extension on a relative import; the system's build does not. Mechanical.
    .replace(/(from\s+["'])(\.[^"']*?)(["'])/g, (whole, head, target, tail) =>
      /\.(js|json|css)$/.test(target) ? whole : `${head}${target}.js${tail}`,
    )
    // `exactOptionalPropertyTypes` is on here and off in the system's build, so
    // an optional prop the system fills with a possibly-undefined value is an
    // error this project would otherwise have to silence. Widening every
    // optional declaration accepts the explicit undefined and changes nothing
    // at all at runtime — it is the same set of values, spelled out.
    //
    // A function type is left alone: appending to `() => void` would widen the
    // return type rather than the property, which is a different statement and
    // not the one being made here.
    .replace(
      /^(\s*(?:readonly )?[A-Za-z_$][\w$]*)\?: ([^;\n]+);$/gm,
      (whole, head, type) =>
        /\|\s*undefined\s*$/.test(type) || type.includes('=>')
          ? whole
          : `${head}?: ${type} | undefined;`,
    )
    .replace(/\?: string \}/g, '?: string | undefined }');

const commit = pinnedCommit();
const work = mkdtempSync(join(tmpdir(), 'ideeza-ds-'));
const git = (...args) => execFileSync('git', ['-C', work, ...args], { encoding: 'utf8' });

try {
  execFileSync('git', ['clone', '--quiet', '--filter=blob:none', '--no-checkout', REPO, work], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  git('fetch', '--quiet', 'origin', commit);

  // `lib/cn.ts` is deliberately not copied: the rewrite below points the
  // components at `src/lib/ds-cn.ts`, which is the system's own merge with this
  // project's type scale declared, so a style class is not mistaken for a
  // colour and dropped.
  const wanted = [
    ...COMPONENTS.flatMap((name) => [
      `components/${name}/${name}.tsx`,
      `components/${name}/index.ts`,
    ]),
  ];

  let written = 0;
  const drifted = [];

  for (const relative of wanted) {
    const source = rewrite(git('show', `${commit}:packages/ui/src/${relative}`));
    const target = join(DESTINATION, relative);

    if (check) {
      const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
      if (current !== source) drifted.push(relative);
      continue;
    }

    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
    written += 1;
  }

  if (check) {
    if (drifted.length > 0) {
      console.error(`the copy has drifted from ${commit.slice(0, 7)}:`);
      for (const file of drifted) console.error(`  ${file}`);
      process.exit(1);
    }
    console.log(`the copy matches the design system at ${commit.slice(0, 7)}`);
  } else {
    // A note beside the files, so nobody edits them expecting the edit to last.
    writeFileSync(
      join(DESTINATION, 'README.md'),
      [
        '# Copied from the design system',
        '',
        'These files are the design system’s own components, copied from',
        `\`mehediuid/IDEEZA-Design-System\` at commit \`${commit}\` — the commit`,
        '`@ideeza/tokens` is pinned to in `pnpm-lock.yaml`.',
        '',
        '**Do not edit them.** `node tools/sync-design-system.mjs` overwrites',
        'this directory, and `--check` fails the build if anything here has',
        'drifted. To change a component, change it in the design system.',
        '',
        'The one rewrite the copy applies: `@ideeza/icons` becomes',
        '`../../lib/ds-icons.js`, which serves the same glyphs from the icon set',
        'this repository already installs.',
        '',
      ].join('\n'),
    );
    console.log(`copied ${written} files from ${commit.slice(0, 7)} into ${DESTINATION}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
