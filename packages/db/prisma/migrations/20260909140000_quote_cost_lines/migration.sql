-- What a quote's unit price is made of, and where it departs from the spec.
--
-- The cost lines itemise `Quote.unitPriceMinor`; they are not a second source
-- for it. A domain invariant refuses a set that does not add up, and the check
-- constraint here refuses the two ways a single row can be wrong on its own.
CREATE TYPE "QuoteCostKind" AS ENUM (
  'fabrication',
  'parts',
  'assembly',
  'stencil',
  'material',
  'machine_time',
  'support_removal',
  'finishing',
  'hardware',
  'shipping'
);

CREATE TABLE "QuoteCostLine" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "kind" "QuoteCostKind" NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  CONSTRAINT "QuoteCostLine_pkey" PRIMARY KEY ("id")
);

-- A cost is never negative: a shop that wants to charge less quotes less.
ALTER TABLE "QuoteCostLine"
  ADD CONSTRAINT "quote_cost_line_is_not_negative" CHECK ("amountMinor" >= 0);

CREATE UNIQUE INDEX "QuoteCostLine_quoteId_kind_key" ON "QuoteCostLine" ("quoteId", "kind");
CREATE INDEX "QuoteCostLine_quoteId_idx" ON "QuoteCostLine" ("quoteId");

ALTER TABLE "QuoteCostLine"
  ADD CONSTRAINT "QuoteCostLine_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "QuoteDeviation" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "requirement" TEXT NOT NULL,
  "capability" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuoteDeviation_pkey" PRIMARY KEY ("id")
);

-- A deviation nobody can read is not a declaration. Both halves say something.
ALTER TABLE "QuoteDeviation"
  ADD CONSTRAINT "quote_deviation_says_something"
  CHECK (length(btrim("requirement")) >= 3 AND length(btrim("capability")) >= 3);

CREATE INDEX "QuoteDeviation_quoteId_idx" ON "QuoteDeviation" ("quoteId");

ALTER TABLE "QuoteDeviation"
  ADD CONSTRAINT "QuoteDeviation_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Which frozen specification this price answers.
ALTER TABLE "Quote" ADD COLUMN "quotedAgainstLockedAt" TIMESTAMP(3);
