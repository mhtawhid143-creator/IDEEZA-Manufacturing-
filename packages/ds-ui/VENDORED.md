# Vendored design-system sources

Everything under `src/` is copied verbatim from
https://github.com/mehediuid/IDEEZA-Design-System at commit `4e0ffa5b2297fdaf92c067b23b9ee4b5fbcaf6bd`
(`packages/ui/src` plus `packages/icons/src` as `src/icons-vendor`, with the
`@ideeza/icons` import rewritten to the vendored path). Do not edit these
files by hand — run `node tools/sync-design-system.mjs` to update.
