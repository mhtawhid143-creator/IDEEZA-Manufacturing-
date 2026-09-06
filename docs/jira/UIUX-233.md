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