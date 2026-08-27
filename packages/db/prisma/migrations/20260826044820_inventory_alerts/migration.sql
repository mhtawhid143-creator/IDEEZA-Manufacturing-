-- CreateEnum
CREATE TYPE "InventoryAlertStatus" AS ENUM ('open', 'substitute_approved', 'part_dropped', 'stock_awaited');

-- CreateTable
CREATE TABLE "InventoryAlert" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "raisedByManufacturerId" TEXT NOT NULL,
    "partReference" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "shortfallQuantity" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "suggestedInventoryItemId" TEXT,
    "suggestedPartName" TEXT,
    "technicalJustification" TEXT,
    "currency" CHAR(3) NOT NULL,
    "priceImpactMinor" BIGINT NOT NULL DEFAULT 0,
    "creditMinor" BIGINT NOT NULL DEFAULT 0,
    "leadTimeImpactDays" INTEGER NOT NULL DEFAULT 0,
    "restockLeadTimeDays" INTEGER,
    "status" "InventoryAlertStatus" NOT NULL DEFAULT 'open',
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryAlert_orderId_status_idx" ON "InventoryAlert"("orderId", "status");

-- CreateIndex
CREATE INDEX "InventoryAlert_raisedByManufacturerId_status_idx" ON "InventoryAlert"("raisedByManufacturerId", "status");

-- AddForeignKey
ALTER TABLE "InventoryAlert" ADD CONSTRAINT "InventoryAlert_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ManufacturingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAlert" ADD CONSTRAINT "InventoryAlert_raisedByManufacturerId_fkey" FOREIGN KEY ("raisedByManufacturerId") REFERENCES "ManufacturerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAlert" ADD CONSTRAINT "InventoryAlert_suggestedInventoryItemId_fkey" FOREIGN KEY ("suggestedInventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A decision is only a decision if it is dated, and an open alert has not been
-- decided. The database refuses the halfway state either way.
ALTER TABLE "InventoryAlert"
  ADD CONSTRAINT "InventoryAlert_decision_is_dated"
  CHECK (("status" = 'open') = ("decidedAt" IS NULL));

-- Approving a substitute is only possible when a substitute was suggested.
ALTER TABLE "InventoryAlert"
  ADD CONSTRAINT "InventoryAlert_approved_needs_suggestion"
  CHECK ("status" <> 'substitute_approved' OR "suggestedPartName" IS NOT NULL);

-- Money moves in one direction per decision: never a charge and a credit at once.
ALTER TABLE "InventoryAlert"
  ADD CONSTRAINT "InventoryAlert_one_money_direction"
  CHECK ("priceImpactMinor" >= 0 AND "creditMinor" >= 0);
