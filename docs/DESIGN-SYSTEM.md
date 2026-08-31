# Design system and buyer app shell (T04)

## 1. Where the tokens come from

Two Figma files describe the same product, and they do not agree on everything.
Both were read, and the conflict is resolved deliberately rather than silently:

| Concern | IDEEZA Design System file | User Panel V2 file | Shipped |
| --- | --- | --- | --- |
| Brand | `color/violet/600` `#7C2DB9` | `--primaryColor` `#7C2DB9` | `#7C2DB9` (they agree) |
| Secondary | — | `--SecondaryColor` `#FE2AD4` | `#FE2AD4` |
| Type family | Manrope, marked "recommended" | Inter (`Typaface/Body`, `Typaface/Heading`) | **Inter** |
| Text ramp | slate: `#0C121D`, `#475569`, `#64748B` | warm violet: `#0E0515`, `#4A4450`, `#B2AFB4` | **User Panel values** |
| Border / surface | `#E2E8F0` / `#F1F5F9` | `#F3EAFA` / `#F8F5F9` | **User Panel values** |
| Radius | `radius/xs 2, lg 8, xl 12, 2xl 16` | `radi-4 8, radi-7 16, radi-9 28, radi-10 pill` | union: 2, 4, 8, 12, 16, 28, pill |
| Button variants and states | full set with hover, pressed, disabled and focus halos | not defined | **Design System values** |
| Elevation | five step ladder (flat, card, dropdown, modal, overlay) | not defined | **Design System ladder** |

The rule used: **the User Panel file wins for anything the buyer screens are
actually drawn with**, because those screens are what this task implements; the
**Design System file wins for interaction states** the panel file does not
define. Inter is shipped for the same reason.

> **Product decision still open:** Manrope (design system) versus Inter (panel
> file). Both are wired through one token, `--ids-font-body`, so switching is a
> one-line change.

Layout numbers are measured from the frames: navbar 68px, sidebar 232px, content
gutter 32px. Breakpoints follow the design system grid (390 / 768 / 1440) plus
the 960 switch the panel file uses.

## 2. What was built

`packages/ui` — 24 files, no runtime dependency beyond React.

| Group | Components |
| --- | --- |
| Foundation | `tokens.css` (52 CSS variables, light and a dark opt-in), `tailwind-preset.cjs`, `tokens.ts`, `cn` |
| Type | `Heading` (4 levels), `Text` (4 sizes, 6 tones, 3 weights), `FieldLabel` |
| Action | `Button` (6 variants × 5 heights × loading/disabled), `IconButton` (3 variants, badge), `Spinner` |
| Form | `FormField` (label, hint, error, required), `Input`, `Textarea`, `SearchInput`, `Select`, `Checkbox`, `Radio`, `RadioGroup`, `Switch` |
| Surface | `Card` (4 tones, interactive, selected) with `CardHeader`, `CardBody`, `CardFooter`, `Divider`, `Container`, `PageHeader` |
| Data | `DataTable` (caption, scoped headers, column hiding, empty state), `DefinitionList`, `Pagination` |
| Status | `StatusChip`, `StatusDot`, `Badge`, `Tag`, `statusPresentation` |
| Navigation | `Tabs` (button or link mode) + `TabPanel`, `Breadcrumbs`, `DropdownMenu` |
| Overlay | `Modal`, `Drawer`, `Tooltip`, `Toast` + `ToastProvider` |
| Feedback | `Alert` (5 tones), `EmptyState`, `LoadingState`, `ErrorState`, `Skeleton`, `SkeletonRows`, `NotBuiltYet` |
| Misc | `Avatar` |

`statusPresentation` is the bridge to the domain layer: it maps a domain status
to a label and a tone in one place. It is where the corrected vocabulary lives —
`awaiting_payment` reads **"Awaiting payment"**, never "Accepted", because an
accepted quote is not a confirmed order.

## 3. The shell

`apps/user` is a Next.js 15 app (App Router, React 19, Tailwind 3.4).

```
navbar  68px   logo · token chip (inert) · help (inert) · cart (inert) · notifications · account menu
sidebar 232px  Quick Start · primary nav · upgrade block · For you group
content 32px   max 1440px, page header + breadcrumbs + cards
```

Below 960px the rail becomes a drawer opened from the bar; the drawer traps
focus, closes on Escape and returns focus to the button that opened it.

Three navbar elements are **deliberately inert**, each saying why on hover: the
IDZ token balance (nothing in this platform writes it), the help centre (not this
task) and the cart (its meaning in a manufacturing flow is an open decision).
An inert control that explains itself is honest; a live-looking control that does
nothing is not.

## 4. Navigation

The sidebar keeps the Figma structure and order. Entries that belong to other
IDEEZA modules — Dashboard, My Project, Parts & Agile Module, Explore
Marketplace, Newsfeed, Blog, Freelancers, and the For you group — are rendered
in place but disabled and labelled "n/a" with a tooltip. They are not links.

Nothing from the manufacturer or operations domain appears at all: no inventory,
no quote creation, no production updates, no payout release. A test asserts it.

## 5. Routes

Every route is authorised against the shared table from T03. A route with no rule
is refused, so adding a page without deciding who may see it fails closed.

| Path | Purpose | State |
| --- | --- | --- |
| `/auth/sign-in` | sign-in form | **working** |
| `/design-system` | component gallery, no data, anonymous | **working** |
| `/health` | liveness probe | **working** |
| `/favorites` | kept products, each with its call to action | **working** |
| `/products/[productId]` | single product: details, creator, files, reviews, start manufacturing | **working** |
| `/manufacturing` | hub, and its Draft tab | **working** |
| `/manufacturing/rfq` | the Quote Requests tab | **working** |
| `/manufacturing/orders`, `/manufacturing/history` | the Active Orders and Order History tabs | shell working, panels marked not built |
| `/manufacturing/draft/new`, `/manufacturing/draft/[draftId]` | package and requirements | **working** |
| `/manufacturing/rfq/new` | select manufacturers, with search, filters and fit | **working** |
| `/manufacturing/rfq/new/compare` | the chosen manufacturers side by side | **working** |
| `/manufacturing/rfq/new/request` | the request: services, assembly, recipients, volume, timeline | **working** |
| `/manufacturing/rfq/[rfqId]` | request status and recipients | **working**, quotes panel marked not built |
| `/manufacturing/rfq/[rfqId]/quotes`, `/quotes/[quoteId]`, `/compare`, `/substitutions` | quotes, details, comparison, replacement parts | placeholder |
| `/manufacturing/checkout/[quoteId]` | secured checkout | placeholder |
| `/manufacturing/orders`, `/orders/[orderId]`, `/records`, `/confirm-delivery`, `/refund`, `/cancel`, `/dispute` | order and issue paths | placeholder |
| `/messages`, `/notifications` | conversation and notifications | placeholder |
| `/forbidden`, `/unavailable`, `not-found`, `error` | refusals and failures | **working** |

Placeholders render `NotBuiltYet`, which states the screen is not implemented and
names the task it belongs to. They still pass the real guard.

**Quote Requests** was added to the hub tabs: a request that has been sent and is
collecting quotes is neither a draft nor an order, and the design file has
nowhere to watch it.

The four hub tabs are **four routes**, not a query string on one page. Each tab
is a different list behind a different capability, and a tab has to survive
being bookmarked, shared, or linked to from a notification. The tab row and the
page frame are shared by `HubSection`, so all four render the same header and
the same tab row with its own panel.

## 6. Authentication integration

No new authentication was written. The T03 services are wired up:

- sign-in posts a server action, which calls `AuthenticationService.signIn` and
  stores the token in an **HttpOnly, SameSite=Lax** cookie (Secure in
  production). The token never reaches client JavaScript.
- `middleware.ts` runs on the edge and makes no permission decision: it refuses
  a path with no rule, redirects a visitor with no cookie to sign-in, and
  forwards the resolved path to the server.
- `requireBuyer(path)` in the server layout and in every page resolves the actor
  from the session and calls `assertRouteAccess`. A manufacturer or operations
  account is sent to `/forbidden`.
- sign-out revokes the session server side and clears the cookie.

## 7. Accessibility

Semantic HTML throughout: `nav`, `main`, `header`, `table` with a caption and
scoped headers, real `label`/`input` pairs, `fieldset`/`legend` for radio groups.
Every icon-only control takes a required `label`. One focus treatment
(`:focus-visible`, 2px brand outline) applies system wide. The menu supports
arrows, Home, End and Escape; overlays trap focus and restore it. Errors are
announced through `role="alert"`, toasts through a polite live region. Motion
respects `prefers-reduced-motion`.

## 8. Environment variables

| Variable | Needed by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | app (server) | PostgreSQL connection string |
| `AUTH_SESSION_IDLE_MINUTES` | optional | defaults to 720 |
| `AUTH_SESSION_ABSOLUTE_DAYS` | optional | defaults to 30 |
| `AUTH_SESSION_TOUCH_SECONDS` | optional | defaults to 60 |
| `AUTH_MAX_FAILED_ATTEMPTS` | optional | defaults to 10 |
| `AUTH_LOCK_MINUTES` | optional | defaults to 15 |
| `AUTH_SCRYPT_COST_LOG2` | optional | defaults to 15 |

There is no signing secret: sessions are opaque database rows. No secret is
stored in the repository, and `.env` stays git-ignored.

## 9. Verification

`node tools/verify-user-app.mjs` boots a throwaway PostgreSQL cluster, applies
the migrations, seeds the reference scenario, provisions a password, starts the
built app and then checks it over HTTP and in a real Chromium: anonymous
redirect, wrong password refused, sign-in, the shell, hub tabs, deep protected
routes, a manufacturer account refused, unknown paths refused, console errors,
failed requests, and the layout at 1440, 768 and 390 with screenshots.

## 10. What the design detector measures, and what it is told to leave alone

Both panels are scanned route by route with the `impeccable` detector — 52
routes, at 1440×900 and at 390×844 — against the same design brief the Figma
files were drawn to. What it found split into three kinds, and each kind is
handled differently.

### Fixed in the design system, so no screen has to remember it

| Rule | Where it now lives |
| --- | --- |
| Text contrast at AA | every token in `styles/tokens.css` is measured, not judged by eye; `muted` sits at 4.54:1 on the canvas it is drawn on |
| The measure of prose | `.ids-measure` — 40em, about 80 characters at any type size — applied by `Text`, so all 412 paragraphs keep it |
| A card is the frame | `.ids-card .ids-state` drops the second outline when an empty or failed state lands inside a card |
| Heading continuity | `CardHeader` and `SpecSection` title at level 2, states at level 2; no screen skips a level |
| A control that is shown but inert | `buttonAppearance({ unavailable: true })` — readable text on a grey ground, not white on grey |
| Buttons state their own padding | the Figma height stays exact; the vertical padding says what space that height already leaves |

### Fixed on the screen it belonged to

- The stage rows on the order records screen stacked their name above the count
  on a phone. They had been truncating the stage name — the one thing the row
  exists to say.
- The buyer's rail read "Upgrade Plus" in disabled grey, which is not a disabled
  control.
- The save group on the draft form carried a level-4 screen-reader heading under
  a level-2 section.

### Deliberate, and why

- **Inter everywhere.** The detector flags a single typeface as overuse. The
  Figma brief pins Inter; a brief outranks a warning about variety.
- **The brand purple on headings.** `#7c2db9` is the IDEEZA purple from the
  brief, not a colour picked for effect.
- **Disabled text at 3.1:1.** A disabled control that reads like an enabled one
  is the worse defect.
- **"Card inside card" on controls.** The rule counts any rounded, bordered box
  with a background, so a button or a selectable chip inside a card counts as a
  nested card. Fifteen of the remaining findings are buttons and option chips.
- **The package groups on the draft form.** Four outlined boxes inside one card,
  one radius step down, each holding a different kind of file. They are
  sub-items of one section, and the outline is what separates them.
- **Full-bleed tables and panes.** A table inside a card carries its inset in
  the cells, which is why the card is `padded={false}`. The rule reads the card
  and sees no padding.
- **A truncated message preview.** A preview line is meant to be a preview; the
  order records screen is the case where truncation hid something that mattered,
  and that one is fixed.
- **The author's name on every message in a thread.** The rule reads repeated
  text inside one container as a template wired wrong. In a conversation it is
  who is speaking.
- **The tall left column on a request detail.** Main content left, summary
  right, is the layout the Figma detail screens are drawn to.

Three screens are not covered by this scan: the two checkout steps and the case
screen, which exist only after a buyer has accepted a quote or opened a case,
and the review database does not hold those states. They are built from the same
components as the 52 that were scanned, and both browser harnesses drive them
end to end.

## 11. Where the tokens come from now

Colour and type are no longer written in this repository. They are read from
`@ideeza/tokens` — the design system the design team owns, at
`github.com/mehediuid/IDEEZA-Design-System`, generated from its Figma file — and
pinned in the lockfile to the commit it was installed at, so a build cannot
quietly change what the panels look like.

`styles/tokens.css` is now a mapping and nothing else. Each name a component in
these panels asks for is defined as the system token that answers it:

| this repository | the design system |
| --- | --- |
| `--ids-color-brand` | `--color-bg-brand` |
| `--ids-color-heading` | `--color-text-primary` |
| `--ids-color-body` | `--color-text-secondary` |
| `--ids-color-muted` | `--color-text-tertiary` |
| `--ids-color-surface` / `canvas` / `raised` | `--color-bg-surface` / `-page` / `-surface-raised` |
| `--ids-color-border` / `-strong` | `--color-border-subtle` / `-default` |
| `--ids-radius-*`, `--ids-shadow-*` | `--radius-*`, `--elevation-*` |
| `--ids-font-body` | `--font-family-body` (Manrope) |

The layer exists because the two vocabularies differ, and renaming forty-nine
components would move a great deal of code without moving any meaning. It also
marks exactly what the system does not yet carry: the pink accent the panel
files are drawn with, and the layout measurements taken from those frames. Both
say so where they are defined, and go when the system takes them.

The type ramp is the system's too. `tailwind-preset.cjs` names the system's
variables rather than pixels, so the sizes follow it — including the smaller
values it swaps in below 768px, which the old hard-coded ramp could not do.

### Everything the preset now takes from the system

After the audit of what still slipped past the tokens, the preset carries every
family the system publishes, under the system's own names, and a lint rule
(`ideeza/design-tokens`, `packages/config/eslint/design-tokens.mjs`) refuses
anything that is not one of them in `packages/ui/src` and both apps:

| Family | Preset name | Notes |
| --- | --- | --- |
| type size | `text-3xs` … `text-7xl` | Tailwind's names sit one step above the system's (`text-xs` = system `sm`, 12px). `text-2xs` (11) and `text-3xs` (10) reach the system's two smallest steps, which used to be written as `text-[11px]`. Each size carries the line height the system pairs with that very step. |
| line height | `leading-3xs` … `leading-xl` | the same pairing, on its own |
| weight | `font-normal` … `font-extrabold` | all five |
| tracking | `tracking-tighter` … `tracking-caps` | `tracking-caps` is the uppercase label; the negative steps tighten headings |
| spacing | Tailwind's numbers | every step resolves to the system's variable for that distance (`p-4` → `--spacing-8`, 16px); 28px and 36px have no rung and are the only pixels left |
| radius | `rounded` … `rounded-full` | a bare `rounded` is the system's `sm`, not Tailwind's |
| elevation | `shadow-1` … `shadow-6` | Tailwind's `shadow-md` and friends are refused |
| layer | `z-sticky`, `z-dropdown`, `z-popover`, `z-modal`, `z-toast` … | named for what sits there; numbers are refused |
| opacity | `opacity-disabled/muted/overlay/hover/pressed` | |
| border width | `border`, `border-1.5`, `border-2`, `border-3` | |
| motion | `duration-fast/normal/slow`, `ease-standard/decelerate/…` | |
| icon colour | `text-icon`, `text-icon-secondary`, `text-icon-on-brand` … | an icon is not text; the system colours it a step apart |
| button | `bg-button-primary-bg`, `text-button-tonal-text`, `hover:bg-button-danger-bg-hover` … | `button-appearance.ts` is written entirely in these |
| input | `bg-input-bg`, `border-input-border-error`, `text-input-placeholder` … | `fieldControlClasses` and the field's label, hint and error |

### The Figma file is the component authority

The full published inventory — 177 components across atoms A01–A30, molecules
M01–M135 and organisms O01–O38 — is catalogued with variant counts and
one-line descriptions in `FIGMA-DS-CATALOG.md`, regenerated from the library
via `search_design_system` (the file's page-list API serves a stale five-page
view; the search index and node reads see the live file).

The system's Figma file —
`figma.com/design/V3uizmZLHo5Xhy65Dp3F0O/IDEEZA-—-Design-System` — publishes
the atoms (A01 Button … A30 Delta Chip) with full variant matrices, and every
component here follows its spec, read through the Figma MCP rather than eyed
from a screenshot. Encoded so far: the A01 size ramp (32/36/40/44/48 with
radius lg/lg/xl/xl/2xl, its paddings, gaps and 12→16 type), its 1.5px secondary
border, 3px focus halo and flat fills; A17 Badge Subtle (px 8 · py 4 · gap 4 ·
12/16 regular · full radius · `--color-badge-*` pairs); A18 Tag (raised
surface, default border, caption regular). `@ideeza/tokens` was moved to the
system's HEAD for this, which brought the component token families —
`--color-badge/tag/toast/card/modal/ai-*` and the `--chart-*` ramps — all
exposed in the preset and all carrying dark values.

**Colour is semantic only.** The preset no longer exposes the system's
primitives (`violet-*`, `gray-*`, `blue-*`, `green-*`, `red-*`, `yellow-*`,
`orange-*`), and the lint rule refuses them. A primitive is a swatch: it does
not know whether it is a surface, a word or a border, so it cannot follow the
theme — the status chips built on `bg-green-100` stayed pale green on the dark
surface. Every tone now reads the semantic pair (`bg-bg-success-subtle` with
`text-text-success`, `bg-bg-error-subtle` with `text-text-error`, and so on),
neutral dots read `bg-icon`, thumbnails fade `from-bg-brand-subtle
to-bg-info-subtle`, and opacity modifiers on tokens (`/40`), which Tailwind
drops on a variable, are refused too.

The exceptions are listed in the code, each with an `eslint-disable` that says
why: the solder-mask swatches in `board-spec-form.tsx` are the colour a board
is physically made in, and the placeholder artwork in `model-preview.tsx`,
`draft-list.tsx` and `request-quote-form.tsx` is generated from the product's
own hue. Neither is a colour of the interface.

Measured after the change, on the surfaces each is drawn on: heading 18.8:1,
body 10.4:1, muted 7.6:1, danger 6.5:1, success 7.1:1, brand 7.2:1, white on
brand 7.2:1 — every one above AA. The system's disabled text is 1.5:1, which is
its own decision and is what WCAG exempts inactive controls for. The three
chart hues were re-checked against the colour-blindness separation floor after
the change and pass on every axis.

### What is not adopted yet

The system publishes ten components — Badge, Button, Checkbox, Field,
IconButton, Input, Radio, Select, Textarea, Toggle. These panels are built from
forty-nine, and the other thirty-nine — Card, DataTable, Tabs, Alert, Toast,
Timeline, Stepper, DropdownMenu, Breadcrumbs, PageHeader, StatusChip,
EmptyState, Modal, Pagination and the rest — have no counterpart in it yet.

Adopting the ten it does have needs three things first: the system package is
named `@ideeza/ui`, which is the name this repository's own design-system
package already uses; the system is not published to npm, and its components
need a build step that installing from git does not run; and its components are
written against its own Tailwind preset, which would have to be merged with
this one. The tokens needed none of that, which is why they went first.

### The ten components, adopted

That is now done, and the three obstacles were dealt with rather than removed.
`tools/sync-design-system.mjs` copies the ten components' sources into
`packages/ui/src/ds` at the same commit `@ideeza/tokens` is pinned to, so the
components and the variables they name always come from one version. The name
collision is answered by exporting them as `DsBadge`, `DsButton`, `DsInput` and
so on — this repository's own `Badge` and `Button` are spoken at hundreds of
call sites and could not move. The preset merge turned out not to be needed:
this preset is a superset of the system's for colour, and the system's 29 named
text styles were added beside the existing size names rather than replacing
them, so `text-label-md` and `text-sm` both resolve to the same variables.

Two rewrites the copy applies, both mechanical and both recorded in the script:
relative imports gain the `.js` extension this package's module resolution
wants, and optional property declarations gain `| undefined`, because
`exactOptionalPropertyTypes` is on here and off in the system's build. Nothing
else is touched, and `node tools/sync-design-system.mjs --check` fails the
build if anything under `packages/ui/src/ds` has been hand-edited.

The copied sources are exempt from `ideeza/design-tokens` (see
`eslint.config.mjs`). The rule asks code to express the system instead of
inventing values; that code *is* the system, so the rule has nothing to tell
it. It reaches for a primitive swatch where the Figma spec names one — an
outline badge's border — and for a one-off shadow where the spec is a focus
halo, and those are the design team's decisions.

### Gaps found by measuring, for the design team

Both were found by computing contrast on the rendered pages rather than by
looking, and both are recorded here because the fix uses a different shipped
token rather than a colour invented locally.

**The subtle error badge does not meet AA in dark mode.** The system's A17
Badge binds `bg-{tone}-subtle` with `text-{tone}`. Five tones clear AA in both
themes — brand 7.16/6.65, neutral 9.85/9.45, blue 8.15/6.16, success
5.23/6.81, warning 5.66/6.62 (dark/light). The error tone measures **3.62:1 in
dark** against the 4.5 a 12px label needs; light is fine at 5.91. The system
also ships `--color-badge-error-bg` / `--color-badge-error-text` for the same
role, and that pair measures 6.93 dark and 5.91 light — so the error tone takes
it, through one table in `badge.tsx`. When the compound variant is corrected
upstream the table goes away.

**A count on a solid error fill cannot be read.** White on `--color-bg-error`
measures 2.77:1 in dark and 3.76:1 in light. The notification count on the bell
used that pair, at 10px. It now uses the badge error pair at 12px in an 18px
pill. Worth noting for any future badge the system draws in its Solid style:
`text-on-brand` over `bg-error` fails in both themes.

**One contrast failure is left, and left deliberately.** A disabled pagination
arrow paints `--color-text-disabled`, which measures 1.48:1 in light and 2.47:1
in dark. WCAG 1.4.3 exempts inactive controls, and the token is the system's own
answer for a disabled thing, so nothing here overrides it — but a disabled
control that cannot be seen at all is worth the design team's attention.
