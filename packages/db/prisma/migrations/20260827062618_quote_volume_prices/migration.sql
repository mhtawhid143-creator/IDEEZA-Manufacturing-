-- CreateTable
CREATE TABLE "QuoteVolumePrice" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "unitPriceMinor" BIGINT NOT NULL,
    "totalPriceMinor" BIGINT NOT NULL,
    "leadTimeDays" INTEGER,

    CONSTRAINT "QuoteVolumePrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteVolumePrice_quoteId_idx" ON "QuoteVolumePrice"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteVolumePrice_quoteId_quantity_key" ON "QuoteVolumePrice"("quoteId", "quantity");

-- AddForeignKey
ALTER TABLE "QuoteVolumePrice" ADD CONSTRAINT "QuoteVolumePrice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A price for an alternative volume is a real price for a real volume: a zero or
-- negative quantity is not a volume, and a zero price is not an answer. The
-- total has to be the unit price times the quantity, because both sides read the
-- two numbers and a total that disagrees with them cannot be compared.
ALTER TABLE "QuoteVolumePrice"
  ADD CONSTRAINT "quote_volume_price_is_a_real_price"
  CHECK (
    "quantity" > 0
    AND "unitPriceMinor" > 0
    AND "totalPriceMinor" = "unitPriceMinor" * "quantity"
    AND ("leadTimeDays" IS NULL OR "leadTimeDays" > 0)
    AND "currency" ~ '^[A-Z]{3}$'
  );
