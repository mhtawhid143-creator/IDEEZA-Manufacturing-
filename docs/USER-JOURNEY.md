# The buyer journey, as far as it is built

This is the buyer side of the approved business model: a product is kept, a
request is prepared from it, and the request is sent to manufacturers who quote
it. This document describes that first stretch — up to the request going out —
in detail. What follows it is built too: comparison, acceptance, secured
checkout, the order, production, delivery, refund and dispute, reviews and
messages, each documented in `docs/USER-SIDE-PLAN.md` under its task. The one
thing no route can do is decide a refund, dispute or cancellation, because that
belongs to an operations panel that does not exist yet; those screens say so.

## 1. The path

```
Favorites -> Single product -> Draft -> Select manufacturer -> (Compare) -> Request quote -> Request out for quotes
/favorites   /products/[id]    /manufacturing/draft/new   /manufacturing/rfq/new              /manufacturing/rfq/[id]
                               /manufacturing/draft/[id]  /manufacturing/rfq/new/compare
                                                          /manufacturing/rfq/new/request
```

The request itself is three steps, as the design file lays them out:

1. **Select manufacturer** — search, four filters, one card per manufacturer
   carrying its fit for this request, and a select bar that counts what is
   chosen. A card can also request a quote from that one manufacturer alone.
2. **Compare** — the chosen manufacturers side by side, on the facts the
   platform holds.
3. **Request quote** — what to quote, the assembly options, who receives it,
   the volume and timeline, a production note, and a summary that says whether
   the request is ready to send.

The selection travels in the query string (`?draft=…&m=id,id`), so the browser
back button, a reload and a shared link all behave.

The hub tabs follow the same states: **Draft** lists requests that have not been
sent, **Quote Requests** lists the ones that have.

## 2. What a "draft" is

A draft is a request in its first lifecycle state, not a separate kind of
record: one `Rfq` row with status `draft`, pointing at the
`ManufacturingPackage` that says what to build and the
`ManufacturingRequirements` that say how. The lifecycle already names this
state, and it is the only record in the schema that carries a buyer, which is
what makes "my drafts" answerable.

Saving a draft writes nothing to any manufacturer: there are no recipients, the
requirements are unlocked, and the request can be edited or withdrawn.

## 3. What sending does

Sending is the moment the request stops being the buyer's alone. In one
transaction:

1. the requirements are **locked** (`lockedAt`), so every recipient answers the
   same question and the quotes stay comparable;
2. the bill of materials is written onto the request as `RfqItem` rows, with
   quantities for the whole run rather than per unit;
3. one `RfqRecipient` row is created per selected manufacturer, in `routed`;
4. the request moves `draft -> submitted` through the state machine, never by
   assignment;
5. a `rfq.submitted` event is appended.

If any rule refuses the send, nothing is written: the draft is still a draft,
with no recipients, no items and unlocked requirements. A test asserts exactly
that.

## 4. What a request asks for

A request names the work it wants priced — fabrication, parts sourcing,
assembly, enclosure, stencil, testing — because "quote this board" means
different things to a fabricator and a test house. Those services are held on
the request (`Rfq.requestedServices`), and they are what the summary reads back
and what a manufacturer's fit is judged against.

**Fit** is a pure domain function, not a screen concern:

| Verdict | Meaning |
| --- | --- |
| Meets board spec | It publishes every service asked for and takes the quantity |
| Partial fit | It takes the quantity, but not all of the work, or it is usually slower than the lead time asked for |
| Can't build this | Its minimum order quantity is above the quantity asked for, or it publishes none of the work |

A manufacturer that cannot build the request cannot be selected, and the server
refuses it too — the same assessment behind both.

## 5. Rules the screens cannot talk their way out of

| Rule | Where it lives |
| --- | --- |
| Only an available product may start a request | `assertProductManufacturable` |
| One open request per product per buyer | `assertNoOpenRequestForProduct` |
| A request may only be edited while it is a draft | `assertDraftEditable` |
| A package carries at least one model file | `assertPackageIncludesFiles` |
| A quantity is a whole number of units above zero | `assertQuantityIsProducible` |
| A request goes to between 1 and 10 manufacturers, each once | `assertRecipientsSelected` |
| A request names at least one service to be quoted | `assertServicesRequested` |
| A recipient that could only decline is not a recipient | `assertRecipientCanTakeRequest` |
| Volume tiers are distinct production quantities | `assertVolumeTiersUsable` |
| A response deadline is in the future | `assertDeadlineIsInTheFuture` |

"Open" means `draft` or `submitted`. A `closed` or `withdrawn` request blocks
nothing, so the same product can be sent to manufacture again.

## 6. Why one open request per product

Two open requests for one product would collect two sets of quotes for the same
thing, and accepting one quote from each would create two orders the buyer never
meant to place. The second attempt therefore explains itself and offers the
request that already exists, rather than silently making another.

## 7. Deviations from the design file, and why

- **Quote Requests** is a hub tab the design does not have: a request that has
  been sent and is collecting quotes is neither a draft nor an order.
- **Model images** are drawn as a labelled placeholder. The product's images are
  stored files, and file storage is not part of the buyer-side work: the record
  exists, the bytes do not, and a broken image would be worse than an honest
  placeholder.
- **Reviews** on a product are the reviews of orders produced from it, because
  that is what the schema records: a review belongs to a delivered order.
- **Board capability chips** on a manufacturer card ("≤ 12 layers", "4 mil
  trace", "50 Ω", "ENIG") are not recorded anywhere on the platform, so the card
  shows the certifications and services that are. Inventing limits nobody
  published would make the comparison a fiction.
- **Cost on a draft row** stays "Not quoted" with the reason. The design shows a
  figure there; before a manufacturer has priced the work, any figure would be a
  guess.
- **The comparison table** carries the rows the platform holds. The design's
  packaging, NDA, engineering-support and monthly-capacity rows have no data
  behind them yet, so they are left out rather than filled in.
- **Three strings** in the design are typos — "Bear board", "Parts Scouring",
  "Meets Board Spece" — and are spelled correctly in the product.
- **The design file is entirely English**, so the interface is English. Nothing
  in the request flow is localised yet, and no Bengali copy was invented for it.
- **Quote-side actions** on the sent-request screen (quote total, accept,
  decline, message, re-request) belong to the quote task and are not drawn as
  dead buttons. What the buyer can actually do with a sent request — send it to
  another manufacturer, withdraw it — is built and works.

## 8. Data added for this work

- `ProductAvailability` and `Product.availability`: whether the creator still
  lets a product be sent to manufacture.
- `ProductFavorite`: the buyer's own list, which is where manufacturing starts.
- `Rfq.requestedServices`: the work the request asks to have priced.
- `AssemblySides` and `ManufacturingRequirements.assemblySides`: whether the
  board is populated on one side or both, which the request screen offers.

The first two arrived in the `product_favorites` migration, the last two in
`rfq_requested_services`. The seed carries four kept
products, one of them withdrawn by its creator, so the unavailable state is
visible without inventing it in the UI.
