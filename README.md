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
  user/            Buyer panel                (placeholder until a later task)
  manufacturer/    Manufacturer panel         (placeholder until a later task)
  ops/             IDEEZA operations panel    (placeholder until a later task)
packages/
  domain/          Business rules: entities, statuses, state machines,
                   invariants, permissions, structured business events
  types/           Zod schemas for the API boundary
  api/             (placeholder)
  db/              (placeholder)
  ui/              (placeholder)
  config/          Shared tooling, including the vocabulary lint rule
```

## Task status

| Task | Scope | State |
| --- | --- | --- |
| T01 | Project foundation + domain contract + tests | done |
| T02+ | Database, auth, API, UI | not started |

T01 contains no database, authentication, API, UI or payment integration by
design. See `docs/DOMAIN.md` for the rules the domain layer encodes.

## Commands

```bash
pnpm install
pnpm run typecheck   # tsc --noEmit for every package
pnpm run lint        # eslint, including the retired-vocabulary rule
pnpm run test        # vitest
pnpm run build       # tsc build of domain and types
pnpm run verify      # all four, in order
```

## Branches

- `main` — approved, stable
- `develop` — active development
- `feature/T01-domain-contract` — this task
