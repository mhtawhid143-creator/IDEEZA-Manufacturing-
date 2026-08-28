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
