# Copied from the design system

These files are the design system’s own components, copied from
`mehediuid/IDEEZA-Design-System` at commit `4e0ffa5b2297fdaf92c067b23b9ee4b5fbcaf6bd` — the commit
`@ideeza/tokens` is pinned to in `pnpm-lock.yaml`.

**Do not edit them.** `node tools/sync-design-system.mjs` overwrites
this directory, and `--check` fails the build if anything here has
drifted. To change a component, change it in the design system.

The one rewrite the copy applies: `@ideeza/icons` becomes
`../../lib/ds-icons.js`, which serves the same glyphs from the icon set
this repository already installs.
