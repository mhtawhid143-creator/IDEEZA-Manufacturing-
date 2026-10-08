# UIUX-233 — wave 14: the reviewer's second pass

24 tickets were reopened on 2026-10-06/07 by Ahmed Kamal, each with a screenshot
attached. This file is the work breakdown: what each one says, what it is
actually caused by, and the micro-task that closes it.

## What I can and cannot see

Every reopening comment carries an inline image on `media.staging.atl-paas.net`.
Those are not reachable from here — the Atlassian MCP's fetch takes issue and
page references, not attachment blobs, and attachment URLs need credentials this
session must not ask for. So each entry below is built from **the comment text
plus a reproduction of that screen in this build**, light and dark, with
`tools/shoot-manufacturer.mjs` / `tools/shoot-user.mjs`. Where the text alone
does not pin the defect, that is said in the entry rather than guessed.

## The finding behind the findings

Ten of the twenty-four say a version of *"I don't see it"* — no cost breakdown,
no comparison, no 3D information, no dimensions, no withdrawal history, only one
product. Those features are built and tested. They are invisible because of
**which records the reviewer lands on**.

`packages/db/prisma/seed.ts` creates no `PrintSpecification`, no
`QuoteCostLine` and no `Withdrawal` row at all. The richer scenario lives in
`tools/verify-fixtures-manufacturer.ts` (the `mfrfix_*` records), which
`prepare-demo-database.mjs` does lay down — but those sit behind the seeded
records in every list, so the first request a reviewer opens is board-only, the
first quote is unitemised, and the withdrawal dialog is empty.

A feature a reviewer cannot reach is not shipped. **Wave A is therefore the
first and largest piece of work, and it closes or unblocks ten tickets on its
own.** It is demo data, not product logic — no state machine, no invariant and
no screen changes for it.

---

## Wave A — the demo database must exercise what is built

| # | Task | Closes |
| --- | --- | --- |
| A1 | Seed a **combined PCB + 3D printing** request as the newest row, so the default request shows both specification cards and both file groups | UIUX-143 |
| A2 | Seed `PrintSpecification` rows against it — all fifteen fields, including the three-axis bounding box | UIUX-153, UIUX-155 |
| A3 | Seed `QuoteCostLine` rows on at least two quotes, one per family, summing to the unit price (`assertCostLinesExplainUnitPrice` must pass) | UIUX-166, UIUX-194, UIUX-195 |
| A4 | Seed `Rfq.targetPriceMinor` on the request those quotes answer, so the budget comparison has something to compare | UIUX-189 |
| A5 | Seed `Withdrawal` rows — one `requested`, one `paid`, one `rejected` — so the history dialog has history | UIUX-225 |
| A6 | Order the lists so the richest records come first, and the request the reviewer opens from the dashboard is the combined one | all of the above |
| A7 | Extend `tools/verify-fixtures*.ts` assertions so an empty breakdown or an absent print spec fails the harness rather than passing quietly | regression guard |

A7 is the part that stops this recurring. The harness currently walks the
fixture scenario; it must also assert that the **seeded** scenario shows these
sections, because that is what a reviewer sees.

## Wave B — colour

| # | Task | Closes |
| --- | --- | --- |
| B1 | Inventory status pills: reproduce in both themes, fix the tokens so in/low/out read as three distinct colours | UIUX-120 |
| B2 | Chart legend swatches: apply the series colours to the legend keys | UIUX-119 |
| B3 | Production Files: give each file-role glyph its colour | UIUX-150 |

B3 reverses a refusal I made and argued for — colour was withheld so it would
not compete with the red "missing files" alert below the list. The reviewer has
now asked for it twice. **Their call stands**; the glyph gets a colour from the
`text-icon-*` family, and the missing-files alert keeps its own weight by being
the only `danger` surface on the tab.

B1 and B2 must both be checked in dark mode. The palette gap recorded in
`docs/DESIGN-SYSTEM.md` §11 (no `red-950`/`yellow-950`/`green-950`) is the
likeliest reason three colours read as one there.

## Wave C — words

| # | Task | Closes |
| --- | --- | --- |
| C1 | Dashboard delta caption: `vs the 30 days before` → `vs last month` (`apps/manufacturer/src/app/(app)/dashboard/page.tsx:351`) | UIUX-109 |
| C2 | Inventory status pills in **Title Case** | UIUX-118 |
| C3 | Fix the tense the ticket names | UIUX-123 |
| C4 | Stop truncating the manufacturing type; show it in full | UIUX-136 |
| C5 | Prefix the displayed reference with `#` | UIUX-138 |
| C6 | Find the surface still using a different name for the same type | UIUX-144 |
| C7 | Grammar pass on the dispute/case copy | UIUX-217 |

C2 is a **genuine conflict, not an oversight**. UIUX-204 settled sentence case
for labels across both panels and a test pins it. Title Case here means either
reopening that decision or carving out status pills as an exception. I will
carve out the exception, narrowly — status pills only — note it on both tickets,
and change the test to pin the narrower rule, because the reviewer has asked
twice and the broader convention survives.

C3, C4, C6 and C7 each name a defect without naming its location. For those I
reproduce the screen first and quote back in the Jira comment exactly what I
found and changed, so there is no second round of "not working" on a string I
guessed at.

## Wave D — behaviour

| # | Task | Closes |
| --- | --- | --- |
| D1 | A part with stock reserved in full must read **Out of stock**, not In stock — find where the row escapes `stockLevelOf()` | UIUX-219 |
| D2 | Make the "Parts reserved" KPI card pressable and filter the table by it, matching the order cards | UIUX-220 |
| D3 | The **buyer** panel still shows a live production badge on a disputed order; the hold was built manufacturer-side only | UIUX-213 |
| D4 | Remove the shipping estimate from the quote form and the saved quote | UIUX-169 |

D1 is the one I most expect to be a real defect rather than a misreading: the
domain rule is right and tested, so something on the inventory table is reading
a raw stock figure instead of `stockLevelOf()`.

D4 reverses a position I defended. The reviewer's instruction is plain —
shipping does not belong on the quote. The transit figures stay where the domain
puts them (on the order, by the buyer's courier choice); what goes is the
shop-entered estimate field and its row in the totals. That is a schema column
left in place and ignored, not dropped, so no migration is needed in this pass.

## Wave E — the one that does not fit in this pass

| # | Task | Closes |
| --- | --- | --- |
| E1 | Multi-product requests — many separate products in one request | UIUX-207 |

Unchanged from the earlier reply and not re-litigated: this is a schema change
across `Rfq`, `Quote`, `OrderSnapshot`, `ProductionStage` and `ProductionTask`,
plus a product decision nobody has taken — what an order's status *is* when one
component has shipped and another is still in production. Money leaves escrow
against that status, so a per-component tracker built before that answer would
make the escrow release read from a guess.

What this pass can do is stop the screen looking like a defect: the request
header states, in the reviewer's own words, that one request is one product and
that other products in the same project travel as their own requests, with a
link to them. That is honest and it is not the feature.

## Order of work

A → D → C → B → E. Wave A first because eight of the other entries cannot be
confirmed until the data is there; D before C because a behaviour fix can change
the words around it; B last of the fixes because colour is verified by
screenshot and that is one batched pass at the end.

Each wave ends with `pnpm run typecheck && pnpm run lint && pnpm exec vitest run`
and both harnesses, then screenshots at 1440×900 and 390×844 in both themes,
then the Jira comments and the transition to **Ready for Testing** — never Done.
