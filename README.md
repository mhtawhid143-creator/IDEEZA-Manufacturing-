# IDEEZA Manufacturing Platform

A manufacturing marketplace: a buyer sends a product to manufacture, selected
manufacturers quote it, the buyer compares and accepts one quote, the platform
secures the payment, and only then does a manufacturing order exist.

IDEEZA facilitates the workflow — discovery, RFQ routing, structured quotes,
secured payment, order tracking, evidence capture, dispute workflow and payout
release. The buyer and the manufacturer remain the commercial counterparties.

## Repository layout

```
apps/
  user/            Buyer panel: products, the draft, the request, quotes and
                   comparison, secured checkout, the order, production,
                   delivery, refund and dispute, reviews, messages
  manufacturer/    Manufacturer panel: dashboard, routed requests, quotes,
                   orders and the production line, inventory, resolution,
                   payouts and withdrawals, shop settings
  ops/             IDEEZA operations panel    (not built — see "What is not
                   built" below)
packages/
  domain/          Business rules: entities, statuses, state machines,
                   invariants, permissions, structured business events
  types/           Zod schemas for the API boundary
  api/             (placeholder)
  db/              Prisma schema, migrations, seed, money mapping
  auth/            Passwords, sessions, actors, route rules, boundaries
  ui/              Design system: tokens, primitives, patterns, states
  config/          Shared tooling, including the vocabulary lint rule
```

## Task status

| Task | Scope | State |
| --- | --- | --- |
| T01 | Project foundation + domain contract + tests | done |
| T02 | Database schema + migrations + seed | done |
| T03 | Authentication, roles, route guards, boundaries | done |
| T04 | Design system + user app shell | done |
| T05 | Favorites, single product, manufacturing call to action | done |
| T06 | Package and manufacturing requirements (the draft) | done |
| T07 | Select manufacturers and send the request | done |
| T08 | Quotes, comparison and acceptance | done |
| T09 | Secured checkout and payment | done |
| T10 | Order detail and production tracking | done |
| T11 | Delivery, review window and history | done |
| T12 | Issues: cancellation, refund, dispute | done from the buyer's side; deciding them is operations' (see below) |
| T13 | Notifications and conversations | done |
| T14–T15 | The 3D route; editing the specification from a draft | see `docs/USER-SIDE-PLAN.md` |
| M01–M14 | Manufacturer panel | built where a table exists; screens without one say so — see `docs/MANUFACTURER-SIDE-PLAN.md`, "Where the manufacturer side stands" |
| Ops | Operations panel | not started |

The buyer path runs from a kept product to a released payout, and the
manufacturer path from a routed request to the money. Both panels read one
database through the shared domain layer.

### What is not built

There is no operations panel, so nothing that the business model gives to
IDEEZA operations can yet be performed by anyone: deciding a cancellation
request, deciding a refund, resolving a dispute, releasing a payout that a
dispute held, or paying a withdrawal. Those cases can be raised and answered by
the two sides and then stop, and the screens say so rather than pretending an
outcome. `docs/GAP-REPORT-BN.md` (Bengali) lists the gaps in detail.

The only release of money that happens without operations is the automatic one
against a documented order event — today, the buyer confirming delivery with
nothing contested — which is what the business model calls for
(`docs/DOMAIN.md` §3 and §4).

- `docs/DOMAIN.md` — the rules the domain layer encodes
- `docs/DATABASE.md` — the schema, its guards and the seed
- `docs/AUTH.md` — passwords, sessions, roles, route rules
- `docs/DESIGN-SYSTEM.md` — tokens, components, the shell and the Figma
  deviations that the business model required
- `docs/USER-JOURNEY.md` — the buyer path that is built, what a draft is and
  what sending a request does

## Commands

```bash
pnpm install
pnpm run typecheck   # tsc --noEmit for every package
pnpm run lint        # eslint, including the retired-vocabulary rule
pnpm run test        # vitest
pnpm run build       # tsc build of the packages, next build for the user app
pnpm run verify      # all four, in order

pnpm run verify:user-app          # boots postgres, migrates, seeds, builds and
                                  # drives the buyer panel in chromium
pnpm run verify:manufacturer-app  # the same, for the manufacturer panel

pnpm run review      # one database, both built panels: buyer on 3100 and
                     # manufacturer on 3200, with sign-in details printed
```

`review` is for looking at the two panels side by side. It boots a throwaway
cluster, seeds the reference scenario and starts both panels against it, so a
quote sent in the manufacturer window shows up in the buyer window on a
refresh. Ctrl+C removes everything it made.

Both panels run with `REVIEW_DIRECT_SIGN_IN=1`, which replaces the password
form with one click per seeded account: opening either panel signs you in, and
`/auth/sign-in?pick=1` (where signing out lands) switches account. That
variable is set by `tools/review-environment.mjs` and nowhere else — the route
it enables answers 404 without it, it can only enter accounts that already
exist in the database, and the session it issues is an ordinary one, so every
guard still applies. Do not set it on anything reachable from outside your
machine.

`verify:user-app` needs `VERIFY_PASSWORD` in the environment; it provisions a
throwaway credential for the seeded accounts and refuses to run without one. It
never writes a secret to a file.

## Branches

- `main` — approved, stable
- `develop` — active development
- `feature/T01-domain-contract` — domain contract
- `feature/T02-database-schema` — database
- `feature/T03-auth-roles` — authentication and guards
- `feature/T04-user-app-shell` — design system and user shell (this task)
