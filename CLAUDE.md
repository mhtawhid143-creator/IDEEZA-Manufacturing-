# CLAUDE.md — IDEEZA Manufacturing Platform

Rules for any agent working in this repository. Read this first; it outranks
defaults. Where a rule points at a document, that document is the authority.

## 1. What this is

A manufacturing marketplace. A buyer sends a product to manufacture, selected
manufacturers quote, the buyer accepts one quote, the platform secures the
payment, and only then does a `ManufacturingOrder` exist — followed by
production tracking, delivery, refund/dispute and payout release. IDEEZA
facilitates; the buyer and manufacturer remain the commercial counterparties.

- **pnpm monorepo** (`pnpm@11`, Node ≥ 20). Never `npm` — `workspace:*`
  protocol, `pnpm-lock.yaml` and `allowBuilds` in `pnpm-workspace.yaml`.
- `apps/user` — buyer panel (Next.js 15, React 19, port 3100)
- `apps/manufacturer` — shop panel (Next.js 15, React 19, port 3200)
- `apps/ops` — operations panel, **not built** (see README "What is not built")
- `packages/domain` — business rules: statuses, state machines, invariants,
  permissions, events. **The only place a status may change.**
- `packages/types` — Zod schemas for every boundary
- `packages/db` — Prisma 6 schema, migrations, seed, BigInt money mapping
- `packages/auth` — scrypt passwords, opaque sessions, actors, route rules
- `packages/ui` — this repo's component layer over the design system
- `packages/config` — shared tooling, the two custom ESLint rules
- `tools/` — review environment, verification harnesses, demo database prep

Docs: `docs/DOMAIN.md`, `DATABASE.md`, `AUTH.md`, `DESIGN-SYSTEM.md`,
`USER-JOURNEY.md`, `USER-SIDE-PLAN.md`, `MANUFACTURER-SIDE-PLAN.md`,
`DEPLOY-REVIEW.md`, `GAP-REPORT-BN.md` (Bengali).

## 2. Commands

```bash
pnpm install
pnpm -r --filter './packages/*' run build   # needed before seed/review (dist/)
pnpm -r --filter './apps/*' run build       # next build, both panels
pnpm run typecheck                          # tsc --noEmit, every package
pnpm run lint                               # eslint incl. the two custom rules
pnpm run test                               # ALL vitest projects (boots embedded postgres)
pnpm exec vitest run --project unit --project ui --project unit-manufacturer   # fast, no db
pnpm exec vitest run --project database                                        # buyer + packages db tests
pnpm exec vitest run --project database-manufacturer                           # shop db tests
pnpm run verify                             # typecheck + lint + test + build
pnpm run review                             # throwaway postgres + both panels (3100/3200)
```

`pnpm run review` expects the packages and both apps **already built**. It runs
with `REVIEW_DIRECT_SIGN_IN=1` (password-less sign-in, localhost only). Do not
start a second one while one is running; Ctrl+C removes its database.

## 3. How to work — skills are mandatory

Invoke the skill **before** acting, not after. If there is a 1% chance a skill
applies, use it.

| Situation | Skill |
| --- | --- |
| Any new feature, component, behaviour change | `superpowers:brainstorming` first, then `superpowers:writing-plans` for multi-step work |
| Writing any code, feature or fix | `superpowers:test-driven-development` — failing test first, then code |
| Bug, failing test, unexpected behaviour | `superpowers:systematic-debugging` before proposing a fix |
| Executing a written plan | `superpowers:executing-plans` or `superpowers:subagent-driven-development` |
| Work that needs isolation | `superpowers:using-git-worktrees` |
| Finished a task / before merge | `superpowers:requesting-code-review`, then `superpowers:verification-before-completion` |
| Received review feedback | `superpowers:receiving-code-review` |
| Anything UI: design, redesign, polish, audit, layout, colour, motion, copy, accessibility, responsive | `impeccable` **and** `ui-ux-pro-max:ui-ux-pro-max` — both, before touching a component |
| Charts / dashboards | `dataviz` |
| Frontend styling with shadcn/Tailwind patterns | `ui-ux-pro-max:ui-styling` |

Never claim "done", "fixed" or "passing" without having run the command and
read its output in this session. Evidence before assertions.

## 4a. Component design — 100% from the Figma design system

The design authority for **every component** is the IDEEZA Design System Figma
file: https://www.figma.com/design/V3uizmZLHo5Xhy65Dp3F0O/IDEEZA-%E2%80%94-Design-System
Its npm counterpart is `@ideeza/tokens` (github `mehediuid/IDEEZA-Design-System`).
The file spans ~24 pages (Index, Tokens, Foundations, Atoms — Action/Input/
Display/Chart, nine Molecules pages, Organisms — App/Marketing, four Screens
pages, Email Templates, Icons) and publishes **177 components**: 33 atoms
(A01–A30), 111 molecules (M01–M135, with gaps), 33 organisms (O01–O38, with
gaps). The complete inventory, with variant counts and one-line descriptions,
is `docs/FIGMA-DS-CATALOG.md` — **check it first**: if a component exists
there, its Figma spec is the design, not your taste.

Caveat: the Figma page-list API serves this file a stale 5-page listing —
never conclude a page or component is absent from the listing alone; node
queries and `search_design_system` see the live file, so search by name
(`search_design_system`, library "IDEEZA — Design System") to locate a
component and then read its variant node.

- **Before building or restyling any component**, pull its spec from that file
  with the Figma MCP (`get_design_context` on the variant node — load the
  `figma-design-to-code` skill first). Do not restyle from memory or taste.
- Where the system's components live in `packages/ui` today:
  A01 Button → `button-appearance.ts`/`button.tsx` · A02 Icon Button →
  `icon-button.tsx` · A04/A05/A07 Text Input/Textarea/Search → `input.tsx` ·
  A06 Select → `select.tsx` · A08/A10 Selection/Toggle → `choice.tsx` ·
  A17 Badge → `badge.tsx` + `status.tsx` (StatusChip = Subtle) · A18 Tag →
  `Tag` · A19 Tooltip → `tooltip.tsx` · A20 Spinner → `spinner.tsx` ·
  A21 Skeleton + M48/M49 Empty/Error State → `states.tsx` · F06 Icon →
  `icon.tsx` · M01 Alert → `alert.tsx` · M02 Toast → `toast.tsx` · M07 Modal /
  M08 Drawer → `overlay.tsx` · M14 Tabs → `tabs.tsx` · M18 Dropdown Menu →
  `dropdown-menu.tsx` · M19 Breadcrumb → `breadcrumbs.tsx` · M21 Card →
  `card.tsx` · M27 Form Field → `form-field.tsx` · M33 Stepper → `stepper.tsx` ·
  M60–M62/M64 Table → `table.tsx` · A26 Dot + M06 Status Block → `status.tsx`.
  The rest of the catalog (charts M110–M115/M130, marketing M86–M99, organisms)
  has no counterpart here yet — when one is needed, build it from its Figma
  spec and add it to this map.
- Specs already encoded from the file (keep them true): **A01 Button** ramp —
  SM 32/radius-lg/px12/gap6/12-16 · MD 36/radius-lg/px14/gap6/14-20 ·
  LG 40/radius-xl/px16/gap6/14-20 · XL 44/radius-xl/px20/gap8/16-24 ·
  2XL 48/radius-2xl/px24/gap8/16-24, all semibold with `tracking-wide`; flat
  fills; secondary border 1.5px; focus = 3px halo ring; disabled/loading are
  variants, never opacity. **A17 Badge** (Subtle) — px-2 py-1 gap-1 text-xs
  regular, full radius, 6px dot, colours from `--color-badge-*` (neutral =
  `bg-bg-subtle text-text-secondary`). **A18 Tag** — raised surface, default
  border, px-2.5 py-1.5, caption regular, primary text.
- `@ideeza/tokens` is pinned in the lockfile. When the Figma file gains tokens
  the package build already exports, refresh with
  `pnpm --filter @ideeza/ui update @ideeza/tokens`, then expose the new family
  in `tailwind-preset.cjs` and note it in `docs/DESIGN-SYSTEM.md` §11. If the
  Figma file uses a token the package does not ship, that is a gap for the
  design team — record it, use the nearest shipped token, never invent one.
- A component the system does not publish yet (Card, DataTable, Tabs, Modal …)
  is built here in `packages/ui` from the system's tokens and the panel Figma
  frames, and moves to the system when it arrives there.

## 4. Design tokens — 100% from the design system

Every colour, type size, line height, tracking, weight, radius, elevation,
spacing, layer (z), opacity, border width and motion value comes from
`@ideeza/tokens` (the design team's system, `github.com/mehediuid/IDEEZA-Design-System`)
through `packages/ui/tailwind-preset.cjs`. **Nothing else is allowed.** The
ESLint rule `ideeza/design-tokens` enforces this in `packages/ui/src` and both
apps; CI fails on a violation.

### Use these names

| Need | Use | Never |
| --- | --- | --- |
| surface / page / raised | `bg-bg-surface`, `bg-bg-page`, `bg-bg-surface-raised`, `bg-bg-subtle`, `bg-bg-inverse` | `bg-white`, `bg-gray-50`, `bg-[#…]` |
| brand | `bg-bg-brand`, `hover:bg-bg-brand-hover`, `active:bg-bg-brand-pressed`, `bg-bg-brand-subtle`, `text-text-brand`, `border-border-brand` | `bg-violet-600`, `bg-purple-*` |
| status | `bg-bg-success/-subtle`, `bg-bg-warning/-subtle`, `bg-bg-error/-subtle`, `bg-bg-info/-subtle`, `text-text-success/warning/error` | `bg-green-*`, `text-red-*` in screens |
| text | `text-text-primary` (headings), `text-text-secondary` (body), `text-text-tertiary` (muted), `text-text-disabled`, `text-text-link` | `text-gray-*`, `text-black` |
| words on a filled brand/dark surface | `text-text-on-brand`, `text-text-inverse` | `text-white` |
| icons | `text-icon`, `text-icon-secondary`, `text-icon-disabled`, `text-icon-on-brand`, `text-icon-brand/blue/success/warning/error` | colouring an icon with `text-text-*` |
| borders | `border-border` (default), `border-border-subtle`, `border-border-strong`, `border-border-error`, `border-border-focus` | `border-gray-200` |
| buttons | **only** through `Button` / `buttonAppearance()`; its classes are `bg-button-primary-bg`, `text-button-tonal-text`, `hover:bg-button-danger-bg-hover` … | hand-rolled button colours |
| inputs | **only** through `FormField`/`Input`/`Select`/`Textarea`; `fieldControlClasses` uses `bg-input-bg`, `border-input-border`, `text-input-placeholder`, `text-input-error-text` | hand-rolled field colours |
| type size | `text-3xs` (10) `text-2xs` (11) `text-xs` (12) `text-sm` (14) `text-base` (16) `text-lg` (18) `text-xl` (20) `text-2xl` (24) `text-3xl` (28) `text-4xl` (32) … `text-7xl` | `text-[11px]`, `text-[13px]` |
| line height | leave it to the size; if separate, `leading-3xs … leading-xl` | `leading-5`, `leading-none`, `leading-[…]` |
| weight | `font-normal / medium / semibold / bold / extrabold` | `font-light`, `font-black` |
| tracking | `tracking-caps` (uppercase labels), `tracking-near` / `tracking-slight` (tight headings), `tracking-tight…widest` | `tracking-wide`, `tracking-[-0.02em]` |
| radius | `rounded` (= system sm), `rounded-md/lg/xl/2xl/3xl/full` | `rounded-[3px]` |
| elevation | `shadow-1 … shadow-6`, `shadow-inner` | `shadow-sm/md/lg/xl` |
| layers | `z-sticky` (navbar, sticky bars), `z-dropdown`, `z-popover` (tooltip), `z-overlay`, `z-sheet`, `z-modal`, `z-toast`, `z-notification` | `z-10`, `z-50` |
| opacity | `opacity-disabled` (.4), `opacity-muted` (.6), `opacity-overlay` (.8), `opacity-hover`, `opacity-pressed` | `opacity-50`, `opacity-60` |
| border width | `border`, `border-1.5`, `border-2`, `border-3` | `border-[3px]` |
| motion | `duration-fast/normal/slow/slower`, `ease-standard/decelerate/accelerate/sharp/spring`, `animate-fade-in/slide-up/slide-in-right` | `duration-150`, `ease-in-out` |
| spacing | Tailwind's numbers (`p-4`, `gap-3`, `mt-6`) — each resolves to the system's variable (`p-4` → `--spacing-8`, 16px). Use the existing steps: 0 .5 1 1.5 2 2.5 3 3.5 4 5 6 7 8 9 10 12 16 20 24 | new arbitrary spacing values |
| shell | `h-navbar`, `w-sidebar`, `px-gutter`, `max-w-content`, `max-w-measure` | pixel copies of these |
| tone chips / dots | `bg-bg-success-subtle text-text-success`, `bg-bg-warning-subtle text-text-warning`, `bg-bg-error-subtle text-text-error`, `bg-bg-info-subtle text-text-link`, `bg-bg-subtle text-text-secondary`; neutral dot `bg-icon` | `bg-green-100`, `bg-red-100`, `bg-gray-600` |
| soft frames / thumbnails | `border-border-error`, `bg-bg-warning-subtle`, `from-bg-brand-subtle to-bg-info-subtle` | `border-red-100`, `border-border-error/40`, `to-blue-100` |
| primitives | **none.** The system's swatches (`violet-*`, `gray-*`, `blue-*`, `green-*`, `red-*`, `yellow-*`, `orange-*`) are not in the preset and are refused by lint | `bg-violet-100`, `text-red-700`, `bg-gray-200`, `var(--color-gray-600)` |

### Rules

- **Colour is 100% semantic. MUST.** Every colour a screen or component asks
  for is a semantic token — `bg-bg-*`, `text-text-*`, `border-border-*`,
  `text-icon-*`, `bg-button-*`, `bg-input-*`. A primitive swatch
  (`bg-green-100`, `text-red-700`, `bg-gray-600`, `var(--color-violet-100)`)
  is never allowed, in a class, a style, or `packages/ui/src/styles/*.css`.
  Reason: a swatch does not know what it is for, so it cannot follow the theme
  — the pale green pill that looked right on white stayed pale green in dark
  mode. A semantic token carries both themes. If no semantic token fits, pick
  the nearest one and note the gap in `docs/DESIGN-SYSTEM.md` §11; do not reach
  for a primitive "just this once".
- **No opacity modifiers on colour tokens** (`bg-bg-error/40`,
  `border-border-warning/30`). Tokens are CSS variables and Tailwind drops the
  modifier silently. Use the `-subtle` token for a paler surface.
- **Never write a literal colour** (`#hex`, `rgb()`, `hsl()`) or an arbitrary
  colour/type/tracking/shadow/z/opacity/duration value in a class or style.
- Layout measurements are not tokens and are fine: `min-w-[150px]`,
  `grid-cols-[minmax(0,1fr)_320px]`, `h-[calc(100dvh-var(--layout-navbar-height))]`.
- A genuine exception (a physical colour, artwork generated from data) gets an
  `eslint-disable ideeza/design-tokens -- <reason>` on the line, and the reason
  is written. Existing exceptions: solder-mask swatches in `board-spec-form.tsx`;
  hue-generated placeholder art in `model-preview.tsx`, `draft-list.tsx`,
  `request-quote-form.tsx`. Do not add one without saying why in the code.
- Never add a CSS variable, hex, or pixel to `packages/ui/src/styles/tokens.css`.
  It imports `@ideeza/tokens/css` and holds only the four `--layout-*` shell
  measurements. If the system lacks a token, say so in `docs/DESIGN-SYSTEM.md`
  and use the nearest system token — do not invent one.
- New token family from the system? Add it to `tailwind-preset.cjs` under the
  system's own names, extend the lint rule if a Tailwind default could stand in
  for it, and document it in `docs/DESIGN-SYSTEM.md` §11.
- Icons come from `packages/ui/src/components/icon.tsx` (one set, Hugeicons).
  Never draw an SVG by hand in a screen; add a name to `Icon` instead.
- Components live in `packages/ui`. A screen composes them; it does not
  reinvent a card, table, tab, badge, toast, modal or empty state. If a
  component is missing, add it to `packages/ui` with a test.
- Every state is designed: loading, empty, error, disabled, unavailable.
  `unavailable` (the control exists but nothing is behind it) is a real
  appearance — mark unbuilt routes honestly; never fake an outcome.
- Contrast is measured, not judged: keep every text token at AA on the surface
  it sits on (numbers are recorded in `DESIGN-SYSTEM.md` §11).
- Figma frames: mobile 390, tablet 768, desktop 1440; breakpoints `sm 480`,
  `md 768`, `lg 960`, `xl 1280`, `2xl 1440`. Verify at 1440×900 and 390×844.

## 5. Domain and data rules (non-negotiable)

- **Status changes only through a state machine.** Every status write on
  `ManufacturingOrder`, `Quote`, `Rfq`, `Payment`, `Payout`, `Refund`,
  `Dispute`, `ProductionStage`, `Withdrawal` is
  `applyTransition(<machine>, from, to, context)` from `@ideeza/domain`. Never
  `status: 'delivered'` as a literal in `apps/*/src/data`. The machine carries
  the guards (funding secured, documented completion, ops-only decisions).
- **Money is integer minor units.** Domain `Money.amountMinor: number`; DB
  columns `BigInt` + `CHAR(3)` currency + CHECK constraints. Convert with
  `packages/db/src/money.ts`. No floats; major units only at the form edge
  (`Math.round(value * 100)`).
- **Ownership on every read and write.** The first query scopes by actor:
  `{ id, buyerId }`, `{ id, manufacturerId }`,
  `participants: { some: { userId } }`; manufacturers see an RFQ only through
  its routing row; quotes are confidential between manufacturers.
- **Validate at the boundary with Zod** from `@ideeza/types` (`safeParse`) in
  every server action; return typed error states, do not throw at the user.
- **One transaction per business act**, with its `DomainEvent`(s) written in
  the same `$transaction`. Events are append-only (DB trigger).
- **Money leaves escrow only against a documented release trigger**
  (`docs/DOMAIN.md` §3): `order.delivery_confirmed`,
  `order.review_window_expired`, `inspection.evidence_accepted`,
  `partial_refund.agreed`, `dispute.resolved`. `payOrder` opens the `Payout`
  row in the same transaction that secures the payment; `confirmDelivery`
  refuses to complete an order whose secured payment has no payout.
- **Roles.** Buyer-only: create/withdraw request, accept quote, pay, confirm
  delivery, request refund, review. Manufacturer-only: decline request, quote,
  suggest substitution, update production, inventory, withdraw balance.
  Ops-only: decide cancellation, decide refund, resolve dispute, release a
  held payout, pay a withdrawal. A manufacturer can never cancel or terminate
  an order — it raises a cancellation request or a dispute.
- **Retired vocabulary** (`ideeza/legacy-vocabulary` rule): never `contract`,
  `proposal`, `offer`, `scope`, `milestone`, `transaction` as identifiers,
  statuses or copy in domain/types. Use quote, RFQ, manufacturing
  requirements, production stage, payment/payout.
- **Schema change = migration + seed + docs.** Edit `prisma/schema.prisma`,
  generate the migration (`pnpm --filter @ideeza/db run migration:new`), keep
  `docs/DATABASE.md` true, update fixtures in `tools/` and the seed.
- IDs: use the existing `identifier(prefix)` helper pattern per data file; do
  not introduce a second id scheme.

## 6. Auth and review mode

- Sessions are opaque, server-side, `httpOnly`, `sameSite: lax`, `secure` in
  production; scrypt N=2^15; lockout after failed attempts. Do not weaken.
- `REVIEW_DIRECT_SIGN_IN=1` enables `/auth/enter` (password-less). It is set
  **only** by `tools/review-environment.mjs`. Off localhost it also demands
  `REVIEW_DIRECT_SIGN_IN_TOKEN` (16+ chars) via `?token=`/cookie
  (`directSignInAdmitted`). Never set either on anything holding real data;
  never remove the host/token check. `docs/DEPLOY-REVIEW.md` is the recipe.
- Never commit `.env`; `.env.example` is the template. No secrets in code,
  fixtures or docs.

## 7. Testing

- Unit/UI projects need no database; `*.db.test.ts` boot an embedded Postgres
  and run the real seed and the real data-layer functions — **test against
  rows, not mocks** (`vi.mock` is a last resort).
- Every mutation gets: a happy path, the refusal for another actor (IDOR), and
  the refusal for an illegal state. Money paths assert the ledger rows exist
  (payment, payout, events), not just the status.
- Shared seed order `seed_order_1` is mutated by several manufacturer tests —
  restore what you change (see `orders.db.test.ts` for the pattern).
- Test quantities are also quote ids (`dq_<quantity>`); pick an unused number.
- Lint-rule changes get a `RuleTester` test in `packages/config/test`.
- Before saying done: `pnpm run typecheck && pnpm run lint && pnpm exec vitest run`
  (all projects), and for UI changes build both apps and look at the panels
  (`pnpm run review`, screenshots at 1440 and 390).

## 8. Git

- `main` — approved, stable. `develop` — active. Feature work on
  `feature/<name>` branches; the older `feature/T0x-*` branches are history.
- Commit only when asked; never push without an explicit request. Commit
  messages follow the existing style: `type(scope): what it does, in a
  sentence` (`fix(dashboard): …`, `feat(tokens): …`, `docs: …`).
- Keep README task table and `docs/*` true when scope changes; stale docs are
  a defect (see the review that found "T08+ not started" beside a built T13).

## 9. Writing style in this repo

Comments explain *why*, in full sentences, and name the rule they protect.
User-facing copy says what is true: "not implemented yet" beats a fake screen.
No console output in app code (`no-console` is an error).
