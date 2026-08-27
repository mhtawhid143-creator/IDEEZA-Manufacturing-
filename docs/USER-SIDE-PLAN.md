# User side: remaining plan (T09 → T14)

The buyer journey up to "request sent, quotes received, one accepted" is built
(T04–T08). This is the plan for the rest of it.

Three sources, in this order of authority:

1. **The approved business model** — encoded in `packages/domain` and recorded
   in `docs/DOMAIN.md`. Behaviour never bends to a screen.
2. **The Figma user panel** — the layout is taken as given: spacing, structure,
   card order, controls. Where the design's *data* does not exist or
   contradicts the model, the layout stays and the data is re-bound to what the
   platform actually holds. Every such decision is listed under
   "Design deviations" in the stage it belongs to.
3. **The existing architecture** — `packages/domain` rules, `packages/db`
   schema, `packages/auth` route rules, `@ideeza/ui` design system, and the
   patterns T04–T08 established (server data layer, server actions returning a
   result, client navigation, `force-dynamic` pages, real guards per route).

Figma sections used, with their node ids:

| Flow | Section | Screens |
| --- | --- | --- |
| Checkout and payment | `42746:158471` "Check out quote" | 22 checkout + 6 quote review |
| Order detail and production | `42746:156134` | 11 |
| 3D / send separately | `42746:146499` | 10 |
| Notifications | `42746:149732` | — |
| Dispute | `42746:146144` "Manage dispute flow" | 2 |
| Refund request | `42746:164492` | 3 |
| Order cancel | `42746:163757` | — |
| Order history | `42746:161296` | — |

---

## T09 — Secured checkout and payment

Figma: Purchase Confirm (`42746:160640`, `42746:160586`), Change address
(`42746:160077`, `42746:160517`), Change shipping method (`42746:160281`),
Payment states (`42746:158680` promo field, `42746:158782` promo invalid,
`42746:158884` promo applied, `42746:158988` saved method, `42746:159054`
another card, `42746:159138` empty state, `42746:159223` card invalid,
`42746:159308` PayPal, `42746:159392` USDT, `42746:159482` IDZ,
`42746:159564` wallet modal, `42746:159735` wallet connected), Payment done
(`42746:159838`), Payment failed (`42746:159957`).

Business rules that govern it: an order opens `awaiting_payment` (invariant 1);
it is confirmed only once the platform holds the funds (invariant 2); production
may not start before that (invariant 3); the accepted terms are immutable
(invariant 8).

| # | Sub-task |
| --- | --- |
| 9.1 | Schema: `PromoCode`, `Payment.discountAmountMinor`, `Payment.promoCodeId`, `ShippingChoice` on the order |
| 9.2 | Domain: `invariants/checkout.ts` — payable order, price recomputation from the snapshot, discount bounds, method support |
| 9.3 | Types: `startCheckoutSchema`, `applyPromoSchema`, `payOrderSchema` |
| 9.4 | Data layer: `data/checkout.ts` — quote-locked scope, cost lines, address change, shipping choice, promo validation, `payOrder` (payment `initiated → secured`, order `awaiting_payment → confirmed`, production stages seeded, events) |
| 9.5 | Step 1 screen: Purchase confirm — stepper, locked production scope, order items, shipping choice, cost summary, coupon, terms |
| 9.6 | Address: change / add a delivery address without leaving checkout |
| 9.7 | Step 2 screen: Payment — method list (card, PayPal, USDT, IDZ, wallet), card fields with validation, saved method, promo applied/invalid, empty-state and invalid-card errors |
| 9.8 | Step 3 screen: Done / Failed — receipt, what happens next, link to the order |
| 9.9 | Tests: db tests for `payOrder` and promo validation, domain tests for the checkout invariants |
| 9.10 | Browser verification: the whole checkout, both outcomes, mobile |

**Design deviations (data, not layout)**

- *"Build Time — 2 days / 24 hours"* on Purchase Confirm: production speed is
  part of the accepted quote and the accepted terms are immutable, so the
  quoted lead time is shown as a locked row. The radio group keeps its place
  and its behaviour, bound to the **shipping choice** the design itself defines
  on its own screen (standard / express), which is what a buyer really picks at
  checkout and which has a cost line in the summary.
- *Coupon*: the platform had no discount concept. Rather than leave a dead
  field, a minimal `PromoCode` is added with real validation, which is what the
  design's three promo states describe.
- *Payment*: no payment provider is connected in this build. The checkout
  records a real `Payment` and moves it `initiated → secured`, which is the
  domain transition that confirms the order; the screen says plainly that
  IDEEZA is recording the funds as held and that a provider is connected in the
  deployment task. Nothing pretends a card was charged.

## T10 — Order detail and production tracking

Figma: `42746:156135` production progress, `42746:156237`, `42746:156398`,
`42746:156679`, `42746:156903` view details, `42746:157153` production
overview, `42746:157297`–`42746:158236` pending order with an inventory alert
raised by the manufacturer.

| # | Sub-task | State |
| --- | --- | --- |
| 10.1 | Schema: `InventoryAlert` + `InventoryAlertStatus`, migration `20260826044820_inventory_alerts` with three check constraints | done |
| 10.2 | Domain: `invariants/inventory-alert.ts` (answerable states, one answer only, which answers exist, what each does to money and dates, production blocked while open) and `orderSchedule` / `TRANSIT_DAYS` in `status/shipping.ts` | done |
| 10.3 | Types: `answerInventoryAlertSchema` | done |
| 10.4 | Data layer: `data/production.ts` — stages with their tasks, derived dates, activity from the domain events, evidence across both contexts, order summary lines, quoted item lines, `answerInventoryAlert` | done |
| 10.5 | Design system: `Timeline` (a sequence you watch, as opposed to `Stepper`, a sequence you walk) and the four shortage statuses in `StatusChip` | done |
| 10.6 | Order shell with three routed tabs, header dates and status | done |
| 10.7 | Production Overview: locked scope, items, shipping, accepted terms, manufacturer card, order summary with adjustments, changes decided during production | done |
| 10.8 | Product Details: quoted lines grouped with a grand total, spec modal per line | done |
| 10.9 | Production Progress: ten stages, tasks inside the live one, who moved each, plus the activity record | done |
| 10.10 | Order records: the evidence a refund or dispute is decided on, and how much of it each stage carries | done |
| 10.11 | Active Orders tab: real rows, state-dependent row menu, a shortage flagged on the row | done |
| 10.12 | Answering a shortage: three real options, each stating its cost and its delay, recorded as an event and as evidence | done |
| 10.13 | Tests: 13 domain, 13 database, 22 browser checks | done |

**Design deviations (data, not layout)**

- *Third tab named both "Production Progress" and "Production Activity"* across
  the design frames: one tab, named **Production Progress**, with the activity
  record underneath it. Two tabs would have shown the same events twice.
- *Numbered markers out of step* on the progress timeline (five ticks followed
  by 7 and 8): the markers are numbered from the canonical stage list, so the
  order always reads 1–10.
- *Eight stages* in the design; the platform has **ten** canonical stages, which
  is the approved model. Every order carries all ten from the moment the funds
  are held, so what is still ahead is visible rather than implied.
- *"Ordered / Est. ship / Est. delivery"* pills: the quote prices the goods and
  gives a lead time; nothing in it covers transit. The dates are derived from
  one fact — when the funds were secured — plus the quoted lead time and the
  courier chosen at checkout (`TRANSIT_DAYS`), and any delay the buyer accepted
  with a replacement part is added to both.
- *Order summary lines* "Parts not supplied (credit)", "Substitute parts",
  "Expedite", "Tax 8.75%": the summary is rendered from the payment that was
  actually taken, so it can never disagree with the record. Express shipping is
  the "Expedite" line. Tax appears only when a tax amount was charged. The two
  parts lines are real: they are what answering a shortage does, and they are
  summed separately as "Still to settle" / "Owed back to you" because the frozen
  snapshot may not be edited.
- *"PCB Items (3 item) / 3D Module (3 item)"* grouping on Product Details:
  nothing in the domain classifies an individual quote line as a board or a
  printed part — the kind of work belongs to the package — so lines are grouped
  under the package's kind. Prices are the manufacturer's own quoted lines.
- *PCB Details / 3D Details spec modals* list about thirty fabrication-house
  fields (Gerber file, stackup, gold fingers, JLCPCB packaging). This platform
  stores the structured production boundary the request was locked against, so
  the modal shows that specification plus the BOM identity of the line. It is
  the same two-column layout with the fields this platform actually holds.
- *"Solve inventory status (this alert comes from the manufacturer)"*: modelled
  as `InventoryAlert` on the order. A shortage found after the terms were frozen
  cannot change them, so the buyer answers it in one of three ways — approve the
  substitute, drop the part for a credit, or wait for stock — and the answer is
  recorded as a decision, a domain event and a piece of evidence. Production on
  that part is stated as paused until then.
- *Row menu* actions follow the order's state, as the design's five variants do.
  "Cancel Order" is offered only while nothing is being made yet, which is the
  approved rule: once production has started only IDEEZA operations may cancel.

## T11 — Delivery, review window and history

Figma: history tab `42746:161296`.

| # | Sub-task | State |
| --- | --- | --- |
| 11.1 | Domain: `invariants/delivery.ts` — confirmable states, review window end / days left / expiry release, review publishable, `averageRating` | done |
| 11.2 | Types: `publishReviewSchema` | done |
| 11.3 | Data layer: `data/delivery.ts` — delivery view, `confirmDelivery` (event → order completed → payment released → payout released against that event id → evidence), `recordDelivery`, `publishReview` with rating recompute, `listHistory` | done |
| 11.4 | Confirm-delivery screen: what confirming does, the alternatives that keep the money held, the review window panel, the delivery record | done |
| 11.5 | Review modal: stars, note, post anonymously, skip — reachable from the order and from history | done |
| 11.6 | Order detail: delivered / completed alerts and the review panel | done |
| 11.7 | Order History tab: real outcome per row, review state, row menu (view, re-order, give feedback, records) | done |
| 11.8 | Re-order: `createDraftFromOrder`, guarded by the same rules as starting manufacturing | done |
| 11.9 | Fixtures: one delivered order with its window running, one completed and reviewed | done |
| 11.10 | Tests: 14 domain, 14 database, 12 browser checks | done |

**Design deviations (data, not layout)**

- *Every history row reads "Delivered"* in the design. A closed order can have
  ended in several ways, and which one it was is the most useful thing about a
  past order, so the row keeps its place and carries the real outcome:
  "Completed, money released", "Delivered, review window open", "Cancelled
  before production", "Refunded in full", "Partially refunded", "Resolved after
  a dispute".
- *A delivered order appears in both tabs*: production is over, so it belongs in
  history, but the buyer still has a decision to make on it, so it stays in
  Active Orders until it closes. The hub counts say the same thing.
- *"Give Feedback"* is the design's name for the Public Review modal, which the
  design shows over the order screen. Both entry points open the same modal, and
  it is offered only where a review is possible: one per delivered order.
- *Review window length* is an **open product decision** in the business model —
  the model names the window and what its expiry does, not how long it lasts.
  It is a platform parameter (`REVIEW_WINDOW_DAYS = 7`), stated on screen as an
  IDEEZA setting rather than as part of the accepted terms.
- *"Re-Order"* in the design's row menu: an order is a frozen agreement with one
  manufacturer at one price, so it cannot be repeated as an order. What can
  honestly be repeated is the request, so re-ordering copies the package, files,
  bill of materials, requirements and destination into a fresh draft — and it
  obeys the same two rules as starting manufacturing: the product must still be
  available, and a buyer may hold only one open request per product.
- *Confirming delivery* is deliberately not a one-click row action. It is the
  buyer action that sends money out of escrow, so the screen states the three
  things it does, requires an explicit statement that the goods match the
  accepted terms, and offers the two alternatives that keep the funds held.

## T12 — Issues: cancellation, refund, dispute

Figma: order cancel `42746:163758`, `42746:164005`; refund `42746:164728`,
`42746:164977`; dispute details `42746:146380` (a sample only — the complete
flow was derived from the domain).

| # | Sub-task | State |
| --- | --- | --- |
| 12.1 | Domain: `invariants/resolution.ts` — `CANCELLATION_REASONS`, `cancellationRoute` (withdraw / request / refused), refund and dispute availability, claim caps, claim needs a statement and a record, statements close with the case | done |
| 12.2 | Domain correction: a buyer may withdraw their own **unfunded** order; only IDEEZA may cancel a funded one, and a manufacturer never may | done |
| 12.3 | Types: `cancelOrderSchema`, `addDisputeStatementSchema` (the refund and dispute schemas already existed) | done |
| 12.4 | Data layer: `data/resolution.ts` — `getIssueContext` (what is available and why not), `cancelOrder`, `requestRefund`, `openDispute`, `getDispute`, `addDisputeStatement`, `listOrderIssues` | done |
| 12.5 | One `IssueForm` behind the design's three modals: reason, amount, description, records | done |
| 12.6 | Cancel screen: says whether this is a withdrawal or a request, and what each does | done |
| 12.7 | Refund screen: manufacturing reasons, amount capped at what was paid, records, and the claim already open | done |
| 12.8 | Dispute screen, and the case screen: the statement thread, the case summary, attachments, and who decides | done |
| 12.9 | Order detail: open cancellation, refund and dispute banners with a way into each | done |
| 12.10 | Tests: 18 domain, 18 database, 12 browser checks | done |

**Design deviations (data, not layout)**

- *The dispute sample is a freelancing dispute* — Upwork wording, "Insufficient
  information", a $50 escrow, "revisions", a video attachment. The layout is
  kept exactly: statement thread on the left, case summary card and attachments
  on the right, describe-and-submit at the bottom. The data is this platform's:
  `OrderIssueReason`, the claimed amount against what was paid, the parties of the
  order, and IDEEZA as the decider.
- *Reason dropdowns had no lists behind them.* Two lists fill them, and they are
  deliberately different: cancelling is commercial
  (`CANCELLATION_REASONS` — design change, lead time, cost, funding), while a
  refund or dispute is about the goods (the approved `ORDER_ISSUE_REASONS`).
  Mixing them would make both useless in a decision.
- *Every instrument shown on every order* in the design's row menu. Which one
  applies is a domain rule, and the screens now say it: an unfunded order is
  withdrawn outright; a funded one in production can only be *requested* to
  cancel; once the units have shipped, cancelling is refused and the buyer is
  pointed at a refund or a dispute; and a refund needs something delivered,
  because the order lifecycle only admits `refund_requested` from `shipped`
  onwards. A problem *during* production is a dispute or a cancellation request.
- *"Amount $50"* in the refund modal: the amount is capped at what was actually
  paid for the order, and the form says whether that money is still held by
  IDEEZA or has already been released — in which case a successful claim is
  recovered from the manufacturer. A claim above the payment is refused.
- *Attachment upload boxes.* There is no file storage service in this build, so
  an upload box would be a dead control. Instead a claim attaches **records the
  order already holds** — the files sent with the request and anything the
  manufacturer attached during production — and the form says plainly that
  photograph upload arrives with the storage service. The domain rule that a
  claim needs at least one record is enforced either way.
- *Modals over the order list* become routes (`/orders/[id]/cancel`, `/refund`,
  `/dispute`, `/dispute/[disputeId]`). Each one moves money, each has to be
  linkable from a notification or a message, and each needs the room to say what
  it does before the buyer commits. The forms inside are the design's.
- *"Pending" status pill* on the dispute: the real `DisputeStatus` values are
  shown (open, responded, under review, escalated, resolved), and a resolved case
  shows its `DisputeOutcome`.

## T13 — Notifications and conversations

Figma: notifications `42746:149732`; message screens `42746:162506`,
`42746:162753`, `42746:163016`, `42746:163263`, `42746:163510`.

| # | Sub-task | State |
| --- | --- | --- |
| 13.1 | Schema: `MessageThreadParticipant.lastReadAt`, migration `20260826082901_message_read_state` | done |
| 13.2 | Types: `sendMessageSchema`, `markNotificationsSchema` | done |
| 13.3 | Data layer: `data/messaging.ts` (threads, unread counts, the conversation, event cards, sending, read state, thread-for-context) and `data/notifications.ts` (list, unread count, mark read) | done |
| 13.4 | Notifications screen: All / Unread as routes, mark one, mark all, deep link into the screen that owns the thing | done |
| 13.5 | The navbar bell counts real unread notifications | done |
| 13.6 | Messages: thread list by what each is about, and the conversation with the platform's own event cards | done |
| 13.7 | The order screen links to its own conversation | done |
| 13.8 | Fixtures: one conversation with a quote card, five notifications | done |
| 13.9 | Tests: 13 database, 8 browser checks | done |

**Design deviations (data, not layout)**

- *"All Private Messages"* and a "+" to start a conversation: a thread on this
  platform is always about a request, a quote, an order or a dispute, and it is
  opened by the platform when that thing happens. There is nothing to start from
  nowhere, so the compose button is not there and every row names its context.
- *In-chat "Accept / Reject / Request Revise"* on the quote card: accepting a
  quote is the act that opens an order, and it carries invariants and a
  confirmation. The card is rendered from the recorded `quote.submitted` event
  and links to the screen that owns the decision, rather than duplicating it in
  a chat bubble.
- *Attachment and emoji controls* in the composer: there is no file storage
  service in this build, so instead of a dead paperclip the composer says where
  files can be attached today (the refund and dispute screens, from the order's
  own records).
- *Notification copy* ("Proposal Rejected", "Offer Accepted") is
  freelancing-marketplace wording. The rows carry this platform's events: a
  quote received, a replacement to review, a shortage waiting on an answer,
  delivered, completed.

## T14 — The 3D route

Figma: `42746:146500` composition, `42746:146672` 3D view details,
`42746:147044`–`42746:149292` description states, `42746:149687` send to
manufacturer.

**The analysis this stage started from.** The platform can send a 3D module to
manufacture on its own; the design shows that as a project screen with a group
of PCB items and a group of 3D items, each with a checkbox, and a Select
Manufacturer button. In this domain that composition *is* the draft: a package
holds files and a bill of materials, and `PackageKind` already distinguishes
`pcb`, `module_3d` and `full_product`. So the work was to make the composition
real — the buyer ticks what goes, and everything downstream follows it.

| # | Sub-task | State |
| --- | --- | --- |
| 14.1 | Domain: `status/print.ts` — processes, the materials each can run, finishes, infill, and `fileKindOf` | done |
| 14.2 | Domain: `invariants/composition.ts` — the package kind is derived from the files, a selection must be makeable, services must fit the package, assembly needs a board, and a 3D package needs a process and a material | done |
| 14.3 | Schema: the print specification on `ManufacturingRequirements`, migration `20260826085713_print_specification` | done |
| 14.4 | Types: the draft schema carries the print specification | done |
| 14.5 | Data layer: the composition is read before a draft is written, the kind is derived, and the print specification is persisted | done |
| 14.6 | Draft screen: grouped composition with per-group and per-file checkboxes, a live read-back of what is being sent, and a print specification card that appears only when a model is included | done |
| 14.7 | Assembly follows the composition: no board means no assembly, stated and enforced | done |
| 14.8 | The request offers only the services the package can carry, and `submitRequest` refuses the rest | done |
| 14.9 | Seed: a print shop (AdditiveWorks Studio) and a mixed product (Gimbal Damper Kit) so a 3D module can be sent on its own | done |
| 14.10 | Tests: 17 domain, updated draft and request database tests, 6 browser checks | done |

**Design deviations (data, not layout)**

- *A package-kind question* used to be asked as a radio group. It is gone: the
  kind is a consequence of the files that are ticked, and the screen reads it
  back ("3D module only", "Full product"). A buyer can no longer save a draft
  that says one thing and carries another.
- *"Assembly" toggles on every item row*: one package is one production run, so
  it carries one assembly answer. Boards that need different treatment are
  different packages, and therefore different requests. Without a board in the
  package the field is fixed to "none" and says why.
- *"Edit Specification" per item*: the structured production boundary belongs to
  the package — that is what a manufacturer quotes against and what a dispute is
  decided on. The specification is therefore edited once for the package, with
  the print fields appearing when a model is included.
- *3D details* (technology, material, colour, finish, volume, surface area,
  build time): the ones a printer quotes on are now columns —
  `printTechnology`, `printMaterial`, `printColor`, `surfaceFinish`,
  `infillPercent` — and the material list is filtered by the process, because
  resin on a filament printer is a mistake rather than a preference. Volume,
  surface area and build time are outputs of a slicer, not buyer input, so they
  are not invented here; they belong to the quote.
- *Grand totals per group* on the composition screen: nothing is priced until a
  manufacturer quotes it, so the draft shows what is included rather than a
  price. Prices appear on the quote and on the order's Product Details tab,
  where they are the manufacturer's own lines.

## T15 — Editing the specification from a draft

Figma: section `42746:149830` "Draft flow to edit specification for service" —
`42746:154989` first screen, `42746:155035` view details, `42746:150510` and
`42746:151237` with assembly active, `42746:149831` with assembly off and a
stencil on, `42746:152720` when a BOM is available, `42746:154346` edit board
specification.

**The judgement this stage started from.** The flow in Figma is one fabrication
house's order form, reproduced closely: its material brands (KB6164, Nan Ya
NP-140F, S1141, S1000H), its internal steps ("Confirm Production file", "Photo
Confirmation"), its own services ("Stencil Storage", "Fixture Storage",
"Nitrogen reflow (for Economic)") and its packaging lines. On IDEEZA one request
goes to several manufacturers who each quote against it. An option only one shop
can honour makes those quotes incomparable and forces the others to decline, so
the form could not be implemented as drawn.

What *is* workable — and what the business model already asks for — is the same
screen carrying a **vendor-neutral, typed specification**: the industry value
rather than the supplier's product name, every row optional, and an explicit
"manufacturer's discretion" as the default. That turns the flow into what the
requirements always were: the frozen production boundary every quote answers and
every dispute is decided on.

| # | Sub-task | State |
| --- | --- | --- |
| 15.1 | Schema: `BoardSpecification` (1:1 with a requirements version) and its fourteen enums, migration `20260826115435_board_specification` | done |
| 15.2 | Domain: `status/board.ts` — the option lists, the values a shop can run (layers, thicknesses, copper, via holes, tolerances) and their labels | done |
| 15.3 | Domain: `invariants/board-spec.ts` — applies only to a package with a board; buildability rules; the specification has to agree with the services asked for | done |
| 15.4 | Types: `saveBoardSpecSchema`, where an open row arrives as absent | done |
| 15.5 | Data layer: `data/board-spec.ts` — read with its editability, write guarded by `assertDraftEditable`, and a read-back that spells out every open row | done |
| 15.6 | Design system: `OptionChips` and `SpecSection` — the label-left, chips-right rows and grey-headed sections of the design | done |
| 15.7 | Screen `/manufacturing/draft/[draftId]/specification`: the board, high-spec options, assembly or stencil, remarks, and the manufacturer's-eye read-back | done |
| 15.8 | The draft screen reaches it and reads back the first rows; a sent request shows it locked; the request screen shows it with the quotes | done |
| 15.9 | `submitRequest` refuses a request whose specification contradicts what it asks to be quoted | done |
| 15.10 | Tests: 14 domain, 8 database, 8 browser checks | done |

**Design deviations (data, not layout)**

- *One shop's brand-name materials* → the base material family (FR-4, flex,
  aluminium, Rogers, PTFE) plus free-text remarks. A brand or a laminate grade is
  a quote detail, and a buyer who needs one says so in the remarks, which bind
  the quote just as tightly.
- *"Confirm Production file" and "Photo Confirmation"* → these are the
  manufacturer's own review steps, and this platform already models them: files
  under review is a production stage, and photographs arrive as evidence on the
  quality-check stage. They are not buyer checkboxes.
- *"Stencil Storage", "Fixture Storage", "Bake Components", "Nitrogen reflow
  (for Economic)", "PCBA remark", "Solder Paste: High temp"* → services and
  process preferences a shop offers and prices. They belong in the quote, not in
  the question every shop is answering.
- *"Dimensions" and "PCB Qty" typed by hand* → the size comes from the board
  files and the quantity is the request's own. Typing them again invites a
  specification that contradicts the files, and the snapshot would then freeze
  the contradiction.
- *Prices beside options* → nothing is priced until a manufacturer quotes it.
  The screen says instead what each constraint costs the buyer in choice: every
  extra one narrows who can build it.
- *"Assembly Side: top / bottom / both" as a separate row from the assembly
  toggle* → the request already carries the assembly mode and whether one or both
  sides are populated. The specification names the single face only when one side
  is being populated, and says why when it cannot.
- *"Parts Selection: by customer / by manufacturer"* → kept, and tied to the
  request: choosing the manufacturer means parts sourcing has to be one of the
  quoted services, which `submitRequest` now enforces.
- *Stencil on the same form as assembly* → a stencil is for populating the board
  yourself. It is offered only when the request asks for no assembly, and asking
  for one adds the stencil service to what is quoted.
- *Every row is optional* — the design implies a full configuration. Most buyers
  know their layer count and finish and nothing else; a made-up constraint in a
  document that decides a dispute is worse than an open row, so the open answer
  is a first-class chip and the read-back names it.

## Working rules for these stages

- Layout from Figma, data from the model. Every deviation is written down in
  the stage it belongs to.
- The design system is the only source of components; new patterns are added
  to `@ideeza/ui` rather than hand-rolled in a screen.
- No dead control: a button either does the thing or is not there.
- Every stage ends with the four gates (typecheck, lint, tests, build) and a
  browser run of the flow it added, including the mobile layout.
