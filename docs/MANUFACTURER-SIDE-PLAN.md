# The manufacturer side — plan

The buyer side is built (T04–T15). This is the other half: the panel a
manufacturer works in. It is a second Next application, `apps/manufacturer`, on
the same monorepo, the same design system, the same domain package and the same
database — because the two sides are two views of **one** record, and that is the
thing most likely to go wrong.

Figma: `Manufacturer  V3`, file `sllidYJj8I2nf4bUB9eTu1`.

| Section | Node | Frames |
| --- | --- | --- |
| Dashboard | `71:3261` | 1 |
| Request quote (RFQ inbox, details, substitutes, quote form) | `2:12458` | 36 |
| Quote (sent quotes, quote details, linked RFQ) | `2:34970` | 11 |
| Orders / refund / dispute | `217:56631` | 39 |
| Inventory | `2:71119` | 19 |
| Payout and transactions | `3:39548` | 8 |
| Messages | `4:50146` | 4 |
| Blog | `4:52977` | 25 |
| Profile | `217:119418` | 51 |
| Settings | `217:138184` | 78 |

---

## The alignment contract

The buyer asked for one thing above all: **no data mismatch between the two
sides**. These are the rules every manufacturer stage is held to, and each stage
ends with a test that proves it.

1. **One record, two readers.** There is no manufacturer-side copy of a request,
   a quote, an order or a specification. Both apps read the same rows through the
   same `@ideeza/domain` invariants.
2. **The request is what the buyer sent.** The RFQ screens render the buyer's
   `Rfq`, `ManufacturingRequirements`, `BoardSpecification`, package files and
   `RfqItem` bill of materials, with the same labels and the same units. A field
   the buyer left open reads "manufacturer's discretion" here too.
3. **The quote is what the buyer compares.** Every field the manufacturer fills
   is a field the buyer's compare and accept screens already read: unit price,
   total, shipping estimate, tooling, lead time, material and process notes,
   warranty, terms, expiry. Nothing is collected that the buyer cannot see, and
   nothing the buyer reads is invented on the way out.
4. **Money is integer minor units on both sides**, formatted once at the edge.
5. **The manufacturer never decides for the buyer.** It proposes substitutes,
   the buyer decides. It responds to a refund, IDEEZA decides. It requests a
   cancellation, IDEEZA decides. It raises a shortage, the buyer answers it.
6. **The manufacturer never sees another manufacturer's quote**, and only ever
   sees the requests routed to it (`RfqRecipient`). The access invariants in
   `packages/domain/src/invariants/access.ts` are the enforcement.
7. **Production is the manufacturer's to move**, and the buyer's to read: the
   canonical stage is the buyer's view, the tasks inside it are the shop floor's.
8. **Inventory is the manufacturer's own**, and reaches the buyer only as an
   aggregate: which parts of a request a shop can cover, used to rank the
   manufacturer list on the buyer's "Select manufacturers" screen.

---

## M01 — The application, its shell and its guard

Figma: the sidebar and top bar of every frame.

| # | Sub-task | State |
| --- | --- | --- |
| 1.1 | `apps/manufacturer` scaffolded like the buyer app: Next 15 App Router, Tailwind with the shared preset, `src/` layout, port 3200 | done |
| 1.2 | Sign-in, sign-out, session and `requireManufacturer(path)` returning the actor **and** its `manufacturerId` | done |
| 1.3 | The shell: the Figma rail and top bar, with the shop the member is acting for named in the bar | done |
| 1.4 | `/forbidden` and `/unavailable`, so a buyer account or a member with no shop is told plainly | done |
| 1.5 | Route rules and capabilities extended for what this plan adds: `profile.manage`, `blog.publish`, `settings.manage` | done |
| 1.6 | Dashboard headline numbers, every one a real query against this shop's rows | done |
| 1.7 | `tools/verify-manufacturer-app.mjs`: its own harness, because the two surfaces have different route tables | done |
| 1.8 | Tests: 22 route and navigation checks, 8 database checks, 26 browser checks | done |

**Decisions and corrections made here**

- **`@ideeza/auth/edge`.** Middleware runs where `node:crypto` does not exist,
  so importing the whole auth package to read a cookie name broke the build. A
  narrow edge entry point now exports the cookie name and the route-table lookups
  and nothing else, which is also the honest boundary: the middleware may know
  whether a path exists and whether a cookie is present, and nothing more.
- **The buyer app's middleware was never running.** With a `src/` directory Next
  15 looks for `src/middleware.ts`; the buyer app's sat at its root and was
  silently ignored — the same mistake showed up here immediately. It has been
  moved into `src/`, and the buyer app now really has its middleware: the
  `next=` return path after sign-in and the `/unavailable` rewrite work.
- **A member has to belong to a shop.** Without a membership there is nothing to
  scope a query to, so `requireManufacturer` refuses at the door rather than
  letting every screen defend itself. A member of two shops cannot sign in yet —
  the session service demands one — and the chooser is part of the profile stage.
- **The rail tells the truth about what is built.** A destination whose screen
  does not exist yet renders disabled with the reason instead of prefetching a
  404, and the dashboard tiles and the notification bell read the same list. Each
  stage deletes its own reason as it lands, and a test asserts the two agree.
- **The seeded shops are verified.** The reference scenario has them taking real
  orders, and an unverified shop should never have been offered to a buyer.
  Whether verification gates the buyer's manufacturer list is decided in M07.

**Design deviations (data, not layout)**

- *The buyer rail's promo block* ("Unlock all features") has no meaning for a
  shop. The same slot carries the one thing a shop needs prompting about: how
  much of its profile is filled in, because capabilities are what decide whether
  a request ever reaches this inbox.
- *"Earn IDZ Tokens" and the cart* in the buyer top bar are not in the
  manufacturer bar at all: neither has any meaning on this side.

## M02 — Dashboard

Figma: `71:3262`.

| # | Sub-task | State |
| --- | --- | --- |
| 2.1 | Six tiles: open RFQs, quotes submitted, delayed orders, on-time delivery, low stock items, pending payouts — every number from a real query | done |
| 2.2 | Production status: how many orders sit in each canonical stage, and how many need attention | done |
| 2.3 | Orders by kind of work, from the package kind | done |
| 2.4 | Orders in production, with the stage each one is on and how far through the ten it is | done |
| 2.5 | Requests needing an answer, each with a way straight to the quote form | done |
| 2.6 | Inventory health: what is free to promise, and what is low or out | done |
| 2.7 | Recent payouts with what is held and released, and the activity feed from `DomainEvent` | done |

**Decisions and corrections made here**

- **Availability, not shelf count, drives the stock panel.** A part with stock
  reserved against a live order is not free to promise, so the dashboard shows
  available quantity — the same figure the buyer's "n of m parts in stock" is
  computed from.
- **The activity feed translates event kinds rather than renaming them.** The log
  keeps machine names because both panels and the tests read them; the feed maps
  them to a sentence a shop floor recognises, and an unmapped kind still shows
  rather than being hidden.
- **An empty shop sees zeros.** No panel is seeded to look populated. A shop with
  no orders reads a dashboard of zeros with a live "requests needing an answer"
  list, which is the truthful thing and also the useful one.

**Design deviations (data, not layout)**

- *The design's "Orders" donut has a percentage-change caption* ("+12% vs last
  month"). Nothing measures month-over-month change yet, so the panel shows the
  order count and the mix by kind of work, without a trend the platform cannot
  compute.
- *"On-time delivery" in the design is a static 98%.* Ours is computed across
  completed orders and shows an em dash when there is nothing to average — a
  reputation figure with no orders behind it is the one number a shop must never
  be shown.
- *The design's production bars are unlabelled colour blocks.* Each bar carries
  its count and its share, and "needing attention" is the only one in the danger
  colour, because that is the only bar a shop should act on immediately.
- *A "Download report" button* is not offered; there is no export in this build.

## M03 — The RFQ inbox and the request itself

Figma: `2:15777` list, `2:12459` brief, `2:12667` production files,
`2:13048` production specification, `2:15562` BOM.

| # | Sub-task | State |
| --- | --- | --- |
| 3.1 | Data layer: the requests routed to this shop, with their recipient state, deadline and this shop's quote if it has one | done |
| 3.2 | Inbox: four counters, search, status and work-type filters, the table, its row menu and real paging | done |
| 3.3 | Request detail — Brief: the requirement, the general information block and the client panel | done |
| 3.4 | Request detail — Production files: every package file with its kind, revision, size and content hash | done |
| 3.5 | Request detail — Production specification: the frozen requirements **and** the board specification, read by the domain | done |
| 3.6 | Request detail — BOM: every `RfqItem` line, per unit and for the whole batch | done |
| 3.7 | Opening a request records it (`rfq.recipient_viewed`); declining records the reason and the note (`rfq.recipient_declined`) | done |
| 3.8 | Tests: 12 inbox and request checks, 6 two-sided alignment checks, 28 browser checks | done |

**The alignment, and what it cost**

Sub-task 3.8 is the one this whole plan turns on, and holding it honestly meant
changing the buyer side as well as writing the manufacturer side.

- **One reader, in the domain.** `packages/domain/src/read/request-document.ts`
  is now the only place that turns a stored requirement into words:
  `requirementRows`, `boardSpecificationRows`, `serviceLabels`,
  `briefRows`, `RFQ_DECLINE_REASON_LABEL` and `EMPTY_BOARD_SPECIFICATION`.
  Both apps call it and neither keeps label maps of its own.
- **Three real mismatches were found and fixed on the buyer side.** The order
  screen and the checkout were building their own rows, so one frozen
  requirement read *"with approval"* on the order and *"Substitutions with the
  buyer's approval"* on the request; the request screen had a third wording,
  *"Substitutions with my approval"*. All three now read the shared document.
  The decline reason was shown to the buyer as the raw token
  (*"capability mismatch"*) and now reads as the sentence the shop picked.
- **An unfilled board specification is a document, not an empty screen.** The
  buyer's screens render 27 rows of *"Manufacturer's discretion"* when nothing
  has been specified; the manufacturer panel showed nothing at all until it read
  the same `EMPTY_BOARD_SPECIFICATION`. What the buyer believes the shop can see
  is now what the shop sees.
- **A written specification is never hidden.** The kind of work normally follows
  the files — that is the platform's rule for composing a package — but if a
  specification was filled in it binds whatever is quoted against it, so its rows
  show even when the file that should carry it is missing.
- **The test compares the two data layers directly.**
  `apps/manufacturer/test/alignment.db.test.ts` calls both apps against one
  database for one request and asserts row-for-row equality of the requirement
  and the board specification, plus agreement on quantity, volumes, target price,
  bill of materials, destination and the decline reason.

**Decisions and corrections made here**

- **The inbox is the routing table, never the request table.** Every query starts
  at `RfqRecipient`, so a request sent to five shops is five rows in five
  inboxes and no shop can read another's row or another's price. Reading one
  request still hands the row to the domain's `assertManufacturerMayReadRfq`
  rather than trusting the `where` clause.
- **The shop's own words for its own state.** The routing states are named for
  the buyer in the design system (`routed` reads "Sent"). Here they read "New
  RFQ", "Opened", "Quote sent", "Declined", "Expired" — same state, the reader's
  vocabulary.
- **Opening a request is what tells the buyer it is being looked at.** The mark
  happens on the Brief tab and nowhere else, once, with one event; a second visit
  does not move the timestamp. "Opened" has to mean a person opened it.
- **Declining needs a reason, and "other" needs a note.** The buyer reads it, and
  "no" with nothing attached tells them nothing about whether to change the ask
  or the shop. A shop that has already quoted cannot decline — the recipient
  state machine refuses it, and the message says to withdraw the quote instead.
- **A request that was never routed here shows the not-found page.** The status
  stays 200 rather than 404: the shell streams behind its loading state before
  the page can decide, and Next cannot change a status mid-stream. The behaviour
  that matters — nothing of the request is shown — is what the harness asserts.
- **Route rules for the tabs.** `/rfqs/*/files`, `/rfqs/*/specification` and
  `/rfqs/*/bom` needed their own rules: `*` matches one segment, so without
  them the middleware rewrote the tabs to `/unavailable`. The existing "every
  route has a rule" test is what will catch the next one.
- **Fixtures of its own.** The shared verification fixtures leave every routed
  request answered, which is what the buyer side needed.
  `tools/verify-fixtures-manufacturer.ts` adds the state an inbox is about: two
  unanswered requests, one board with assembly and one printed housing, with
  files, a frozen specification and a bill of materials that deliberately holds a
  part this shop does not stock — the shortage M04 has to find.

**Design deviations (data, not layout)**

- *The four counters.* The design counts "Total Requested quotes / New Quotes /
  Submitted quotes / Rejected Quote". A shop's inbox has five states, not four,
  and an expired request is not a rejected one. They read: requests received,
  waiting on you, quotes sent, and closed without a quote — the last naming the
  declined and expired split underneath.
- *"Manufacturer type"* filters the kind of work in the request, not a type of
  manufacturer. It is labelled work type.
- *The right-rail price.* The design shows "$1000 Price" with no owner. It is the
  buyer's target price, and a shop reading its own number there would be reading
  a promise nobody made — so it is labelled the buyer's target, with the
  requested window under it, and it says plainly that it is not an agreed price.
- *"About the client".* The design gives the buyer a job title, a skill list and
  a project count. A buyer account has none of those, and "skills" belong to a
  shop. What a shop needs before pricing is whether this buyer follows through,
  so the panel carries their record: requests sent, orders completed, orders with
  this shop, the kinds of work they ask for, member since, and where this one
  ships to.
- *The files tab.* The design groups files under three sub-assemblies and puts a
  download button and a layout viewer on every row. One request carries one
  package in this domain, so there is one group. The platform records a file's
  name, revision, size and content hash, not its bytes — so the row carries the
  hash, which is what a shop verifies a file against, and the screen says the
  contents are not served here rather than offering a button that downloads
  nothing.
- *The specification tab.* The design's own data is scrambled — "PCB Qty: HASL",
  "Different Design: ENIG", "PCB Thickness: 8:1" — and one row advertises another
  fabricator's logo. Every row here is the buyer's actual answer, read by the
  domain, and the packaging row says what was chosen rather than naming a
  competitor.
- *The BOM tab.* The design has a footprint column and a part-manufacturer
  column. A line holds a reference, a component name, a manufacturer part number,
  a SKU and a quantity, so the part number takes the place of both rather than a
  column of guesses. A "total for the batch" column is added, because that is the
  number a shop actually sources against.
- *The brief.* The design carries one requirement card per kind of work, each
  with its own prose. One request holds one written brief, so there is one card
  and the kinds of work it covers are chips on it. "Total Product" is always one
  here — one request, one package — so the row is dropped in favour of the
  volumes, deadlines and destination a quote needs.
- *Submitting a quote* is disabled with its reason until the quoting stage lands.
  The decline path is complete.

## M04 — Inventory against the bill of materials, and substitutes

Figma: `2:13199` part missing in inventory, `2:13427`–`2:15252` manage
substitute.

| # | Sub-task | State |
| --- | --- | --- |
| 4.1 | Match each BOM line against this shop's `InventoryItem` rows by SKU: covered, short, or not stocked, with the shortfall | done |
| 4.2 | The shortage on the BOM tab: a stock column per line and one card naming what has to be answered before quoting | done |
| 4.3 | Suggest a substitute from stock (`Substitution`: requested reference, suggested part, justification, price and lead-time impact) | done |
| 4.4 | The buyer's decision reads back here; an undecided suggestion blocks acceptance, which the buyer side already enforces | done |
| 4.5 | Tests: 12 domain checks, 13 database checks including what the buyer can and cannot see, 9 browser checks | done |

**Decisions and corrections made here**

- **Availability, not stock.** A line is judged against stock minus what is
  already reserved for other orders, because a part promised twice is a part that
  will be late once. Stock the shop has switched off for matching is not counted
  at all — an item it does not want quoted from should not make a line look
  covered.
- **Short and not stocked are different answers.** A short line can be topped up
  from a distributor; a line whose part is not in the inventory at all usually
  cannot without changing the part. The screen says which it is, and the tooltip
  says the numbers behind it.
- **A substitution belongs to a quote, so the quote starts as a draft.** The
  schema attaches `Substitution` to a `Quote`, which is right — a substitute is
  part of what is being offered, not a fact about the request. So suggesting one
  opens this shop's **draft** quote, which is its private workspace: the buyer's
  data layer reads only non-draft quotes, and a database test asserts the buyer
  sees nothing until the quote is sent. The inbox and the request rail were
  corrected in the same pass, because a draft is not "my quote" and must not read
  as one.
- **The impact is derived, not typed.** Price impact is the cost difference
  across the whole batch, and lead-time impact the extra days, both computed from
  the shop's own inventory costs — so the two numbers the buyer reads are the
  difference the stock actually implies. Where the specified part is not in this
  inventory there is no cost on record to compare against, and the impact is
  stated as none rather than guessed; the quote price is what carries it then.
- **What is offered as a substitute is only what could be one.** Only parts the
  shop holds enough of, and of those: what the shop itself declared a substitute
  first, then the same category as the specified part, and when the part is not
  in inventory at all — so there is no category to go on — a part whose name
  shares real words with it. The shop still chooses; this only decides what is
  worth offering.
- **A reason is required.** The buyer's engineer judges the part on it, so a
  substitute without a justification is refused in the domain, not in the form.
- **"No substitutions" is an answer already given.** A request whose policy is
  `not_allowed` refuses any suggestion, and the screen says what the shop can
  do instead: source the part as specified, or decline saying the parts cannot be
  sourced.
- **Nothing is half-saved.** Every line is validated before anything is written:
  a set of suggestions that answered some shortages and silently dropped others
  would be worse than saving none.
- **Vocabulary.** The platform's word is *suggestion* — the capability is
  `substitution.suggest` and the event `substitution.suggested`. "Proposal" is
  a retired term (it used to mean what a quote now means) and the domain lint rule
  refuses it, so the code and the copy both say suggestion.
- **A design-system bug this stage found.** A modal taller than the viewport had
  no way to scroll and its footer was unreachable — the shortage modal is the
  first screen long enough to hit it. `Modal` now caps its height and scrolls
  its own body, with the header and footer fixed. This affects every modal on both
  panels, and both harnesses were re-run.
- **A test-teardown bug fixed while it was in the way.** The embedded PostgreSQL
  cluster deletes its own data directory on stop, and on Windows the process
  releases its handles a moment later, so a passing suite reported `EBUSY`. The
  teardown now waits for the directory to be released and never fails a suite over
  housekeeping in the temp folder.

**Design deviations (data, not layout)**

- *The alert's wording.* The design says "2 Component require substitute
  proposals, create must approved before production can start". The count is
  real, and the sentence says what actually holds: the buyer has to approve each
  one before production can start.
- *The substitute picker's hover card* in the design carries a datasheet, an
  EasyEDA footprint link, an ECCN and a competitor's part number. None of that
  exists in this platform — there is no parts-catalogue integration — so the row
  carries what the shop's own inventory knows: how many are available, the unit
  cost, the lead time, and whether the shop itself declared it a substitute.
- *"Add Note" opens inline*, under the row, rather than as a second modal on top
  of the first. Same control, same place; a modal over a modal is a trap for
  keyboard users.
- *The primary action.* The design's "Proceed to Proposal" saves the
  suggestions; it reads "Save substitutes" because that is what it does, and
  "proposal" is retired vocabulary. The design's "Proceed to Quote" belongs to the
  quoting stage and arrives with it.
- *The stock column* is added to the BOM table: the design shows only a red
  icon at the row's end. The icon says something is wrong; the column says what,
  and the suggested part and its impact sit under it.

## M05 — Quoting

Figma: `2:16422` request for quote, `2:34971` quote details, `2:35177` linked
RFQ, `2:35401` revise.

| # | Sub-task | State |
| --- | --- | --- |
| 5.1 | The quote form: per-unit price, shipping estimate, tooling and setup, lead time, materials and process, warranty, terms, validity — the exact set the buyer reads | done |
| 5.2 | Prices at the other volumes the request asked about, stored and read on both sides | done |
| 5.3 | Sending moves the recipient to `quoted` and writes `quote.submitted`; the buyer reads it at once | done |
| 5.4 | Revising keeps the terms that were on the table as a `QuoteRevision`, and withdrawing leaves the record | done |
| 5.5 | Quotes list with counters, filters and paging; quote details with the request, the substitutes and the activity beside it | done |
| 5.6 | Expiry is real: an expired quote cannot be revised or accepted, and both panels compute it the same way | done |
| 5.7 | Tests: 21 domain checks, 13 database checks comparing field for field with what the buyer reads, 16 browser checks | done |

**Decisions and corrections made here**

- **The quantity is the request's, not the form's.** A quote answers the volume
  that was asked for, so the field is read-only and the stored quantity is read
  from the request — the two can never disagree, and the totals cannot be quoted
  against a different batch than the buyer asked about.
- **Every total is computed, never typed.** `quoteGoodsTotalMinor` and
  `quoteLandedTotalMinor` live in the domain and both panels call them. The
  buyer's `landedTotalMinor` helper now delegates to the same function, so a
  rounding or a forgotten line cannot make the comparison say two things.
- **A live quote may be revised.** The quote state machine only allowed
  `revised` after the buyer had asked for a revision, which would force a shop
  wanting to improve its price to withdraw and start again — losing the history of
  what was offered when. `submitted → revised` and a further `revised → revised`
  are now allowed; a decided quote still cannot be revised.
- **A new table, because the question had nowhere to go.** A request may ask for
  alternative volumes, and there was no way to answer them except prose.
  `QuoteVolumePrice` holds one priced volume per row, with a database check that
  the total is the unit price times the quantity, and the domain refuses a volume
  the request never asked about or two prices for one volume. The buyer's quote
  screen reads them beside the main price.
- **A draft is not a quote.** The draft a shop prepares — where its substitute
  suggestions live — is excluded from the quotes list, from the inbox's "quoted"
  state and from the request rail's "you quoted" panel. Submitting turns that
  draft into the quote, so the suggestions travel with it rather than being
  orphaned, and a database test asserts the buyer sees nothing of it until then.
- **Expiry is a fact about the clock.** `quoteHasExpired` is in the domain
  because nothing writes to a row when its date passes: an expired quote reads as
  expired on both sides, cannot be revised, and the buyer's screens already refuse
  to accept it.
- **A shortage does not block the quote.** Sourcing a part yourself is a
  legitimate answer, so the form states how many lines are uncovered and what
  sending means, rather than refusing to send. What it will not do is hide it.
- **A substitution event is found by its own id.** M04 wrote
  `substitution.suggested` against the bill-of-materials line id while the
  buyer's activity feed looked for it by quote id, so neither found the other. The
  subject is now the substitution itself, and the buyer's query was corrected to
  match.
- **The routing record is history, not a description of now.** Withdrawing a
  quote leaves `RfqRecipient.status` at `quoted`, because this shop did quote.
  What is on the table is the quote's own status, and that is what every screen
  reads.

**Design deviations (data, not layout)**

- *The submit form gains four fields the design does not draw:* shipping
  estimate, tooling and setup, payment and delivery terms, and warranty. The
  buyer's quote screen shows all four, and the order is opened against the terms —
  a form that could not collect them would produce a quote the buyer reads as
  blank.
- *The design's own arithmetic is wrong* — "$12 × 20 Units = $220" — and its
  "Budget / Total Part / Missing Part / Substitute Part" tiles are placeholders.
  The overview reads: the buyer's target, the units asked for, the bill-of-material
  lines, and how many are not covered by stock with how many of those are
  answered.
- *"Quote Expire" is a date the shop chooses*, and the domain caps it at 180
  days, because a price held open for a year is not a price.
- *The quote list's "Date range"* filters on when the quote was sent, with a
  from and an until: a single "date range" control is not a thing the platform can
  answer without saying which date it means.
- *The list gains a total column* beside the unit price, because a shop compares
  its own quotes on what the buyer would pay, and drops the design's thumbnail
  vendor names it has no source for.
- *"Pending" becomes "With the buyer"*, and "Rejected" becomes "Not chosen": the
  buyer declining one quote of five is not a rejection of the shop, and the
  vocabulary should not imply it.

## M06 — Inventory management

Figma: `2:71120`–`2:75305`.

| # | Sub-task | State |
| --- | --- | --- |
| 6.1 | The parts table: availability, reserved, threshold, unit cost, lead time, category, location, matching on or off | done |
| 6.2 | Add a part, with its opening stock recorded as a count | done |
| 6.3 | Update stock (in, out, count) and update price, each as a movement | done |
| 6.4 | Switch a part off for matching, and delete one nothing depends on | done |
| 6.5 | Part detail with its whole movement history | done |
| 6.6 | Every write is a recorded movement, so stock is never a number someone typed over | done |
| 6.7 | Tests: 14 domain checks, 17 database checks, 10 browser checks | done |

**Decisions and corrections made here**

- **A new table, because a number without a reason is not a number.**
  `InventoryMovement` records every change: what kind, how much, what the stock
  and the reservation became, and who did it. A database trigger refuses updates
  to it, exactly as it does for the domain event log. The item's own columns are
  the current position; this is how it got there.
- **Stock movements are not domain events.** The domain event log is for things
  that change what the two sides owe each other, and a shop counting its own
  shelf is not one of them — putting it there would fill the buyer's activity feed
  with a shop's housekeeping. So it has its own table, and the buyer never reads
  it.
- **A count states a total; everything else states an amount.** That is the one
  place a shop can correct reality, and it is refused if it would leave less on
  the shelf than an order has reserved: the answer then is to release the order,
  not to make the shortage invisible.
- **Reservations are the platform's, not the shop's.** `reserveForOrder` and
  `releaseForOrder` are here for the orders stage to call at funding and at
  completion, with movements written for each. What is reserved stops being
  available to quote from at once, which is what the buyer's manufacturer list
  reads.
- **Editing a part cannot change its numbers.** The edit form carries what the
  part *is*; stock and price move only through their own movements. A SKU cannot
  change at all — quotes and reservations point at it.
- **Deleting is allowed only for a part nothing points at.** Reserved, suggested
  to a buyer, or with movements beyond its opening count: switch it off for
  matching instead. The append-only trigger on movements was narrowed to updates
  for exactly this reason — a part added by mistake must be removable, and its
  opening count goes with it — while nothing can ever be *edited*.
- **Lead time and unit cost are required.** The design's form asks for neither.
  Both are what a substitute's price and delay are computed from, so a part
  without them could not be quoted from at all.

**Design deviations (data, not layout)**

- *"Unit Type"* is not asked for. Every quantity on this platform is a count of
  parts, because a bill of materials is matched line by line against counts; a
  unit type that did not change the arithmetic would be decoration, and one that
  did would let a shop record square metres against a line asking for pieces.
  The form says so.
- *The attachment control* is not drawn. This build records a file's name,
  revision and hash rather than its bytes, so a picture of a part would be a
  promise it could not keep. Said on the form rather than shown as a dead
  control.
- *The three counters* become four: parts held, low stock, out of stock, and
  parts reserved — because reserved stock is the figure that explains why a full
  shelf can still be unavailable.
- *"Availability" and "Reserved"* are both shown, and availability is stock minus
  reserved. The design shows a plain stock number, which would read as promisable
  when it is not.
- *A stock-level filter* is added beside the design's category and matching
  filters: it is the one a shop actually reorders by.
- *The sidebar in the design's inventory frames* says "Transactions" where the
  rest of the file says "Payouts & Earnings". The rail follows the rest of the
  file.

## M07 — What the buyer sees of inventory

Figma: the buyer's "Select manufacturers" screen, which already exists.

| # | Sub-task | State |
| --- | --- | --- |
| 7.1 | For one request, how many of its bill-of-materials lines each shop can cover from available stock | done |
| 7.2 | The buyer's fit assessment carries it, the card says "n of m parts in stock", and the list is ordered by it | done |
| 7.3 | Nothing else crosses: a share and a count of the buyer's own lines, no quantities, no costs, no other parts | done |
| 7.4 | Tests: 3 domain checks, 3 two-sided database checks, 2 browser checks on the buyer's screen | done |

**Decisions and corrections made here**

- **Stock ranks, it never refuses.** Sourcing a part it does not stock is
  ordinary work for a manufacturer, so a shop with none of the parts is still
  offered and still able to quote. What changes is the order: `meets` before
  `partial` before `cannot`, then more of the bill of materials in stock, then
  the shop's record. The comparison is one function in the domain
  (`compareManufacturerFit`) so the card and the ordering cannot disagree.
- **Only the buyer's own lines cross.** The buyer's side sends the SKUs its own
  request names and gets back two integers — lines covered, lines asked about.
  A test asserts the option carries no SKU, no cost and no stock quantity, so one
  shop's inventory can never be read through another buyer's screen.
- **Availability, not stock, and only parts left on for matching.** The same
  rules the shop's own screens use, because it would be worse than useless for a
  buyer to be told a shop has the parts when they are promised to somebody else.
- **The draft now carries its bill of materials.** It had only the ids of the
  lines it included, which was enough to send a request and not enough to match
  anything.

## M08 — Orders and production

Figma: `75:21524` list, `75:21680`–`75:22787` the row menus per state,
`75:21048`–`75:21389` order details.

| # | Sub-task | State |
| --- | --- | --- |
| 8.1 | Orders list with the buyer's own states, a stage bar against the canonical ten, and filters including what is late | done |
| 8.2 | Order detail across four tabs: production, the frozen terms, the files, the specification | done |
| 8.3 | Move production: a canonical stage, and the tasks inside it — refused before funding, out of order, or past a shortage | done |
| 8.4 | Attach a record to a stage: quality report, measurements, photograph, or a statement | done |
| 8.5 | Record the shipment and the delivery, which opens the buyer's review window | done |
| 8.6 | Raise a shortage on a live order, which is the alert the buyer answers | done |
| 8.7 | Request a cancellation, which only IDEEZA may grant | done |
| 8.8 | Tests: 16 database checks, including the buyer reading the same stage at the same timestamp | done |

**Decisions and corrections made here**

- **Stages and tasks are different things, and the design conflates them.** Its
  timeline puts "Code Flashing" and "3D Module Production" beside "Order
  Received"; the first two are shop-floor work and the last is a platform state.
  The screen keeps the canonical ten — the ones the buyer reads and the platform's
  rules are written against — and shows the design's extra items as the tasks they
  are, underneath the stage they belong to. Neither panel can invent a step the
  other cannot see.
- **What may move is the domain's answer, shown as such.** A stage the platform
  or the buyer owns is not offered at all; a stage whose predecessor is unfinished
  says which one it is waiting for; an unfunded order refuses everything. The
  reason is written in words rather than passed through from an invariant's code,
  because a shop reads it.
- **An unanswered shortage stops the line.** Not a warning — a refusal, in the
  data layer as well as on the screen. Building past a shortage is how an order
  ends up made of parts nobody agreed to.
- **Completing a stage completes the tasks under it.** A stage that is done with
  tasks left open would be a claim the shop floor did not make. Ticking the first
  task starts the stage, so the buyer's screen moves when work actually starts.
- **Shipping and delivery are records, not columns.** There is no shipment table
  and no courier integration, so the courier and the tracking reference are
  written as a `shipping_record` on the shipped stage — an evidence kind that
  already existed for exactly this — and the buyer reads it on their own records
  screen. The title carries the courier and the reference so it is legible on both
  sides without a schema the platform cannot honour.
- **Delivery is said by the shop and confirmed by the buyer.** Recording it opens
  the review window and nothing else; the payout is released against a documented
  event, and the screen says so where a shop might expect otherwise.
- **A shop cannot cancel a funded order.** It raises a request, operations
  decides, and the buyer is told. The wording says why: the buyer's money is held
  against the order, and letting the side holding the work decide would leave the
  buyer with neither the goods nor the funds.
- **A shortage is raised with everything the buyer needs to decide.** The three
  answers are theirs — approve the substitute, drop the part for a credit, wait
  for stock — so the form collects the substitute, the justification, the price
  impact, the credit and the delay, and says plainly that the frozen terms are
  never edited.

**Design deviations (data, not layout)**

- *The design's orders screen is titled "Quotes"* and carries the quotes
  screen's counters ("New Quotes", "Accepted quotes", "Rejected Quote"). It reads
  "My orders", and the counters are the ones a shop plans a week around: orders,
  in flight, past the quoted date, and needing attention.
- *"Order ID" and "User Name"* become the product and the buyer. An order
  identifier alone tells a shop nothing about what it is building; the identifier
  is still there, under the name.
- *The design's progress bar has no scale.* Ours is the canonical ten stages with
  the count beside it, and it turns red when the order is past the lead time the
  shop itself quoted.
- *A "Cancel order" action* is not offered anywhere. The shop may request a
  cancellation; only operations may grant one.
- *The stage menu* keeps the design's "In progress" and "Complete" and adds
  "Attach a record", because a stage that produced a quality report and cannot
  carry it is a stage whose evidence goes missing.
- *No upload control on a record.* The build holds a file's name and hash, not
  its bytes, so a record is its kind, its title and what it says — stated on the
  form.

## M09 — Refunds and disputes, from this side

Figma: `2:57958` the claim as the shop sees it, `2:58576`–`2:60609` answering it,
`2:65163` the claim on the order, `2:65352`–`2:65749` sending a dispute,
`2:70024` and `2:70338` the case itself.

| # | Sub-task | State |
| --- | --- | --- |
| 9.1 | A refund claim the buyer raised: read it, its record, and the deadline silence carries | done |
| 9.2 | Answer it — accept in full, accept an amount of the shop's own, or challenge it | done |
| 9.3 | Challenging opens the case, with the amount the shop would accept and its account | done |
| 9.4 | The case: the statement thread, the summary, the records, and who decides | done |
| 9.5 | Add a statement to a live case, carrying records already on the order | done |
| 9.6 | The outcome IDEEZA records, and what it does to the payout | done |
| 9.7 | Both panels read one claim and one case through `read/resolution-document.ts` | done |
| 9.8 | Tests: 8 browser checks on the shop side, 2 alignment checks on the buyer side | done |

**Decisions and corrections made here**

- **A refund claim is answered, not decided.** The shop may accept it, offer an
  amount, or challenge it; the resolution is IDEEZA's. None of the three moves
  money, and each screen says so where a shop might assume otherwise.
- **The design's "Give refund — Full amount / Custom" is an offer, not a
  payment.** Accepting in full ends the shop's objection. Offering an amount is
  recorded against the claim (`Refund.approvedAmountMinor`) and weighed by
  operations — because a shop that could settle its own claim would make the
  escrow pointless. The bound comes from the domain: above zero, never more than
  was claimed.
- **One claim, one case, one set of words.** Both panels used to keep their own
  label maps: the buyer read "Failed our quality check" where the shop read
  `failed_quality_check`, and the case the buyer called `dp_mtc9f2x1` the shop
  called `9F2X1ABC`. Reason, outcome, status, the case reference and the claim
  reference now come from `packages/domain/src/read/resolution-document.ts`, so
  the two sides can quote the same case to each other.
- **The buyer can see the shop's answer.** The claim screen and the order screen
  now show what the manufacturer accepted, in money, as soon as it answers. The
  figure was in the database and shown nowhere, which meant a buyer watching a
  claim could not tell an answered claim from an ignored one.
- **A shop statement may carry records.** The buyer side could attach the order's
  files to a statement from the day the case screens were built; the shop side
  could not. That asymmetry made one account look thinner than the other to
  whoever decides the case.
- **The dialog's heading does not move.** Choosing between accepting and offering
  used to rewrite the modal's title under the reader; the title is fixed and the
  button says which of the two it sends.

**Design deviations (data, not layout)**

- *The design gives the shop a "Resolve dispute" action.* It is not offered. The
  shop accepts, offers, challenges or adds a statement; only IDEEZA resolves.
- *"Create dispute" as a separate first move on a claim* is folded into the
  challenge — the design would produce two cases about one claim, which is how
  two threads end up with two different outcomes.
- *The response deadline in the design is a fixed date* ("by midnight Apr 24
  2026"). How long a shop has to answer a claim is an **open business decision**
  (`docs/DOMAIN.md` §7), so the screen shows the date the platform holds against
  the claim and says plainly what silence means, without inventing a policy.
- *"I accept Terms and Conditions"* on the refund form: there is no terms
  document to accept in this build, so the form states the consequence — the
  payout is reduced by whatever operations releases — rather than gating on a
  checkbox nobody could read.
- *Attachment thumbnails and an upload control.* The build holds a file's name,
  revision and hash, not its bytes, so a statement attaches records the order
  already carries, each named with where it came from.
- *The case sample is a freelancing dispute* — Upwork wording, a $50 escrow,
  "revisions", a video attachment. The layout is kept: statement thread on the
  left, summary and records on the right, describe-and-submit at the bottom. The
  data is this platform's.

## M10 — Payouts and earnings

Figma: `3:39549`–`3:40994`, `4:48745` withdrawal history.

| # | Sub-task | State |
| --- | --- | --- |
| 10.1 | Earnings: what is held against live orders, what is released, what is refunded or in an open case | done |
| 10.2 | The payout list per order, with the documented event that released it, filtered by state, buyer and date | done |
| 10.3 | Withdrawal, and the history of withdrawals | prototype — no bank rail, stated on the screen |
| 10.4 | Release is never a button here: it is ops-only, and the screen says what it is waiting for | done |
| 10.5 | Tests: the amounts equal the buyer's payment record minus the platform fee, to the minor unit | done |

**Decisions and corrections made here**

- **Every figure is derived, none is stored twice.** Held, released, fees,
  refunded and in-dispute are sums over the same `Payout` rows the buyer's payment
  record produced, in integer minor units. The manufacturer's "released" total and
  the buyer's "paid" total are the same number by construction, not by agreement.
- **A release is shown with the event it was made against.** A payout row carries
  the documented event kind — delivery confirmed, review window closed, case
  resolved — because a release with no event id behind it is the one thing this
  platform promises never to do.
- **No release control on this screen, deliberately.** A shop cannot release its
  own money, and the screen explains what would release it instead of leaving a
  disabled button to guess at.

**Design deviations (data, not layout)**

- *The design's "Total earnings" tile* is split into held and released. One
  number covering both is the number a shop would spend twice.
- *"Withdraw" completes instantly in the design.* No payment provider is
  connected in this build, so the modal records the request and says plainly that
  nothing has moved and no account has been debited or credited.
- *The withdrawal history* is the requests made in this screen, labelled as such.
  Inventing settled bank transfers would be inventing money.

## M11 — Messages and notifications

Figma: `4:50147`–`4:50834`.

| # | Sub-task | State |
| --- | --- | --- |
| 11.1 | The same threads, from the other side: request, quote, order, case | done |
| 11.2 | The fact card a thread carries — what the conversation is about, with links into it | done |
| 11.3 | Sending a message, marking a thread read, and the unread count | done |
| 11.4 | Notifications for this manufacturer | done |
| 11.5 | Tests: a message sent here is read there, in one thread | done |

**Decisions and corrections made here**

- **One thread per record, shared by both sides.** A message sent from this panel
  is the same row the buyer opens; there is no manufacturer-side inbox mirroring a
  buyer-side one. That is the whole reason a thread is keyed to the request or the
  order rather than to a pair of users.
- **A thread opens with the facts, not with scrollback.** The card at the top of a
  conversation states the record it is about — quantity, state, amount — and links
  to it, so a shop answers with the specification in front of it.
- **Unread is per member, not per shop.** Two agents in one shop do not clear each
  other's unread counts.

**Design deviations (data, not layout)**

- *The design's attachment control* is not offered: no file bytes in this build.
- *"Typing…" and read receipts* are dropped rather than faked; there is no realtime
  channel yet, and a fake presence indicator is a lie about who is at the desk.
- *The design's contact list of buyers* becomes the list of records, because a
  buyer with three orders is three conversations that must not be merged.

## M12 — Profile

Figma: `217:119418` — 51 frames: about, machine and process, capabilities per
process, service and certification, equipment, agents, review, articles, and the
public view of each.

| # | Sub-task | State |
| --- | --- | --- |
| 12.1 | About: company information, address, member since, and the live counts | done |
| 12.2 | What buyers are matched on: services, regions, minimum order quantity, standard lead time | done |
| 12.3 | Services and certifications | done |
| 12.4 | Agents: the members of this manufacturer | done |
| 12.5 | Reviews, read-only, as buyers wrote them | done |
| 12.6 | Articles, from the blog workspace | done |
| 12.7 | Equipment, machines and the per-process parameter sheets | prototype — laid out, not stored, stated on the panel |
| 12.8 | The public view, which is what a buyer sees on the manufacturer card | done |

**Decisions and corrections made here**

- **The profile is the matching record, so it is honest about gaps.** Missing
  services, no regions, no minimum order quantity and no standard lead time are
  shown as warnings on the shop's own screen, because a request only reaches shops
  whose published capabilities cover it — an empty field is lost work, not a
  cosmetic gap.
- **Every headline number is a query.** Quotes, orders, parts, rating, on-time
  delivery and completed orders come from rows, so the profile cannot drift from
  what the buyer's manufacturer card shows.
- **Reviews are read-only here.** A shop cannot edit, hide or reply to a buyer's
  review in this build; showing an edit control would imply a moderation path that
  does not exist.

**Design deviations (data, not layout)**

- *The design's equipment list and per-process parameter sheets* (PCB, PCBA, 3D
  printing, CNC, injection moulding, each with its ranges) have no tables yet. The
  panels are built to the design and marked "laid out, not yet stored", and they do
  not pretend a saved sheet changes the buyer's fit verdict. Wiring them into
  `assertManufacturerFits` is the logic pass.
- *Logo and cover image upload* is not offered — no file bytes.
- *The design shows a follower count and a profile view count.* Neither is
  measured; both are omitted rather than seeded with a plausible number.

## M13 — Blog

Figma: `4:52977` — list, filter, create, thumbnail, category, preview, and the
approved and rejected states of a re-submitted post.

| # | Sub-task | State |
| --- | --- | --- |
| 13.1 | List with state filters and counts | done |
| 13.2 | The editor: title, category, tags, body, with a read-time estimate | done |
| 13.3 | Submit for review, and the approved and sent-back states with the reason | done |
| 13.4 | The reading view | done |
| 13.5 | Storage: `ShopArticle` and its moderation state | done |

**Decisions and corrections made here**

- **IDEEZA reviews an article before it appears.** "Draft", "with IDEEZA",
  "published" and "sent back with a reason" are states, rather than a publish
  button that does everything — that is what the design's rejected-and-resubmitted
  frames actually describe.
- **An empty article is refused.** A title and a few sentences are the minimum;
  the screen says why rather than saving something a reviewer would bounce.

**Design deviations (data, not layout)**

- *Publishing is nobody’s to do yet.* Articles are stored in `ShopArticle`
  and survive a reload; the profile Blog tab reads the same rows. But only
  IDEEZA may mark one published and there is no ops panel, so `published` is
  reachable through the seed and not through the product. Until that panel
  exists, a live shop’s writing reads “With IDEEZA” — which is true rather
  than flattering.
- *Rich text and images* are plain paragraphs and a generated card header; the
  editor states it.

## M14 — Settings

Figma: `217:138184` — 78 frames: company and profile information, preferences
(language, region, notifications), general ($IDZ pay, tax residence and
identification, payment methods, withdrawal history, KYC levels, get paid),
security (password, two-step verification, login alerts, security questions,
sessions, deactivate and delete) and policy and privacy (report, activity).

| # | Sub-task | State |
| --- | --- | --- |
| 14.1 | The section rail and one pane, as the design has it | done |
| 14.2 | Company information and social links, stored | done |
| 14.3 | Profile: name, picture, email and mobile with verification | done |
| 14.4 | Notification switches — six topics by three channels, mandatory ones locked | done, `NotificationChoice` |
| 14.5 | Language and date format | done, `UserPreference` |
| 14.6 | KYC levels 1-3, payout methods, tax residence and identification | done, `KycSubmission`, `PayoutMethod`, `TaxProfile` |
| 14.7 | Security: password, two-step, security question, login alerts, sessions, deactivate, delete | done, `UserSecurity` |
| 14.8 | Policy, privacy, activity, and the shop's disputes | done, read from real rows |

**Decisions and corrections made here**

- **All ten panes write.** Every switch, choice and form on this screen is a
  row: the person's name and picture, their password and devices, what they are
  told about and where, which language they read, what is shared, their identity
  checks, their payout methods and tax details. Nothing is held in a component
  with a notice under it any more.
- **A secret is never stored as itself.** A security answer is scrypt-hashed
  with the parameters the password uses; an account number and a tax number
  keep their last four characters and nothing else. What is not stored cannot
  leak, and four is enough to show somebody which one they gave.
- **A verification code is shown, not claimed to have been sent.** There is no
  mail or SMS service in this build, so the dialog says so and prints the code
  for that address. "Check your inbox" would send a person looking for
  something that was never posted.
- **A deletion is a request.** An account may be the counterparty to an order
  with money in escrow, and the platform cannot honour a delivery for a shop
  that no longer exists, so ops answers it. A deactivation is dated and
  reversible, and says that orders in production carry on.
- **Two-step verification stores the choice and admits the gap.** Signing in
  still asks for the password alone, because sending the second step needs the
  service that does not exist. The pane says which half works.
- **Activity is the platform's own events.** `DomainEvent` is append-only and
  written in the same transaction as the act it records, so it is read directly
  rather than kept again for this screen — a second log would be a second
  story.
- **Company information is stored, because an order ships to it.** It is also
  what a buyer reads, and it validates what a shipment needs.
- **A mandatory notification is marked, not silently forced.** A shop cannot turn
  off "a buyer decides on your quote" — the switch is locked with the reason
  beside it, rather than appearing to be a choice.
- **Nothing here fakes a verification.** A shop submits an identity check and
  IDEEZA answers it; no path in the product marks one approved, and level two
  refuses to open until level one is. No identity document is uploaded or kept —
  the submission records the names of what was offered and says so. A settings
  screen that reports "verified" without a verification is the worst possible
  lie for this platform to tell.
- **The dispute and activity panes read real rows.** Open case count comes from
  the same cases as M09, so settings cannot disagree with the order screen.

**Design deviations (data, not layout)**

- *"$IDZ pay"* is a currency the platform does not have; the pane keeps the
  design's shape under the payout terms that do exist.
- *"Delete account"* is not wired. An account tied to funded orders and held money
  cannot be deleted by a button, and the pane says what actually has to happen.
- *Security questions* are dropped: the auth package does not use them, and adding
  a form that stores answers nowhere would be a security theatre with real
  personal data in it.
- *Two-step verification and session lists* are shown as the design has them, with
  a plain statement that the sign-in path in this build is email and password only.

---

## Where the manufacturer side stands

M01–M08 are built against real rows, with the domain refusing what it should
refuse and a two-sided test proving the buyer reads what the shop wrote. M09–M12
and M14 are built the same way wherever a table exists, and the panels that
depend on tables this build does not have — equipment and parameter sheets, blog
posts, preferences, KYC and payment providers, withdrawals — are laid out to the
design and labelled on the screen as not yet stored. M13 is a prototype
workspace in full.

That labelling is the point: a shop can read every screen and know exactly which
of them is a promise the platform is keeping and which is a shape waiting for its
logic pass.

## Looking at the two panels

`pnpm run review` starts one throwaway database with both built panels against
it — the buyer on 3100, the manufacturer on 3200 — so the two sides of one record
can be read side by side. It seeds the reference scenario and both fixture sets,
prints the accounts it found in that database, and removes everything on Ctrl+C.

Both panels run with `REVIEW_DIRECT_SIGN_IN=1`, which takes the email and
password off the sign-in screen: opening a panel signs you in as a seeded
account, and `/auth/sign-in?pick=1` — where signing out lands — switches
account. It is a review affordance and it is fenced as one:

- the `/auth/enter` route answers 404 unless that variable is exactly `1`, and
  both harnesses assert that with the flag unset, so the door cannot be left ajar
  without a test failing;
- it can only enter an account that already exists in the database with the right
  role, and for a shop, a membership. It creates nothing and grants nothing;
- the session it issues comes from the same service the password path uses, so
  every guard, capability and shop scoping still applies;
- only `tools/review-environment.mjs` sets the variable, and only for the two
  child processes it starts.

The three tools that run a built app — both harnesses and the review environment
— take an exclusive lock (`.build-lock`) first. Two `next start` processes on one
`.next` share its runtime cache, and on Windows that shows up as a route which
quietly fails to navigate: a failure that looks exactly like a broken screen and
is not one. The lock refuses the second one with a sentence saying who holds it.

## Working rules

The same as the buyer side, and one addition.

- Layout from Figma, data from the model. Every deviation is written down in the
  stage it belongs to.
- The design system is the only source of components; a new pattern is added to
  `@ideeza/ui` rather than hand-rolled in a screen.
- No dead control: a button either does the thing or is not there.
- Every stage ends with the four gates (typecheck, lint, tests, build) and a
  browser run of the flow it added, including the mobile layout.
- **And: every stage that touches a shared record ends with a two-sided test** —
  the same row read from both apps, asserting the buyer sees exactly what the
  manufacturer wrote.

## Known defect: the tutorial chapter tree sometimes does not move

Clicking a lesson in the chapter tree (`components/tutorial/chapter-tree.tsx`)
occasionally leaves the page where it was. Measured on 2026-09-01 over several
runs of `tools/verify-manufacturer-app.mjs` and three standalone reproductions:

- it moves on most attempts and stays put on some, on the same build;
- waiting for React to attach first does not remove it — a run that waited
  three seconds after `networkidle` still stayed put;
- arriving through the category redirect (`/tutorial/code-tech` →
  `.../introduction`) versus arriving at the lesson directly makes no reliable
  difference; both have moved and both have stayed;
- the address the link carries is always right, and opening that address
  directly always renders the lesson. So the routes are sound; it is the client
  navigation that is not.

The harness therefore pins both ends — the link points at the next lesson, and
that address is a page with that lesson on it — rather than racing the click.
Whoever picks this up: start with the aborted `?_rsc=` prefetches visible in
the browser log on that screen, and with whether `redirect()` from a
`force-dynamic` category page leaves the router cache in a state where a
sibling soft navigation is dropped.
