# Domain contract (T01)

The single source of truth for business behaviour is the approved business model
decision. This document records how that model is encoded in `packages/domain`,
so the rules can be reviewed without reading TypeScript.

## 1. Invariants

| # | Rule | Where it lives | Test |
| --- | --- | --- | --- |
| 1 | An accepted quote does not create a confirmed order; the order opens in `awaiting_payment` | `invariants/order-creation.ts` (`ORDER_STATUS_AFTER_QUOTE_ACCEPTANCE`, `openOrderForAcceptedQuote`) | `order-lifecycle.test.ts` |
| 2 | An order is confirmed only once the platform holds the funds | `invariants/order-creation.ts` (`assertOrderMayBeConfirmed`) + `machines/order.ts` guard | `order-lifecycle.test.ts` |
| 3 | Production may not start before funding is secured | `invariants/production.ts` (`assertProductionMayStart`) + order and stage guards | `order-lifecycle.test.ts`, `production-stages.test.ts` |
| 4 | A request may collect many quotes but only one can be accepted | `invariants/quote-acceptance.ts` + `machines/quote.ts` guard | `quote-acceptance.test.ts` |
| 5 | A manufacturer reaches a request only through its own routing record, and never another manufacturer's quote | `invariants/access.ts` | `access.test.ts` |
| 6 | A manufacturer can never reject or cancel an order; it raises a cancellation request or a dispute | `invariants/order-authority.ts` + `machines/order.ts` guard | `order-lifecycle.test.ts` |
| 7 | Money is released only against a documented order event | `invariants/payout.ts` + `machines/settlement.ts` guard | `payout-release.test.ts` |
| 8 | The order keeps an immutable, checksummed copy of the accepted terms | `invariants/snapshot.ts` | `snapshot.test.ts` |
| 9 | Every critical action is a structured, append-only event | `events/` | `events.test.ts` |
| 10 | A status changes only through a state machine | `machines/state-machine.ts` (`applyTransition`) | every machine test |

## 2. Status vocabulary

Locked by `status/` and asserted in `status-vocabulary.test.ts`.

- **RFQ**: draft, submitted, closed, withdrawn
- **RFQ recipient** (one per selected manufacturer): routed, viewed, quoted,
  declined, expired
- **Quote**: draft, submitted, revision_requested, revised, accepted, rejected,
  expired, withdrawn
- **Substitution**: proposed, approved, rejected
- **Order**: awaiting_payment, confirmed, in_production, quality_check,
  ready_to_ship, shipped, delivered, completed, cancel_requested, cancelled,
  refund_requested, refunded, partially_refunded, disputed, resolved
- **Payment**: initiated, secured, released, refunded, partially_refunded
- **Payout**: pending_release, released, refunded, disputed
- **Refund**: requested, mfr_responded, ops_review, approved, partial, rejected
- **Dispute**: open, responded, under_review, resolved, escalated

### Production stages

Ten canonical stages, in this order: Quote Accepted, Payment Secured, Files
Under Review, Materials / Parts Confirmed, In Production, Quality Check, Ready
to Ship, Shipped, Delivered, Completed.

Shop-floor detail from the manufacturer design files (bare board fabrication,
firmware flashing, enclosure production, final testing, packaging) is modelled as
`ProductionTask` records nested inside a canonical stage. This is how the
manufacturer panel keeps its granular tracking while both panels read one
lifecycle. Default templates live in `production/canonical-stages.ts`.

## 3. Payout release triggers

Release is allowed only against one of these recorded events:

- `order.delivery_confirmed`
- `order.review_window_expired`
- `inspection.evidence_accepted`
- `partial_refund.agreed`
- `dispute.resolved`

## 4. Permissions

`permissions/matrix.ts` is deny-by-default. Deliberate asymmetries:

- buyer-only: create/withdraw a request, accept or reject a quote, decide a
  substitution, pay, confirm delivery, request a refund, publish a review
- manufacturer-only: decline a request, create/revise a quote, suggest a
  substitution, update production, read and write inventory, withdraw balance
- operations-only: decide a cancellation, decide a refund, resolve a dispute,
  release a payout

A buyer holds no `inventory.*` capability at all, and a manufacturer actor must
carry the manufacturer it acts for.

`payout.release` being operations-only refers to a person releasing money by
hand. The platform itself releases a payout automatically when a documented
release trigger from §3 is recorded and nothing on the order is contested — the
buyer confirming delivery does this today, inside the same transaction, with the
event id written on the payout. That is not the buyer holding `payout.release`;
it is the system acting on the rule in §3, and the payout machine's guard is
what checks it. An open refund or dispute holds the payout for operations.

The order machine carries the matching guards: `refunded`, `partially_refunded`
and `resolved` are reachable only with an `ops_admin` actor, as `cancelled` is
for a funded order.

## 5. Retired vocabulary

The design files still use service-marketplace words. These are refused in
`packages/domain/src` and `packages/types/src` by the
`ideeza/legacy-vocabulary` lint rule and by `legacy-vocabulary.test.ts`:

| Retired | Use instead |
| --- | --- |
| Contract | ManufacturingOrder / accepted quote snapshot |
| Proposal | Quote (Substitution for part suggestions) |
| Offer | RFQ (incoming request) or Quote (response) |
| Scope | ManufacturingRequirements |
| Milestone | ProductionStage |
| Transaction | Payment / Payout |

Comments may name a retired word in order to explain why it is retired; code and
user-facing strings may not.

## 6. Refund reasons

The manufacturing reason list replaces the service-marketplace list found in the
design files: failed_quality_check, defective_units, wrong_specification,
wrong_quantity, unapproved_substitution, late_delivery, damaged_in_transit,
not_delivered, missing_documentation.

### Cancellation authority, corrected in the user-side work

The rule "only IDEEZA operations may cancel an order" is kept for every order the
platform holds money against. It is relaxed in exactly one place: a buyer may
withdraw their **own unfunded** order, because nothing has been made and nobody
is out of pocket. A manufacturer still may not cancel anything, funded or not.

A refund request is admitted only from `shipped`, `delivered` or `completed`,
which is what the order lifecycle already allowed. A problem raised while the
units are still being made is therefore a cancellation request or a dispute, not
a refund — the screens say so and point at the right instrument.

## 7. Open product decisions

These are undefined in the business model and are therefore *not* encoded. Each
one is currently represented only as a field or a parameter, never as a default:

- platform fee (who pays, how much) — **not decided by the business, but this
  build has a working figure**: `apps/user/src/data/checkout.ts` charges
  `PLATFORM_FEE_BASIS_POINTS = 300` (3% of the goods) to the buyer on top of the
  quote, and the payout opened at payment records the same fee against the
  manufacturer's net (`Payout.netAmount = orderAmount − platformFee`), as the
  seed and the manufacturer's payouts screen already did. Both sides therefore
  carry the fee in this build. That is a placeholder so the screens have a
  number, not a decision: confirm who bears it and the rate, then make the
  constant configuration and remove one of the two charges.
- review window length — `ManufacturingOrder.reviewWindowEndsAt` exists, no default
- tax and merchant-of-record responsibility — `Payment.taxAmount` exists only
- cancellation policy per stage, and any penalty
- refund response deadline for the manufacturer
- crypto/token payment behaviour inside escrow, refunds and disputes
- quote confidentiality between competing manufacturers is assumed and enforced
  in `access.ts`; confirm it is intended
- design file / intellectual property protection between competing recipients

## 8. Decided: an order of several products ships as one

A project can hold more than one thing to make. Until the schema carries that,
each piece travels as its own request — and every request, quote and order says
so and links to the others (UIUX-207).

**When one order does carry several products, the order is the slowest
component.** Nothing ships until every product in it is finished, and the whole
order travels in one courier shipment. Decided by the business, 2026-10-11.

The rule matters most for what it *removes*. The question that had held this up
was what an order's status is when one component has shipped and another has
not — and because money leaves escrow against that status, it could not be
guessed. Shipping everything together answers it: `order.status` is the
least-advanced component's status, and an order is never `shipped` while a
component is unfinished.

So the money model does not move. One shipment, one delivery, one release
against the triggers in §3. No partial release, no per-component refund or
dispute, no accepting different shops for different components.
`ManufacturingOrder`, `Payment`, `Payout`, `Refund` and `Dispute` are unchanged.

What the schema still owes: an RFQ carrying many packages, `ProductionStage`
and `ProductionTask` carrying a component, a price per component inside one
total, and the four request tabs grouping by product. The order's own stage is
**derived** (`min` across components) rather than stored, so the two can never
disagree — and the rule is worth an invariant of its own, refusing to mark an
order shipped while a component is unfinished, beside the other production
refusals rather than left to be remembered.

### The five rules that follow (decided 2026-10-11)

1. **One quantity for the order.** 500 of each product, not a count per product.
   `Rfq.quantity` stays a single field. A buyer wanting 500 drones and 2,000
   batteries sends the batteries as their own request — which is what the
   platform already does with the pieces of a project, so this stays consistent
   rather than becoming an exception.
2. **A shop takes all of it or none.** No partial quote: a partial quote means
   two shops shipping separately, which "ships as one" rules out.
3. **The buyer sees a price per product and a total.** Both, not only the total.
4. **A shortage on one product holds the shipment, not the other products.**
   A shop checks its stock against the bill of materials before quoting, so the
   common case never reaches production at all; this answers the case the
   `InventoryAlert` flow exists for — a part lost, failing inspection, or a
   supplier falling through after the order is confirmed. The other products
   keep moving, because everything ships together anyway.
5. **A bad product is a partial refund or an agreed rework** — and **this needs
   nothing built**. `Refund.requestedAmountMinor` / `approvedAmountMinor` have
   always made a refund an *amount* rather than the whole order;
   `partial_refund.agreed` is already a release trigger (§3); and
   `DISPUTE_OUTCOMES` already carries `rework` and `replacement_shipment`.

No per-component escrow, no per-component refund record, no new release trigger.
The money model is untouched.
