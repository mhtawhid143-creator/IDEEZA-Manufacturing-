# The manufacturer app

The panel a manufacturer works in: the requests routed to it, the quotes it
sends, the orders it makes, its inventory, its payouts, its profile.

It is a separate application from the buyer app on purpose — a buyer path does
not exist in this router, and the route table for the `manufacturer` surface
lives in `@ideeza/auth`. Both apps read the same records through the same domain
package, which is what keeps the two sides of a request in step.

    pnpm --filter @ideeza/app-manufacturer dev    # http://localhost:3200
