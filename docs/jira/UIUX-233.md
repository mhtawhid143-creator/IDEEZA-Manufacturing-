# UIUX-233 — Manufacturer Portal UI/UX Review & Flow Improvements

Epic: [UIUX-233](https://ideeza.atlassian.net/browse/UIUX-233) · reported by Sohaib
Tahir · label `manufacturer-design-testing` · **127 child tickets, all To Do**
(MFG-01 … MFG-134, with gaps).

The epic's own words:

> Implement the UI/UX improvements identified during the comprehensive review of
> the Manufacturer Portal. The work covers the complete manufacturer journey,
> including Dashboard, RFQs, Quotes, Orders, Production, Inventory, Refunds and
> Disputes, Payouts, and Messages.
>
> Individual MFG tickets should remain as separate tasks under this epic so that
> each finding can be implemented, reviewed, and tested independently.

## How this is worked

One ticket at a time, in waves, and a wave is not left until every ticket in it
is either done or written down as refused with a reason. Before a wave starts,
its tickets are checked against **this** build: the review was carried out on a
different one, so some findings are already true here, some describe a screen
this repo does not have, and the rest are real. That check is recorded per
ticket rather than assumed.

Each ticket then runs the same course: the design system first
(`docs/FIGMA-DS-CATALOG.md`, then the component's own Figma spec), a failing
test, the change, then typecheck, lint, the full suite, both harnesses and a
look at 1440 and 390. A ticket is closed only with evidence beside each of its
acceptance criteria.

## Order of the waves, and why

| Wave | What | Why it is here |
| --- | --- | --- |
| 0 | Competitor branding and broken money identifiers | A rival's name on our screens is a commercial problem, not a cosmetic one, and a payout id that renders as an error string is money nobody can trace. Both are small and severe. |
| 1 | Refund and dispute | Money at risk and a decision the shop has days to make. Seven of the nine are Highest. |
| 2 | Order and production | What a shop looks at all day, and where wrong data reads as fact — misaligned spec fields, a progress bar that shows the same fill on every row. |
| 3 | RFQ → quote | The largest group (53) and the one that earns the shop its work. Split into RFQ details, the quote modal, quote details, and the lists. |
| 4 | Inventory | Wrong stock states cause wrong quotes; the review found "In Stock" shown with nothing free. |
| 5 | Dashboard | Read first, acted on rarely: the numbers must be right, but nothing here blocks a job. |
| 6 | Payouts and withdrawals | Small group, mostly wording, with the identifier defect already taken in wave 0. |
| 7 | Messages, terminology and copy | Consistency and typos across the portal, once the surfaces they sit on have stopped moving. |

## Wave 0 — competitor branding and broken money identifiers · done

Four tickets. Three were already true in this build; one was real and is built.
Each verdict below was checked against the code, not assumed.

### UIUX-151 (MFG-47) — "With JLCPCB logo" on Production Specification · **already satisfied**

The ticket asks for the competitor name removed and for an audit of other
unwhitelabeled content. A search of `apps/` and `packages/` for `JLCPCB`,
`EasyEDA`, `PCBWay`, `Seeed`, `LCSC`, `Upwork`, `Fiverr`, `Alibaba`,
`AliExpress`, `DigiKey`, `Mouser`, `Altium`, `KiCad`, `Autodesk`, `Protolabs`,
`Xometry` and `Shapeways` returns nothing in any source file. The names appear
only in `docs/`, where the deviation was recorded when the screens were built:
the Figma spec's fabrication-house fields were deliberately not copied
(`docs/MANUFACTURER-SIDE-PLAN.md`, `docs/USER-SIDE-PLAN.md`).

### UIUX-163 (MFG-60) — JLCPCB/EasyEDA field labels in the substitute popup · **already satisfied**

Same audit. The substitution surface in this build
(`components/request/missing-parts.tsx`) labels its own fields — "Missing
parts", "Inventory check required before quoting" — and carries no branded
label.

### UIUX-217 (MFG-117) — "Upwork" in the Dispute Center, and a reason that is not selectable · **already satisfied**

The ticket is explicit that it was written against a design export, not a
build: *"design spec, not yet built"*.

Its first half — no competitor name — holds by the audit above. Its second half
is the interesting one: a Dispute Reason displayed that does not appear in the
list a person picks from. In this build both panels read one list,
`ORDER_ISSUE_REASON_LABEL` in `packages/domain/src/read/resolution-document.ts`,
through `issueReasonLabel`; the buyer's refund form, the buyer's case page and
the shop's case page all render from it. What can be chosen is what is shown.

### UIUX-224 (MFG-126) — a disputed payout says nothing about its dispute · **built**

The ticket has two parts. The first — a Payout ID rendering as
`0xfailed...000000` — does not apply: this build has no Transaction Breakdown
modal, and its identifiers come from `payoutReference(row.id)` over a real
stored id.

The second part is real here, and the ticket calls it *"structurally more
important"*: a payout row could read **Disputed** and offer nothing but "Open
the order". A shop could see its money stopped with no way to learn why.

- `PayoutRow` now carries `disputeId` and `disputeReason`, read through the
  order's cases. The unresolved case is preferred when an order has more than
  one, because a resolved case is history and history is not what is holding
  the money.
- The row prints the reason under the status chip, in the shared words both
  panels use for it.
- Its menu offers **Open the dispute** first, pointing at the case itself
  (`/orders/{orderId}/disputes/{disputeId}`), with "Open the order" after.

Evidence: 3 data tests in `apps/manufacturer/test/payouts-dispute.db.test.ts`
(the case and its reason on the row; nothing claimed on an undisputed payout;
the open case preferred over a resolved one), and 4 harness checks that walk the
real screen — the held row exists, it names the reason, the menu offers the way
in, and the link points at the case rather than the order.

## Wave 1 — refunds and disputes · done

Seven tickets. Four had real work; the rest were satisfied or sequenced. The
whole of it is on the tickets with evidence; the short version:

- **UIUX-213** — production carried on under an open case, and the timeline
  pulsed "Live" while it did. `assertProductionMayStart` now refuses a disputed
  order, so the case freezes the work as well as the money, and the timeline
  says so with a Held marker, the reason, and the way into the case. A claim is
  deliberately not blocked: that decision is still the shop's own.
- **UIUX-215** — the approve form asked a shop to agree with a claim it could
  not see. It shows the buyer's reason and words read-only, the amount stays
  visible, the placeholder no longer asks for a confession, and the button says
  "Approve refund" rather than inventing a third verb.
- **UIUX-212 / UIUX-211** — an unanswered claim was findable only by opening the
  right order while its deadline ran. The dashboard carries it now: who, how
  much, why, and the deadline written out with its year.
- **UIUX-216** satisfied, **UIUX-214** four points of five, **UIUX-199**
  postponed behind MFG-08/09/23 rather than designed twice.

## Wave 2 — order and production · in progress

**UIUX-113 with UIUX-108 and UIUX-111 (MFG-08/03/06) — done as one panel**, which
is what MFG-08 asked for.

The Production Status panel had six rows: the four universal stages plus
"Shipped or delivered" and "Needing attention". The last two do not belong in a
list of stages — the first is after production, and the second can happen during
any of them. So the list is exactly the four the ticket decided (Queued, In
production, Quality check, Awaiting shipment), the count column has a name
(Qty), what needs attention is a flag below the four, and the shipped count is
kept as a caption rather than thrown away because it moved out of a list.

The panel can be scoped to All / PCB / 3D printing rather than being built
twice. The stage names never change with the scope — that is the whole point of
a universal set, and a test pins it. A full product counts under both scopes,
because it is both.

**UIUX-116 and UIUX-200 (MFG-11/97) — the stage track.**

A first pass over these two recorded them as already satisfied because the bar's
fill was computed from real counts rather than fixed. Reading the tickets against
the code properly showed that was only half of what each asks, and the other half
was genuinely missing: the bar was a single continuous fill, and it drew a
cancelled order, an order with a case open on it and a healthy one exactly alike.

Both are now one shared component, `StageTrack` in `packages/ui`, built from the
design system's own **M33 Stepper · Horizontal Dotted** variant — one dot per
stage in that order's own pipeline, the connectors filled behind it, the current
one marked, and the `X/Y` count written beside it because a length has no scale
of its own. The Orders table and the dashboard's "Orders in production" panel
both draw it, which is MFG-97's third recommendation — audit the same control
wherever it is reused — done by there being only one of it.

State is written down, not left to a colour: an order past the quoted date reads
`late`, one with an open case reads `held`, and a cancelled or refunded one reads
`stopped`, each in the accessible name as well as the caption. A held order with
no stage in hand says "Not started · 0/10 · held" rather than the "Finished" the
first build of this produced.

Where these two tickets contradict each other, MFG-97 wins and MFG-11's third
point is not implemented: MFG-11 asks for the dots to be coloured by manufacturer
type, MFG-97 asks for colour to distinguish stopped and held orders. Colour can
carry one meaning. The order's state is the one with money behind it, so work
type belongs in the Type column MFG-09 asks for instead. The reasoning is on the
ticket.

**UIUX-204 (MFG-101) — the casing, and the breadcrumbs.**

Also recorded as already satisfied on the first pass, also wrong. The status
chips read sentence case from `packages/ui/src/components/status.tsx`, but the
canonical production stages in `packages/domain` read Title Case — so one order
said "In production" as a status and "In Production" as a stage, which is the
ticket's finding exactly. The dashboard had a third spelling, "in production",
because it named the stage by rubbing the underscores out of its key.

The stage list is now sentence case, the dashboard reads the domain's own label,
and a test holds every canonical stage to sentence case so the two lists cannot
drift apart again.

Its breadcrumb point is the fourth sighting of one defect, and it is fixed once:
the order, quote and request shells now end their trail with the record's own
name, matching the heading beneath it, instead of "Order details" / "Quote
Details" / "View Details" — page kinds the reader could already see.

Its remaining points were already true here: the milestone under a stage is named
"Inventory check", not "Inventory Check Completed", and there is no malformed
"IN progress" pill — the progress words come from the same one map.

Already true of this build, checked rather than assumed:

- **UIUX-201 (MFG-98)** — the Orders table leads each row with the product name,
  with the buyer and the order reference beneath it. Only the header was vague,
  and it now reads "Product", matching the dashboard's.
- **UIUX-152 (MFG-48)** — the specification grid is built from typed rows that
  each carry their own label and value, so a value cannot land under another
  field's label.

**UIUX-112 (MFG-07)** asked for a column header to read "Customer". It cannot:
the column leads with the product and carries the buyer beneath it, already
labelled. Naming it Customer would replace a vague header with a wrong one, so
it reads **Product**, and the ticket carries the reasoning to be overruled.

**UIUX-153 with UIUX-155 (MFG-49/51) — a printed part gets a document of its
own.**

This was the one ticket in the wave confirmed real on the first reading, and it
was the largest. A board had a 28-field specification, its own screen, its own
invariants and its own frozen record. A printed part had **five answers**
appended to the end of the general requirements — process, material, colour,
finish, infill — and nowhere at all for the layer height, the wall thickness,
the size of the thing, the tolerance, how it is supported, which way up it is
made, what happens to it afterwards, or what it has to be certified to. A
printer prices on every one of those.

So the print specification is now the board's peer, at every layer:

- `PrintSpecification` in the schema, one row per requirements version, every
  column optional, frozen with the requirements it belongs to — built the same
  way as `BoardSpecification` and for the same reasons. Two hand-written CHECK
  constraints, because Prisma models neither: every measurement is positive, and
  a bounding box is three axes or none.
- `printSpecificationRows` in the domain, read by both panels so they cannot
  word the same document differently. Two rows are left out rather than shown
  open, because they are not decisions waiting to be made: a Shore hardness on a
  rigid material, and a certification nobody asked for.
- `assertPrintSpecCoherent` refuses what cannot be built rather than warning
  about it: a tolerance or a wall finer than the layer it would be made from, an
  infill pattern on a process that removes material, a Shore hardness on
  something rigid, half a bounding box.
- A buyer's screen to fill it in, the peer of the board's, with the durometer
  field shown only on a flexible material and the infill pattern only on a
  process that fills.
- Both manufacturer specification tabs — on the request and on the order —
  render it as its own card, headed with a **PCB** or **3D printing** chip so it
  is never in doubt which spec applies to which part of the job. That last part
  is also **UIUX-210 (MFG-109)**'s complaint, which is that whatever the request
  tab is missing the order tab is missing too.

**UIUX-155 (MFG-51)** is satisfied by construction rather than by patching a
string: the size is built by one function that joins the three axes with `×` and
writes the unit once — `118.4 × 96.25 × 47 mm`. There was no dimension field in
this build to carry the reported asterisk, and now the field that exists cannot
produce one. A browser check asserts no `mm* ` pattern appears on the page.

Rec. 4 of MFG-49 also moved something out: the five print answers no longer
appear in the general requirements at all. Printing the same fact in two places
is how two screens start disagreeing about one job.

Not implemented, with the reason: **Build Time**, from the ticket's field list.
It is a manufacturer's estimate, not a buyer's requirement — the lead time asked
for is already a requirement row, and what a build takes is an output of quoting
rather than an input to it. Per-component splitting (a spec section per BOM
component rather than per manufacturing type) is **UIUX-207 (MFG-105)**'s
multi-product work and is left to it.

Fixed on the way, because the new screen exposed it: the assembly row read "No
assembly — bare boards" on a print-only request, which has no boards to be bare.
It reads "No assembly asked for", which is true either way.

## Wave 3 — inventory · done

Eleven tickets. Four had real work, five were already true, and two were held
behind data this build does not have — recorded on the tickets rather than
guessed at.

- **UIUX-218** — the shelf reports its value at cost, because a count of parts
  says nothing about the capital standing still in the store; the low-stock and
  out-of-stock cards take the table's own severity colours so the most urgent
  figure no longer looks exactly like the least urgent one. A card only takes
  its tone when the number is non-zero: zero out of stock is good news, and
  painting it red teaches a shop to ignore the colour.
- **UIUX-119 / UIUX-121** — the dashboard's stock panel now carries the SKU a
  shop would reorder against, and writes down what separates its three states
  instead of leaving a reader to predict them. The states themselves were
  already derived from one rule rather than stored, which was the harder half.
- **UIUX-120** — the audit this ticket asked for found two of our three stock
  pills built from parallel ternaries: one choosing the colour, one choosing the
  words. Nothing was wrong with the output, but that shape is the reported
  defect waiting to happen. Both read from one key now.
- **UIUX-222 / UIUX-223** — a part can be described in the shop's own words,
  which with names like "SMD resistor" is often the only thing that tells two
  SKUs apart; category is the first question the form asks; and a new part
  starts **switched off**, where it used to go live matched the moment it was
  typed — countable towards a real request before anyone had looked at it.
- **Already true**: UIUX-117 (the header reads Part), UIUX-118 (consistent, and
  sentence case by the convention UIUX-204 settled), UIUX-219 (availability is
  stock *less* reserved, so the reported "In Stock with nothing free" cannot
  occur), UIUX-221 (none of the three copy defects exist here).
- **Held with the dependency named**: Pending Reorders needs a purchase-order
  model (UIUX-220's own conclusion, and UIUX-218's rec. 4); category-conditional
  fields need the category to become a defined set rather than free text;
  attachments need file storage, since this build keeps a file's name and hash
  and not its bytes; and UIUX-223's auto-enable-after-approval needs the ops
  review surface, which is not built.

## Wave 4 — dashboard, messages and copy · done

Fourteen tickets, mostly small, and the pattern in them was consistent: a
control or a word that could not be acted on.

- **UIUX-106 / UIUX-107** — the headline row reads as a funnel now: what came
  in, what was answered, how often the answer was taken. The win rate counts
  **decisions rather than submissions**, because a quote still waiting on a
  buyer is silence and not a loss, and a shop with nothing decided shows no rate
  at all rather than 0%. And the row finally says what the shop earned —
  released, not gross, because the difference is the platform's fee and was
  never theirs. Neither replaced tile was lost: the pending figure sits beside
  what was released on the payouts panel, and the delayed count moved to the
  Production Status panel as a second flag next to needing-attention.
- **UIUX-114** — the kind of work is stated on each row rather than inferred
  from recognising "solder mask" as a board word. The ticket's colour-by-type
  recommendation was refused on UIUX-116's reasoning: colour is already spoken
  for by state, and a hue that means two things means neither.
- **UIUX-202 / UIUX-205** — an order names the quote it was opened against, and
  the production panel says how many stages are done out of how many, in the
  same `X/Y` convention the Orders table and the dashboard panel use.
- **UIUX-225 / UIUX-230 / UIUX-231** — a withdrawal you can quote and whose
  status is worded; one action per destination on a thread card, where the
  request card duplicated the header's own link and the order card had two
  labels on one href; and an order that carries substitutions says so and points
  at the terms they were accepted with.
- **UIUX-229** — one verb for getting a price to a buyer. The dashboard said
  "Send quote" for what the domain event, the buyer's screens and every other
  surface call submitting one.
- **UIUX-122** — a bare name on a panel headed "Recent payouts" reads as
  whoever is being paid; it is the buyer whose order earned the money, and the
  row says so in place.
- **Already true**: UIUX-109 (the trend caption is under its number, and the
  legend has its subtitle), UIUX-110 (the breakdown is by package kind, so 3D
  work is a first-class category), UIUX-123 (stage names come from one
  vocabulary, so the reported casing drift cannot occur), UIUX-228 (no "Submite"
  anywhere), UIUX-232 (the RFQ context is plain text, not input-shaped).
- **Not applicable**: UIUX-226 and UIUX-227 describe a Withdraw Funds modal this
  build does not have, because paying out to a bank is IDEEZA's step here. The
  wording decisions are recorded on the tickets for when it is built.

## Wave 5 — the bill of materials and substitutes · done

Six tickets on one flow: what a shop does when it cannot build a line from
its own stock.

- **UIUX-159** — a real defect, not only a Figma one. The button said "Manage
  substitute" and opened a dialog titled "Missing parts", so a shop pressed one
  thing and arrived somewhere that looked like a different screen. Both read
  **Manage substitutes** now, and the harness asserts the dialog is named after
  the control that opened it.
- **UIUX-160** — the dialog states `N of N answered` with the consequence of
  the rest. The ticket asked for the save to be **blocked** until every line is
  answered; that was refused, because partial saving is a working capability
  here (the action sends a null substitute per unanswered line). The screen owed
  the shop a count and a consequence, not a locked button.
- **UIUX-162** — the largest change. "No substitute available" is now a state
  the platform can read: `SubstitutionStatus.unavailable`, terminal on write
  because the buyer has no substitute to approve, excluded from the pending
  count that holds up acceptance, and kept honest by two check constraints —
  such a row names no part and carries no impact. Where the shop held nothing at
  all the dialog used to render **no control**, only a sentence; the select is
  always there now. The outcome rides on "Quoted" as `· 1 part unfulfilled`
  rather than becoming a seventh quote status, and the buyer's row stops
  offering *Approve* over an empty suggestion and offers the three answers they
  actually have: take the rest, ask the shop to hold, or withdraw and reroute.
- **Already true**: UIUX-157 (there is no Package column, so no "Packge" typo),
  UIUX-158 (the banner reads from `counted()`, so number and noun cannot
  disagree), UIUX-161 for four of its five asks — Ref/Component/SKU
  traceability, computed price impact, computed lead-time impact, and the
  approval state are all on the row.
- **Named as blocked**: UIUX-161's **spec comparison**. A BOM line holds a
  reference, a name, a part number and an SKU — not a parametric specification —
  so there are no two sides to compare. It needs structured part attributes on
  `RfqItem` and `InventoryItem`, which is the same schema-and-taxonomy
  decision UIUX-222 is blocked on. One ticket, not two.

## Wave 6 — the request, from arriving to being answered · done

Fourteen tickets. The theme in them was a screen that could not say where
something was, or what to do about it.

- **UIUX-115** — the dashboard's action panel offered "Submit quote" on every
  row, which was *correct* for the rows it had: it queried unquoted requests
  and nothing else, so a buyer's question and a revision they asked for
  appeared nowhere. Five reasons now, each with the act it asks for, decided
  together in `REQUEST_ACTION` so a sixth cannot be added without saying what
  answers it. Two of the ticket's categories were refused: no counter-offer
  model exists (a buyer asks for a revision), and money is the buyer's step.
- **UIUX-127** — six statuses that partition the inbox, from one function
  (`requestLifecycle`) the rows, the counts and the filter all read. The
  routing row could not do this alone: it stays "quoted" whether the buyer
  accepted the quote or pulled the request, so a shop could not see what it had
  **won** and was invited to quote requests that no longer existed. A database
  test asserts the six sum to the total and that each count is what its filter
  returns. "Opened" moved to the date column, because whether a person looked at
  something is a fact about the clock and not a place in a lifecycle.
- **UIUX-126** — the kind-of-work filter matched the package kind exactly, so
  **PCB** excluded every combined request: a request needing both was hidden
  from both of the filters a shop that does both would have used. One domain
  helper (`packageKindsIncluding`) now answers "which kinds involve this work",
  and the dashboard's scope rule reads it too so the two cannot drift.
- **UIUX-144** — four names for one manufacturing type, not three: "3D",
  "3D module", "PCB + 3D", and — already, in the inventory scopes and the print
  specification — "3D printing". The last wins because it was already there. The
  duplicated label maps were **deleted** rather than corrected, since a second
  copy is how four names happened. Recorded on the ticket: "3D module" was also
  doing duty for what the *package contains*, which is a different axis and now
  says so.
- **UIUX-138 / UIUX-139 / UIUX-142** — the request names itself with the
  reference the dashboard and the case records already quote (six raw-id sites
  fixed, not one); its file count is the way to the files; and the BOM row is
  gone from requests that have no bill of materials, where it read `0` and
  invited the shop to wonder what it was missing.
- **UIUX-181** — the rail says which way the work is going: **RFQs** and
  **My Quotes**, matching **My Orders** below them, with the headings and
  breadcrumbs following. The ticket's open question is answered on it: a quoted
  request **stays** on RFQs in "Quote sent", because the two pages count
  different things — demand that reached the shop, and quotes the shop wrote.
- **UIUX-145** — the client panel says whether quoting this buyer has led
  anywhere: how many of their quoted requests they accepted, and how many of
  those they paid for. **No star rating**: nothing on this platform rates a
  buyer, so a score out of order counts would look like a judgement somebody
  had made. A harness check asserts no star glyph appears, so the decision
  cannot be reversed by accident.
- **Already true**: UIUX-140 and UIUX-188 (both breadcrumbs read the record, and
  from the same shared shape), UIUX-141 (`BOM / Parts`, symmetric), UIUX-178
  (no "New Quotes" card, and the two stat rows are not a shared component),
  UIUX-191 (one name for the RFQ overview tab), UIUX-165's leading zeros (no
  number is zero-padded anywhere) — though its missing unit was real and fixed.
- **Named as blocked**: UIUX-187's authoritative-ID question is answered by the
  reference helpers, but UIUX-146 (a link to the source design project) still
  needs a project model, and UIUX-126's per-pipeline stage split belongs to
  UIUX-206, not here.

## Wave 7 — the Submit Quote modal · done

Seven tickets on one screen: the only binding step in the flow, and the least
protected one in it.

- **UIUX-166** — a unit price can be itemised, and the lines have to add up to
  it. Two new tables (`QuoteCostLine`, `QuoteDeviation`) and a domain
  invariant, because the alternative is the buyer reading two prices for one
  thing. Two families of line, and `quoteCostKindsFor()` decides which a
  request can carry — a fabrication-only board is never *offered* a stencil and
  the invariant *refuses* one, so a future importer cannot get it wrong either.
  Itemising stays optional; an unexplained price is not the same as a price made
  of zeros, and the screen says which it is.
- **UIUX-164** — the summary block had no header and no stated relationship to
  the fields above it, so a shop could not tell a live calculation from a number
  out of nowhere. It was always a calculation; now it says so, and the shipping
  and tooling lines that separate subtotal from grand total are shown.
- **UIUX-167** — Submit was enabled whatever the form held. One gate now, and it
  says what it is waiting for in words. The server checks are untouched: the
  harness still proves a lead time of `0` — which is filled in, so the button is
  live — is refused by the domain.
- **UIUX-170** — the acknowledgment, feeding that same one gate rather than a
  second mechanism. **Attachments are blocked**: this build records a file's
  name, revision, size and hash, not its bytes, so an upload control would
  accept a quote PDF and have nowhere to put it. Same dependency as UIUX-149 and
  UIUX-150; all three should land on one storage decision.
- **UIUX-171** — the quote records which frozen requirements it answered
  (`quotedAgainstLockedAt`), and a later freeze flags it as answering the
  earlier ask. **Flagged, not invalidated**: a buyer touching a field should not
  be able to destroy a price that may still be perfectly good, and requiring
  re-confirmation is the same problem more slowly.
- **UIUX-168** — both date fields name the buyer's own window. Where they
  disagree it **warns rather than blocks**, because "I can make this, but later
  than you asked" is a real answer and the buyer's to accept. The comparison is
  production time *plus express transit* against the wanted-by date, which is
  the arithmetic the ticket was really about.
- **UIUX-169** — the split the ticket asks for already existed: the quoted lead
  time is production only, transit is `TRANSIT_DAYS` and the courier is the
  buyer's choice at checkout. The modal now shows the delivered-by estimate for
  both couriers. **Two recommendations refused, on domain grounds**: a shipping
  method on the quote would take a decision away from the buyer, and a **deposit
  percentage cannot exist here** — IDEEZA secures the whole amount and money
  leaves escrow only against a documented trigger, so "50% upfront" would be
  either a promise the platform will not keep or a hole in the escrow model.

One incidental finding worth recording: the `removeCard` failures treated all
session as a known flake were **orphaned embedded-postgres processes** from
killed harness runs — thirty of them, holding the machine at half load. With
them cleared the shop harness ran **355/355** with nothing failing.

## Wave 8 — the quotes list, and the state a quote is in · done

Six tickets, and one vocabulary decision underneath all of them.

- **UIUX-177** — a quote now reads as one of five, from `quoteLifecycle()` in
  the domain beside the request's own six. "With the buyer" and "Not chosen"
  were a third variant of the settled words. `Revised` and
  `revision_requested` stop being statuses: a quote the buyer asked to see
  again is still a quote with the buyer. **Departure, stated on the ticket**:
  the label is "Declined **by the buyer**", because the request side already
  uses the bare word for *this shop* turning work down, and one word for two
  actors' decisions is worse than a longer label. A test asserts the actor stays
  in it.
- **UIUX-183** — one pill per row, always, with the reason drawn as a ring and
  a dot **on that same pill** rather than a second badge of equal weight, and
  the reason's words as a caption under it. Safe because a reason can only exist
  while a quote is open — every other state is terminal — and that is enforced,
  not assumed: `quoteReason()` returns null for all four terminal states and a
  test walks them. The flag is derived rather than stored, so it cannot disagree
  with the pill it draws.
- **UIUX-179** — four decisions instead of one card per status, which cannot
  work at four slots against five states. What is open and what it is worth,
  what is waiting on you, what you won, how often you win. The lifetime total
  moved beside the table where a denominator belongs; the rejected count lives
  in the filter, which was its only use. "Requiring action" is drawn as an alert
  because it double-counts a subset of "Quoted" by design.
- **UIUX-180** — pressing a card *is* the filter, and the dropdown that said the
  same thing is deleted. The alert card filters to `?status=action`, which is a
  reason and deliberately not a sixth status. **The undefined coupling is now
  stated on the page**: the counts are all-time, the dates narrow the table.
  Leaving that unsaid meant a card disagreeing with the table could not be told
  from a bug.
- **UIUX-176** — the request's quoted state reads its own quote back (total,
  unit price, lead time, both dates) beside the buyer's target and labelled
  apart from it, and its button says **"Revise or withdraw it"** while the quote
  can still be changed. Withdrawn was a status with no route to it. Linked
  rather than duplicated, per the ticket's own later update: two Withdraw
  buttons is two places for the guard to drift.
- **UIUX-182** — decided control by control rather than left as-is: the Status
  dropdown is **removed**, the date range is **kept and fully specified** (what
  it narrows, default, clear, active-filter signal, empty state), and the row
  menu's open question is **answered** — its set is fixed because every item is
  a reading, which is the same rule that makes the RFQ inbox's menu
  status-aware, since that one carries acts.

And a harness finding worth keeping: presses that "went nowhere" on a long list
— a row menu here, a conversation on the buyer's side — were the control sitting
under the sticky navbar, which is the trap `removeCard` already documents. Both
now centre the control first, and both keep the screenshot when a press still
does not go.

## Wave 9 — the quote's own page, and reading before pricing · done

Eight tickets, and one architectural decision the whole group turns on.

- **UIUX-193** — the quote form is **not offered** until the parts of the
  request that apply have each been opened. Accepting a quote secures the
  buyer's money, so a blind price is a dispute with funds already held against
  it. Which parts apply comes from the domain: the specification always, the
  files only when the buyer attached some, the bill of materials only when there
  is one — a gate a shop cannot pass, or one that makes it open an empty page,
  teaches it that the gate is theatre. **Hard, not soft**, and shown as the
  route: the sections sit where the form will be, each a link, each ticked once
  opened, with Decline still available. Recorded per shop and per request (three
  columns on `RfqRecipient`) so it survives a reload and cannot be satisfied by
  someone else's reading. The two entry points the ticket calls the worst case —
  the row menu and the dashboard panel — already routed through the request in
  this build.
- **UIUX-186 / UIUX-184 / UIUX-192** — one decision, three tickets: **each page
  owns one object and links to the other**. The quote page owns the quote
  (revise, withdraw, pricing, substitutes, the specification it answered); the
  request's pages own the request. So the quote page gained the kind of work
  and named links into the files and the specification, rather than a second
  rendering of the brief — and the request's quoted state gained the quote read
  back plus "Revise or withdraw it" (UIUX-176, wave 8). Parity was refused:
  duplicating Withdraw is two places for one guard to drift.
- **UIUX-192's real defect** was two hand-written renderers of the buyer's ask
  that **had already drifted** — one carried the quotable reference, a file link
  and a hidden BOM row; the other printed bare counts and said "3D" where the
  first said "3D printing". Every difference was a fix from this same review
  landing on one copy only. There is one component now, and what legitimately
  differs is a prop.
- **UIUX-196** — the identical heading "General information" appeared on
  **three** surfaces over two different field sets. They now say whose
  information they hold. A colour accent was refused: colour already means state
  (UIUX-116) and urgency (UIUX-183), and a hue that means three things means
  none of them.
- **UIUX-189** — the buyer's target sits above the breakdown with the difference
  worked out. **Over is stated as plainly as under**: a platform that renders an
  honest high price as a failure teaches shops to quote one they cannot deliver
  at. Answered from the domain — nothing reads `targetPriceMinor`, so it is a
  target and not a ceiling.
- **Already true**: UIUX-185 (every value renders at full ink; the muted tone is
  used once, for an absence, and says why), UIUX-190 (the spec-version stamp and
  the stale warning landed with UIUX-171 in wave 7).
- **Named as blocked**: pinning the *file manifest* to a quote — each file
  carries a revision and a hash, but the quote records the requirements' freeze
  rather than a manifest. That belongs with UIUX-146's project traceability,
  which needs the source-project model this build does not have.

## Every ticket

| Ticket | MFG | Priority | Summary |
| --- | --- | --- | --- |
| [UIUX-106](https://ideeza.atlassian.net/browse/UIUX-106) | MFG-01 | High | Add "Quote Win Rate" KPI to Dashboard top stat row, replacing redundant "Delayed Orders" card |
| [UIUX-107](https://ideeza.atlassian.net/browse/UIUX-107) | MFG-02 | High | Add "Total Revenue" KPI to Dashboard top stat row, replacing "Pending Payouts" card |
| [UIUX-108](https://ideeza.atlassian.net/browse/UIUX-108) | MFG-03 | Low | Production Status panel: add "Qty" header above the stage count column |
| [UIUX-109](https://ideeza.atlassian.net/browse/UIUX-109) | MFG-04 | Low | Orders panel: move "vs Last Month" from header position to a trend caption under the number, and add a "Orders by service type" subtitle above the legend |
| [UIUX-110](https://ideeza.atlassian.net/browse/UIUX-110) | MFG-05 | Medium | Orders panel: replace PCB-only category breakdown with "PCB Manufacturing" + "3D Printing" |
| [UIUX-111](https://ideeza.atlassian.net/browse/UIUX-111) | MFG-06 | Medium | Production Status panel: pull "Delayed" out of the stage list into a separate flagged alert |
| [UIUX-112](https://ideeza.atlassian.net/browse/UIUX-112) | MFG-07 | Medium | Order In Production table: rename "Name" column to "Customer" and verify real data populates it |
| [UIUX-113](https://ideeza.atlassian.net/browse/UIUX-113) | MFG-08 | High | Define universal 4-stage Production Status pipeline (Queued / In Production / Quality Check / Awaiting Shipment) shared across PCB and 3D Printing, with type filter |
| [UIUX-114](https://ideeza.atlassian.net/browse/UIUX-114) | MFG-09 | Medium | Order In Production: define PCB vs. 3D Printing "Current Stage" vocabulary and add an explicit Type column |
| [UIUX-115](https://ideeza.atlassian.net/browse/UIUX-115) | MFG-10 | High | RFQ Requiring Action: define full scenario taxonomy and match each to a distinct CTA |
| [UIUX-116](https://ideeza.atlassian.net/browse/UIUX-116) | MFG-11 | High | Order In Production: replace ambiguous progress bar with a stepped stage-count indicator |
| [UIUX-117](https://ideeza.atlassian.net/browse/UIUX-117) | MFG-12 | Low | Inventory Health: rename "Parts Name" column header to "Part Name" |
| [UIUX-118](https://ideeza.atlassian.net/browse/UIUX-118) | MFG-13 | Low | Inventory Health: fix "Low stock" casing to match Title Case used by other status values |
| [UIUX-119](https://ideeza.atlassian.net/browse/UIUX-119) | MFG-14 | Medium | Inventory Health: define and surface the threshold logic behind the four Status tiers |
| [UIUX-120](https://ideeza.atlassian.net/browse/UIUX-120) | MFG-15 | High | Inventory Health: status pill color doesn't consistently match its own status text |
| [UIUX-121](https://ideeza.atlassian.net/browse/UIUX-121) | MFG-16 | Medium | Inventory Health: add Part Number/SKU column to distinguish identically-named rows |
| [UIUX-122](https://ideeza.atlassian.net/browse/UIUX-122) | MFG-17 | Medium | Recent Payouts: clarify and rename "Name" column ("Customer" vs. "Paid To") |
| [UIUX-123](https://ideeza.atlassian.net/browse/UIUX-123) | MFG-18 | Low | Recent RFQ & order activity: fix verb tense on "blocks 3 BOMs" and stage-name casing on "Solder mask" |
| [UIUX-124](https://ideeza.atlassian.net/browse/UIUX-124) | MFG-20 | Medium | Request Quotes: KPI card labels ("New Quotes"/"Submitted quotes"/"Rejected Quote") don't match table Status wording ("New RFQ"/"Quoted"/"Decline") |
| [UIUX-125](https://ideeza.atlassian.net/browse/UIUX-125) | MFG-21 | Medium | Request Quotes: add urgency/overdue qualifier to the New RFQ KPI card |
| [UIUX-126](https://ideeza.atlassian.net/browse/UIUX-126) | MFG-22 | High | Multi-type RFQs ("3D, PCB") exist in real data -- revise MFG-08/MFG-09 to support combined manufacturer types, not strict either/or |
| [UIUX-127](https://ideeza.atlassian.net/browse/UIUX-127) | MFG-23 | High | Request Quotes: define 6-status lifecycle (New RFQ / Quoted / Accepted-Won / Declined / Expired / Withdrawn) that sums to Total |
| [UIUX-128](https://ideeza.atlassian.net/browse/UIUX-128) | MFG-24 | Medium | Unify Submit/Send/Decline quote wording across row menu, RFQ Details page, and Dashboard RFQ panel; fix recurring "Submite quote" typo |
| [UIUX-129](https://ideeza.atlassian.net/browse/UIUX-129) | MFG-25 | Medium | Request Quotes row menu: verify/implement status-aware actions (New RFQ / Quoted / closed states should not share one static action set) |
| [UIUX-130](https://ideeza.atlassian.net/browse/UIUX-130) | MFG-26 | Low | Request Quotes: Description column truncates mid-word with no ellipsis -- match Name column's truncation style |
| [UIUX-131](https://ideeza.atlassian.net/browse/UIUX-131) | MFG-27 | Low | Request Quotes: remove redundant "Qty" repeated in every Quantity cell |
| [UIUX-132](https://ideeza.atlassian.net/browse/UIUX-132) | MFG-28 | Highest | RFQ Details: offer expiry date (Aug 5, 2024) predates the quote received date (Aug 5, 2025) -- audit date logic |
| [UIUX-133](https://ideeza.atlassian.net/browse/UIUX-133) | MFG-29 | Medium | RFQ Details: relabel "$1000 Price" on New RFQ items -- ambiguous before any quote is submitted |
| [UIUX-134](https://ideeza.atlassian.net/browse/UIUX-134) | MFG-30 | Medium | RFQ Details: fix "Jhon Smith"/"Message with jhon" and "United Stats" typos, add missing Location label |
| [UIUX-135](https://ideeza.atlassian.net/browse/UIUX-135) | MFG-31 | High | RFQ Details: "Project Name" field shows bare number "14" instead of an actual name |
| [UIUX-136](https://ideeza.atlassian.net/browse/UIUX-136) | MFG-32 | Low | RFQ Details: fix "assemble" -> "Assembly" typo in Manufacturing type field |
| [UIUX-137](https://ideeza.atlassian.net/browse/UIUX-137) | MFG-33 | Low | RFQ Details: pluralize unit labels (Total Product/BOM Item/Quantity/Total Manufacturing Project) to match their counts |
| [UIUX-138](https://ideeza.atlassian.net/browse/UIUX-138) | MFG-34 | Low | RFQ Details: RFQ ID field ("03") doesn't match the portal's RFQ-#### ID convention used elsewhere |
| [UIUX-139](https://ideeza.atlassian.net/browse/UIUX-139) | MFG-35 | Low | RFQ Details: add a direct link/action from "Attached file: 6 Files" to the Production Files tab |
| [UIUX-140](https://ideeza.atlassian.net/browse/UIUX-140) | MFG-36 | Low | RFQ Details: breadcrumb should show the RFQ's title, not the generic "View Details" action name |
| [UIUX-141](https://ideeza.atlassian.net/browse/UIUX-141) | MFG-37 | Low | RFQ Details: fix asymmetric spacing in "BOM/ Parts" tab label |
| [UIUX-142](https://ideeza.atlassian.net/browse/UIUX-142) | MFG-38 | Medium | RFQ Details General Information: keep as a lightweight summary -- do not duplicate Production Specification's technical fields here |
| [UIUX-143](https://ideeza.atlassian.net/browse/UIUX-143) | MFG-39 | High | RFQ Details page: design distinct per-manufacturing-type layouts across all tabs (Brief, Production Files, Production Specification, BOM/ Parts) |
| [UIUX-144](https://ideeza.atlassian.net/browse/UIUX-144) | MFG-40 | Medium | Unify "3D" / "3D Module" / "3D Printing" naming for the same manufacturing type across the portal |
| [UIUX-145](https://ideeza.atlassian.net/browse/UIUX-145) | MFG-41 | Medium | RFQ Details: add a client rating/reliability indicator to "About the client" |
| [UIUX-146](https://ideeza.atlassian.net/browse/UIUX-146) | MFG-42 | Highest | Define a traceable, versioned link between an RFQ and its source design-tool project (Project ID, source link, snapshot/sync model) |
| [UIUX-147](https://ideeza.atlassian.net/browse/UIUX-147) | MFG-43 | High | Define required PCB Production Files set (Gerber/Drill/Fab drawing always; CPL/BOM/Assembly drawing if Assembly; exclude Schematic by default) |
| [UIUX-148](https://ideeza.atlassian.net/browse/UIUX-148) | MFG-44 | High | Define required 3D Printing Production Files set (3D model + print spec always; orientation/finish/BOM conditional) -- companion to MFG-43 |
| [UIUX-149](https://ideeza.atlassian.net/browse/UIUX-149) | MFG-45 | Medium | Production Files: define per-file-type viewer (embedded Gerber/3D viewers, PDF/table previews) instead of download-only files and one generic viewer bar |
| [UIUX-150](https://ideeza.atlassian.net/browse/UIUX-150) | MFG-46 | Medium | Redesign Production Files tab: typed file icons, real thumbnail previews, split preview/download actions, more compact multi-component layout |
| [UIUX-151](https://ideeza.atlassian.net/browse/UIUX-151) | MFG-47 | Highest | URGENT: Production Spec "Package Box" field shows competitor brand name ("With JLCPCB logo") -- audit for other unwhitelabeled content |
| [UIUX-152](https://ideeza.atlassian.net/browse/UIUX-152) | MFG-48 | Highest | Production Spec: field-value misalignment (PCB Qty/Different Design/PCB Thickness/Gross Weight show values from other fields) -- data-integrity bug |
| [UIUX-153](https://ideeza.atlassian.net/browse/UIUX-153) | MFG-49 | High | Production Spec: split into one section per manufacturing type (PCB spec + 3D Printing spec), not one PCB-only table for the whole RFQ |
| [UIUX-154](https://ideeza.atlassian.net/browse/UIUX-154) | MFG-50 | Highest | Add a per-manufacturing-type completeness check to the project-to-RFQ auto-linking pipeline -- probable root cause of MFG-39/MFG-49 |
| [UIUX-155](https://ideeza.atlassian.net/browse/UIUX-155) | MFG-51 | Low | Production Spec: "Dimension" field uses "*" instead of "x"/"×" as the width/height separator |
| [UIUX-156](https://ideeza.atlassian.net/browse/UIUX-156) | MFG-52 | High | BOM/Parts tab: gate visibility per component on whether assembly/multi-part build is actually included, per MFG-43/44 |
| [UIUX-157](https://ideeza.atlassian.net/browse/UIUX-157) | MFG-53 | Low | BOM/Parts: fix "Packge" column header typo (should be "Package"), repeated across all 3 component tables |
| [UIUX-158](https://ideeza.atlassian.net/browse/UIUX-158) | MFG-55 | Low | BOM/Parts: fix garbled grammar in Inventory Check banner ("2 Component require substitute proposals, create must approved...") |
| [UIUX-159](https://ideeza.atlassian.net/browse/UIUX-159) | MFG-56 | Medium | Substitute-handling flow: unify terminology across banner, icon, button, and dialog (currently 7 different phrasings) |
| [UIUX-160](https://ideeza.atlassian.net/browse/UIUX-160) | MFG-57 | Medium | Manage Substitute dialog: "Proceed to Proposal" is disabled with no stated reason or progress indicator |
| [UIUX-161](https://ideeza.atlassian.net/browse/UIUX-161) | MFG-58 | High | Manage Substitute dialog: add Ref/Component/SKU traceability, spec comparison, previous/new price, lead-time impact, and approval fields |
| [UIUX-162](https://ideeza.atlassian.net/browse/UIUX-162) | MFG-59 | Highest | Define "no substitute available" path: structured per-row flag + "Quoted · partial fulfillment" quote state + buyer decision point |
| [UIUX-163](https://ideeza.atlassian.net/browse/UIUX-163) | MFG-60 | Highest | Substitute detail popup: rename JLCPCB/EasyEDA-branded field labels, same white-labeling gap as MFG-47 |
| [UIUX-164](https://ideeza.atlassian.net/browse/UIUX-164) | MFG-61 | Highest | Submit Quote modal: second pricing block has no header, no stated derivation from "Your Quote," and no defined Subtotal vs. Grand Total |
| [UIUX-165](https://ideeza.atlassian.net/browse/UIUX-165) | MFG-62 | Low | Submit Quote modal: Overview stats mix leading-zero and missing-unit formatting ("04 pcs" vs. bare "134") |
| [UIUX-166](https://ideeza.atlassian.net/browse/UIUX-166) | MFG-63 | Highest | Submit Quote modal: replace flat "Unit price" with an itemized cost breakdown (Fabrication/Parts/Assembly/Stencil/Shipping for PCB; Material/Print Time/Support/Finishing/Hardware for 3D Printing) |
| [UIUX-167](https://ideeza.atlassian.net/browse/UIUX-167) | MFG-64 | Highest | Submit Quote modal: no required-field markers and "Submit" is never gated, unlike the earlier Manage Substitute dialog |
| [UIUX-168](https://ideeza.atlassian.net/browse/UIUX-168) | MFG-65 | Medium | Submit Quote modal: Lead Time / Quote Expire never reconciled against the RFQ's own Timeline / offer expiry shown in the sidebar |
| [UIUX-169](https://ideeza.atlassian.net/browse/UIUX-169) | MFG-66 | High | Submit Quote modal: add payment terms (deposit/schedule) and split Lead Time into production time + shipping method/delivery estimate |
| [UIUX-170](https://ideeza.atlassian.net/browse/UIUX-170) | MFG-67 | High | Submit Quote modal: add file attachment support and a binding-acknowledgment step before submission |
| [UIUX-171](https://ideeza.atlassian.net/browse/UIUX-171) | MFG-68 | Highest | Submit Quote modal: add spec-compliance affirmation (with structured deviations) and stamp the quote with the Production Spec version quoted against |
| [UIUX-172](https://ideeza.atlassian.net/browse/UIUX-172) | MFG-69 | Medium | Request Quotes: rename "Manufacturer type" filter to "Manufacturing Type" to match the column it filters |
| [UIUX-173](https://ideeza.atlassian.net/browse/UIUX-173) | MFG-70 | Low | Request Quotes: fix double space in "New Quotes" and unify capitalization/pluralization across the four KPI labels |
| [UIUX-174](https://ideeza.atlassian.net/browse/UIUX-174) | MFG-71 | Medium | Request Quotes: row thumbnail is always a PCB image, contradicting rows whose Manufacturing Type is 3D Printing |
| [UIUX-175](https://ideeza.atlassian.net/browse/UIUX-175) | MFG-72 | Medium | Layout viewer: "All / None" layer control lacks separation and places its icons on opposite sides |
| [UIUX-176](https://ideeza.atlassian.net/browse/UIUX-176) | MFG-73 | High | Quoted state: no summary of the submitted quote, $1000 relabelled "Price"->"Budget", and no Withdraw action despite MFG-23's Withdrawn status |
| [UIUX-177](https://ideeza.atlassian.net/browse/UIUX-177) | MFG-74 | Highest | Quotes page Status column contradicts MFG-23 lifecycle: "Pending"/"Rejected" wording, revision states promoted to statuses, no Withdrawn |
| [UIUX-178](https://ideeza.atlassian.net/browse/UIUX-178) | MFG-75 | High | Quotes page "New Quotes" KPI card counts a non-existent state -- no matching Status value, delete it |
| [UIUX-179](https://ideeza.atlassian.net/browse/UIUX-179) | MFG-76 | High | Define the final Quotes page KPI card set: 4 decision-oriented cards (Quoted / Requiring Action / Accepted / Quote Win Rate), replacing one-card-per-status |
| [UIUX-180](https://ideeza.atlassian.net/browse/UIUX-180) | MFG-77 | Medium | Quotes page KPI cards are inert and duplicate the Status dropdown's axis; Date range coupling to the cards is undefined |
| [UIUX-181](https://ideeza.atlassian.net/browse/UIUX-181) | MFG-78 | Medium | Left-nav "Request Quote" vs "Quotes" gives no incoming/outgoing cue -- rename to "RFQs" and "My Quotes" |
| [UIUX-182](https://ideeza.atlassian.net/browse/UIUX-182) | MFG-79 | High | Quotes page Status/Date range filters AND the row action menu were built without a Figma design -- specify them or remove them |
| [UIUX-183](https://ideeza.atlassian.net/browse/UIUX-183) | MFG-80 | High | Status column design spec: one pill per row, urgency shown as a Quoted-pill style variant (ring + dot + caption), not a second badge |
| [UIUX-184](https://ideeza.atlassian.net/browse/UIUX-184) | MFG-81 | High | Quote Details' General Information block is missing manufacturing type, attached files, and any production-content reference present on RFQ Details |
| [UIUX-185](https://ideeza.atlassian.net/browse/UIUX-185) | MFG-82 | Medium | Quote Details Pricing Breakdown renders as disabled/muted gray despite being finalized, already-submitted quote data |
| [UIUX-186](https://ideeza.atlassian.net/browse/UIUX-186) | MFG-83 | Highest | Two inconsistent surfaces exist for a submitted quote -- Quote Details has Revise/Withdraw, RFQ Details' Quoted state (MFG-73) has neither |
| [UIUX-187](https://ideeza.atlassian.net/browse/UIUX-187) | MFG-84 | Medium | Quote Details "Substation part" field is a likely typo for "Substitution Part," and "Request quote" field duplicates the Linked RFQ tab under a different name |
| [UIUX-188](https://ideeza.atlassian.net/browse/UIUX-188) | MFG-85 | Low | Quote Details breadcrumb shows generic "Quote Details" instead of the quote's own title -- same defect as MFG-36 on RFQ Details |
| [UIUX-189](https://ideeza.atlassian.net/browse/UIUX-189) | MFG-86 | Medium | Quote Details Pricing Breakdown has no comparison to the buyer's original Budget figure |
| [UIUX-190](https://ideeza.atlassian.net/browse/UIUX-190) | MFG-87 | High | Quote Details has no spec-version reference -- a submitted quote can't be tied to the design version it was priced against |
| [UIUX-191](https://ideeza.atlassian.net/browse/UIUX-191) | MFG-88 | Low | Quote Details' "Linked RFQ" tab opens a page headed "RFQ overview" -- tab label and destination heading disagree |
| [UIUX-192](https://ideeza.atlassian.net/browse/UIUX-192) | MFG-89 | High | "RFQ overview" tab duplicates RFQ Details' Brief-tab content as a separate, reduced surface with no path to Production Files/Spec/BOM |
| [UIUX-193](https://ideeza.atlassian.net/browse/UIUX-193) | MFG-90 | Highest | No path to Submit Quote requires the manufacturer to have opened Production Files, Spec, or BOM first -- three separate entry points can produce a fully blind quote |
| [UIUX-194](https://ideeza.atlassian.net/browse/UIUX-194) | MFG-91 | High | Quote Details Pricing Breakdown has no per-manufacturing-type split for a mixed PCB/3D Printing RFQ |
| [UIUX-195](https://ideeza.atlassian.net/browse/UIUX-195) | MFG-92 | High | Umbrella spec: assembled target shape for Quote Details Pricing Breakdown, consolidating MFG-61/62/63/66/82/86/87/91 |
| [UIUX-196](https://ideeza.atlassian.net/browse/UIUX-196) | MFG-93 | Medium | "General Information" heading is reused verbatim for two different field sets (manufacturer's own quote vs. buyer's RFQ), with no visual distinction between them |
| [UIUX-197](https://ideeza.atlassian.net/browse/UIUX-197) | MFG-94 | Highest | Substitution tab shows substitutes as already-settled with no approval status, inside a quote already submitted as "Pending" with no buyer sign-off gate |
| [UIUX-198](https://ideeza.atlassian.net/browse/UIUX-198) | MFG-95 | Highest | Orders page heading reads "Quotes" and all 4 KPI cards use unedited Quotes-page labels -- page was cloned and never adapted |
| [UIUX-199](https://ideeza.atlassian.net/browse/UIUX-199) | MFG-96 | High | Define the Order Status lifecycle: 8 raw values with no defined set; "Cancel/Refund Requested" and "Disputed" likely belong as reason chips/flags, not top-level statuses |
| [UIUX-200](https://ideeza.atlassian.net/browse/UIUX-200) | MFG-97 | Highest | Orders page Current Stage progress bar shows identical fill on every row regardless of actual stage position or terminal/exception status |
| [UIUX-201](https://ideeza.atlassian.net/browse/UIUX-201) | MFG-98 | High | Orders table has no product/item column -- Order ID, User Name, Quantity, and price only, with no way to tell what was ordered |
| [UIUX-202](https://ideeza.atlassian.net/browse/UIUX-202) | MFG-99 | High | Orders table has no Quote ID or link back to the originating Quote/RFQ -- third occurrence of a pipeline-wide traceability gap |
| [UIUX-203](https://ideeza.atlassian.net/browse/UIUX-203) | MFG-100 | Highest | Send Orders tab back to UI design for a complete redesign against the attached mockup -- do not patch MFG-95..99 independently |
| [UIUX-204](https://ideeza.atlassian.net/browse/UIUX-204) | MFG-101 | Medium | Order Details: "In production" vs table's "In Production" casing mismatch, malformed "IN progress" pill, and a 4th generic breadcrumb occurrence |
| [UIUX-205](https://ideeza.atlassian.net/browse/UIUX-205) | MFG-102 | Medium | Order Details Production Tracking has no overall progress summary (X/9 or %) anywhere on the panel |
| [UIUX-206](https://ideeza.atlassian.net/browse/UIUX-206) | MFG-103 | High | Production Tracking forces PCB and 3D Printing into one linear sequence with no per-component split, contradicting the Production files tab on the same page |
| [UIUX-207](https://ideeza.atlassian.net/browse/UIUX-207) | MFG-105 | Highest | Multi-product projects must be supported consistently across Quotes/RFQ/Order surfaces -- proven working in BOM/Parts and Production Files, missing everywhere else |
| [UIUX-208](https://ideeza.atlassian.net/browse/UIUX-208) | MFG-106 | Highest | Establish one traceable ID chain from the website Project through RFQ, Quote, and Order -- three independent breaks already found (MFG-42/84/99) |
| [UIUX-209](https://ideeza.atlassian.net/browse/UIUX-209) | MFG-107 | High | Order Details' Quote Details tab is a 4th duplicate rendering of General Information/Pricing content with a contradicting breadcrumb -- redesign as a summary + link |
| [UIUX-210](https://ideeza.atlassian.net/browse/UIUX-210) | MFG-109 | Highest | Production Specification's known bugs (JLCPCB branding, field-mapping, missing per-type sections, dimension separator) all persist onto the execution-stage Order Details view |
| [UIUX-211](https://ideeza.atlassian.net/browse/UIUX-211) | MFG-111 | High | Dashboard refund-request banner has 6+ grammar/formatting errors in money-facing copy |
| [UIUX-212](https://ideeza.atlassian.net/browse/UIUX-212) | MFG-112 | Highest | Refund Approve/Dispute flow has no visible amount/reason, no dedicated page to revisit it, and an inconsistent Order ID format |
| [UIUX-213](https://ideeza.atlassian.net/browse/UIUX-213) | MFG-113 | Highest | Production continues unpaused (and shows LIVE) on orders with an open refund dispute; the refund banner's Order ID link leads to zero refund-specific detail |
| [UIUX-214](https://ideeza.atlassian.net/browse/UIUX-214) | MFG-114 | Highest | Refund decision surface: no support/escalation path, no Approve confirmation, undefined Dispute outcome, buried deadline, no visible order value |
| [UIUX-215](https://ideeza.atlassian.net/browse/UIUX-215) | MFG-115 | Highest | Approve-refund modal reuses a mismatched manufacturer confession form, never shows a dollar amount, and pre-checks Terms and Conditions |
| [UIUX-216](https://ideeza.atlassian.net/browse/UIUX-216) | MFG-116 | Highest | Dispute button on the refund banner is non-functional -- clicking it produces no response |
| [UIUX-217](https://ideeza.atlassian.net/browse/UIUX-217) | MFG-117 | Highest | Dispute Center case content contains Upwork (competitor branding) and a Dispute Reason not present in the reason dropdown |
| [UIUX-218](https://ideeza.atlassian.net/browse/UIUX-218) | MFG-119 | High | Inventory KPI cards: add Inventory Value/Reserved/material-split/Pending Reorders, add severity color, fix Alart typo |
| [UIUX-219](https://ideeza.atlassian.net/browse/UIUX-219) | MFG-121 | High | Inventory Status shows In Stock even when Reserved consumes 100% of Availability (Free = 0) |
| [UIUX-220](https://ideeza.atlassian.net/browse/UIUX-220) | MFG-122 | Medium | Reserved has no order-linkage and Pending Reorders has no data model -- both proposed KPI cards need new data before they can ship |
| [UIUX-221](https://ideeza.atlassian.net/browse/UIUX-221) | MFG-123 | Low | Add New Part modal: Category placeholder, Price per Unit placeholder, and Pisces (pcs) typo |
| [UIUX-222](https://ideeza.atlassian.net/browse/UIUX-222) | MFG-124 | High | Add New Part: missing Description field, Category should be first, add Part Type sub-classification, category-specific fields, PDF attachment |
| [UIUX-223](https://ideeza.atlassian.net/browse/UIUX-223) | MFG-125 | Highest | Add New Part has no review gate -- Enable for Order Matching defaults to Enable with no approval step before publish |
| [UIUX-224](https://ideeza.atlassian.net/browse/UIUX-224) | MFG-126 | Highest | Transaction Breakdown: Payout ID renders as an error string (0xfailed...000000), and Disputed payouts show no reason or link |
| [UIUX-225](https://ideeza.atlassian.net/browse/UIUX-225) | MFG-127 | Medium | Withdrawal History: Transection ID typo, recurring IN progress casing bug, and no explicit link back to the source Payout |
| [UIUX-226](https://ideeza.atlassian.net/browse/UIUX-226) | MFG-128 | Low | Withdraw success modal button reads Go to Withdrawal table History instead of Go to Withdrawal History |
| [UIUX-227](https://ideeza.atlassian.net/browse/UIUX-227) | MFG-129 | Medium | Withdraw Funds: -$0.00 fee shown directly beside Other bank fees may apply, reading as contradictory |
| [UIUX-228](https://ideeza.atlassian.net/browse/UIUX-228) | MFG-130 | Low | Submit Quote modal title reads Submite Quote -- 3rd confirmed instance of this typo |
| [UIUX-229](https://ideeza.atlassian.net/browse/UIUX-229) | MFG-131 | Low | Standardize quote-action verb across Messages thread -- Submit Quote / Submite Quote / Send new quote all appear for the same action |
| [UIUX-230](https://ideeza.atlassian.net/browse/UIUX-230) | MFG-132 | Medium | View RFQ button duplicated -- appears in both the thread header and the RFQ card footer on the same screen |
| [UIUX-231](https://ideeza.atlassian.net/browse/UIUX-231) | MFG-133 | High | Order Created card shows a flagged Substitute count with no way to view or manage it, unlike the RFQ stage |
| [UIUX-232](https://ideeza.atlassian.net/browse/UIUX-232) | MFG-134 | Medium | Submit Quote modal: Budget and Total Part render as editable-looking inputs even though they are read-only RFQ context |