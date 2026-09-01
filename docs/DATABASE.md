# Database (T02)

PostgreSQL 15+ with Prisma. The schema lives in
`packages/db/prisma/schema.prisma`; the migrations that produce it are committed
under `packages/db/prisma/migrations`.

## 1. Architecture

```
packages/db
├─ prisma/
│  ├─ schema.prisma                  41 tables, 25 enums
│  ├─ seed.ts                        deterministic development scenario
│  └─ migrations/
│     ├─ 20260517090000_init/        tables, enums, indexes, foreign keys
│     └─ 20260517091000_guards/      check constraints + append-only triggers
├─ src/
│  ├─ client.ts                      client factory; url always from the environment
│  └─ money.ts                       BigInt minor unit <-> domain Money mapping
└─ test/
   ├─ helpers/test-database.ts       throwaway PostgreSQL cluster for tests
   └─ database.test.ts               41 tests
```

Layer responsibilities are kept apart:

| Layer | Owns |
| --- | --- |
| `packages/domain` (T01) | business rules, state transitions, invariants, permissions |
| `packages/db` (T02) | tables, relationships, constraints, indexes, migrations, seed |

The database carries only the subset of rules that can be stated exactly about a
single row. It never re-implements a state machine.

## 2. Main tables

**Party** — `User`, `PostalAddress`, `ManufacturerProfile`,
`ManufacturerCapability`, `ManufacturerMember`

**Product** — `Product`, `FileRef`, `BomLine`, `ManufacturingPackage`,
`ManufacturingRequirements`, plus the link tables `ProductFile`, `PackageFile`,
`PackageBomLine`, `RequirementsFile`

**Request** — `Rfq`, `RfqRecipient`, `RfqItem`

**Quote** — `Quote`, `QuoteItem`, `QuoteRevision`, `Substitution`,
`QuoteAttachment`

**Order** — `ManufacturingOrder`, `AcceptedQuoteSnapshot`, `ProductionStage`,
`ProductionTask`

**Inventory** — `InventoryItem`, `InventorySubstitute`

**Money** — `Payment`, `Payout`, `WithdrawalRequest`

**Communication** — `MessageThread`, `MessageThreadParticipant`, `Message`,
`MessageAttachment`, `Notification`

**Records** — `DomainEvent`, `Evidence`, `Review`, `Refund`, `Dispute`

### Supporting tables added for persistence

These are not new business concepts; they are the relational form of list fields
in the domain model:

`ProductFile`, `PackageFile`, `PackageBomLine`, `RequirementsFile`,
`QuoteAttachment`, `MessageAttachment`, `MessageThreadParticipant`,
`InventorySubstitute`.

Two further persistence decisions are worth naming:

- **Address snapshots.** `PostalAddress` is the buyer address book. `Rfq` and
  `ManufacturingOrder` also carry inline `shipTo*` columns, so that editing an
  address book entry can never rewrite where a past order was sent.
- **Requirements bill of materials.** The domain model carries a bill of
  materials inside the requirements value. Its persisted form is `RfqItem`: the
  lines as sent with the request, which is what every recipient quotes against
  and what a dispute is later read against.

### A table that belongs to nobody's lifecycle

`ProblemReport` holds what the "Report a Problem" dialog collects: a title, the
kind of trouble, how much it is costing the reporter, the description, an
optional second note, the page they were on, and the names and sizes of any
screenshots they attached.

It hangs off `User` and nothing else — deliberately. The dialog opens from any
screen, including one whose data is what went wrong, so tying a report to an
order or a quote would be guessing. `pageName` is the tie, and the dialog fills
it from the route rather than asking, because it is the most useful line in a
report and the one people most often get wrong.

No status, no state machine, no domain event: a report does not move money or
oblige anyone, and nothing in the platform reads these rows yet. They are stored
because a form that thanks you and drops what you wrote is worse than one that
says it cannot take it.

## 3. Important relationships

```
User 1─N Product 1─N ManufacturingPackage 1─N ManufacturingRequirements
User 1─N Rfq ──1 ManufacturingPackage
                 └─1 ManufacturingRequirements
Rfq 1─N RfqRecipient N─1 ManufacturerProfile      (one request, many recipients)
Rfq 1─N RfqItem
Rfq 1─N Quote N─1 ManufacturerProfile
Rfq 1─1 Quote                                     (the accepted one)
Quote 1─N QuoteItem / QuoteRevision / Substitution / QuoteAttachment
Quote 1─1 ManufacturingOrder                      (only when accepted)
ManufacturingOrder 1─1 AcceptedQuoteSnapshot
ManufacturingOrder 1─1 Payment
ManufacturingOrder 1─1 Payout
ManufacturingOrder 1─N ProductionStage 1─N ProductionTask
ManufacturingOrder 1─N Evidence / Refund / Dispute / DomainEvent
Rfq | Quote | Order | Dispute 1─N MessageThread 1─N Message
ManufacturerProfile 1─N InventoryItem N─N InventoryItem  (substitutes)
```

## 4. Constraints

### Unique

| Constraint | Meaning |
| --- | --- |
| `RfqRecipient(rfqId, manufacturerId)` | a request reaches each manufacturer once |
| `Quote.acceptedForRfqId` unique | **one accepted quote per request** |
| `Quote(rfqId, manufacturerId, version)` | one quote version per manufacturer per request |
| `ManufacturingOrder.acceptedQuoteId` unique | an accepted quote backs at most one order |
| `ManufacturingOrder.paymentId` unique | a payment funds at most one order |
| `AcceptedQuoteSnapshot.orderId` primary key | exactly one frozen copy per order |
| `ProductionStage(orderId, key)` and `(orderId, position)` | ten stages, once each |
| `ProductionTask(stageId, position)` | stable task order inside a stage |
| `InventoryItem(manufacturerId, sku)` | part numbers are unique per manufacturer, not globally |
| `Payout.orderId`, `Review.orderId` | one payout and one review per order |
| `BomLine(productId, reference)`, `RfqItem(rfqId, reference)` | one line per reference |

### Check constraints (migration `20260517091000_guards`)

| Constraint | Rule |
| --- | --- |
| `order_needs_payment_once_past_awaiting` | an order may only lack a payment while `awaiting_payment`, `cancel_requested` or `cancelled` |
| `quote_accepted_pointer_matches_rfq` | the accepted pointer must name the quote's own request |
| `quote_accepted_pointer_set_iff_accepted` | pointer present exactly when status is `accepted` |
| `thread_context_present` | a conversation always has its business object |
| `evidence_single_context` / `evidence_context_matches_kind` | evidence belongs to exactly one context, and to the one it claims |
| `stage_position_matches_canonical_key` | the ten canonical stages keep their business order |
| `*_money_sane` | amounts are non-negative, currency matches `^[A-Z]{3}$` |
| `payout_money_sane` | `netAmountMinor = orderAmountMinor - platformFeeMinor` |
| `rfq_quantity_positive`, `quote_quantity_positive`, `quote_lead_time_positive`, `rfq_item_quantity_positive` | quantities and lead times are positive |
| `review_rating_range` | rating between 1 and 5 |

The buyer-side fee arithmetic is deliberately **not** constrained, because who
pays the platform fee is still an open product decision.

### Append-only triggers

`DomainEvent` and `AcceptedQuoteSnapshot` reject `UPDATE` and `DELETE` row by
row (`ideeza_reject_row_mutation`, SQLSTATE `restrict_violation`). These two
tables are the evidence base for payout release and dispute decisions.

Consequence: an order cannot be hard deleted while it has events or a snapshot.
Test databases are reset by dropping the database, not by deleting rows.

## 5. Indexes

Chosen for the query patterns the two panels will actually issue, and no more:

| Table | Indexes |
| --- | --- |
| `Rfq` | `(buyerId, status)`, `(status, createdAt)`, `(createdAt)` |
| `RfqRecipient` | `(manufacturerId, status)`, `(rfqId, status)` |
| `Quote` | `(rfqId, status)`, `(manufacturerId, status)`, `(status, expiresAt)` |
| `ManufacturingOrder` | `(buyerId, status)`, `(manufacturerId, status)`, `(status, createdAt)`, `(createdAt)` |
| `ProductionStage` | `(orderId, status)`, `(status)` |
| `ProductionTask` | `(orderId)`, `(stageId, status)` |
| `Message` | `(threadId, sentAt)`, `(sentAt)` |
| `MessageThread` | `(contextKind)`, `(rfqId)`, `(orderId)`, `(lastMessageAt)` |
| `DomainEvent` | `(subjectKind, subjectId)`, `(orderId, occurredAt)`, `(kind, occurredAt)`, `(occurredAt)`, `(sequence)` |
| `Dispute`, `Refund` | `(orderId, status)`, `(status, createdAt)` |
| `Payment`, `Payout` | `(buyerId, status)` / `(manufacturerId, status)`, `(status, createdAt)` |
| `InventoryItem` | `(manufacturerId, category)`, `(manufacturerId, enabledForMatching)` |
| `Evidence` | `(orderId, kind)`, `(contextKind)`, `(capturedAt)` |

## 6. Money

Every amount is `<name>Minor BigInt` plus a row-level `currency CHAR(3)`. No
`double precision` or `real` column exists anywhere in the schema, and a test
asserts that.

`BigInt` is used rather than `Int` so that a large run in a low-denomination
currency cannot overflow. `packages/db/src/money.ts` converts to and from the
domain `Money` value and refuses anything outside the safe integer range instead
of silently truncating.

One currency column per row means a single record cannot mix currencies, which
matches how a quote, a payment and a payout actually work.

## 7. Status vocabulary

All 25 enums mirror `packages/domain/src/status` exactly, including
`OrderStatus.awaiting_payment` and the ten `ProductionStageKey` values. The
`DomainEventKind` enum carries the same 46 kinds as the domain event list, with
dots replaced by underscores (`quote.accepted` becomes `quote_accepted`) because
PostgreSQL enum labels are identifiers.

Shop-floor detail is `ProductionTask` rows inside a canonical stage. A task can
never become a stage: the stage key/position check constraint pins the ten
stages, and tasks have no key at all.

## 8. Migration strategy

The history begins with two migrations, applied in order:

1. `20260517090000_init` — generated from the schema with
   `prisma migrate diff --from-empty --to-schema-datamodel`.
2. `20260517091000_guards` — hand written SQL for the check constraints and the
   append-only triggers.

Rules for future changes:

- Generate structural SQL with `prisma migrate diff`, never edit an applied
  migration.
- Guard constraints live only in SQL migrations. Because Prisma does not model
  check constraints or triggers, `prisma migrate dev` will report drift against
  them; use `prisma migrate diff` plus a new guard migration instead, and apply
  with `prisma migrate deploy`.
- A test asserts there is no drift between the migration history and the schema
  (`prisma migrate diff --from-migrations ... --exit-code` must return 0), so a
  schema change with no migration fails the suite. Two more tests in the same
  file pin the migration list and count the tables and enums, so a new table
  cannot arrive unnoticed — update them in the same commit that adds it.
- The most recent is `20260901060900_problem_reports`, which adds
  `ProblemReport` with `ProblemKind` and `ProblemFrustration`.

Commands:

```bash
pnpm --filter @ideeza/db run prisma:validate   # schema is valid and formatted
pnpm --filter @ideeza/db run db:deploy         # apply migrations
pnpm --filter @ideeza/db run db:seed           # deterministic seed
pnpm --filter @ideeza/db run migration:sql     # print SQL for the current schema
```

## 9. Seed strategy

`packages/db/prisma/seed.ts` writes the reference walk-through of the business
model:

- 4 users: 1 buyer, 1 operations, 2 manufacturer operators
- 2 manufacturers (A: PrecisionCircuit Co., B: Shenzhen Boards) with capability
  and membership rows
- 1 product with 3 files and a 3 line bill of materials, one full-product
  package, one locked requirements version
- 1 request routed to **both** manufacturers, 3 request items
- 1 quote from each manufacturer; A is accepted, B is rejected
- 1 approved substitution on the accepted quote
- 1 secured payment, 1 order in `in_production`, its frozen snapshot, all ten
  production stages with ten shop-floor tasks, 1 payout still `pending_release`
- 2 context bound threads with messages, 2 evidence records, 9 domain events,
  3 inventory items

Every row has a fixed id and is written with `upsert`, so the seed is
idempotent; the two append-only tables use `createMany({ skipDuplicates: true })`
because the database refuses to update them. A test runs the seed twice and
asserts no counts change.

## 10. Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | connection string used by Prisma and the application |
| `TEST_DATABASE_URL` | optional; only for pointing the suite at an external database |

`packages/db/.env.example` is committed. `.env` is git-ignored and must never be
committed; no credential appears anywhere in the codebase.

## 11. Development setup

```bash
cp packages/db/.env.example packages/db/.env    # then edit the connection string
pnpm --filter @ideeza/db run db:deploy
pnpm --filter @ideeza/db run db:seed
```

The test suite does not need any of this: it boots its own throwaway PostgreSQL
cluster on a free port (`embedded-postgres`, a development dependency), applies
the committed migrations to the empty database, runs the seed, and deletes the
cluster afterwards. That is why the constraint tests exercise real PostgreSQL
behaviour rather than a stub.

```bash
pnpm test                       # unit + database projects
npx vitest run --project database
```
