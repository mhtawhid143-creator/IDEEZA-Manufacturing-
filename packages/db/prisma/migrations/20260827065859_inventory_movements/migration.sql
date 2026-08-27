-- CreateEnum
CREATE TYPE "InventoryMovementKind" AS ENUM ('stock_in', 'stock_out', 'stock_count', 'price_change', 'reserved', 'released');

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "kind" "InventoryMovementKind" NOT NULL,
    "quantityDelta" INTEGER NOT NULL DEFAULT 0,
    "resultingStock" INTEGER NOT NULL,
    "resultingReserved" INTEGER NOT NULL,
    "unitCostMinor" BIGINT,
    "effectiveFrom" TIMESTAMP(3),
    "note" TEXT,
    "orderId" TEXT,
    "actorUserId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryMovement_itemId_occurredAt_idx" ON "InventoryMovement"("itemId", "occurredAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_orderId_idx" ON "InventoryMovement"("orderId");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ManufacturingOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A movement may never be edited: a stock figure somebody could quietly rewrite
-- is not a stock figure. Deleting is a different question — a part added by
-- mistake and never touched has to be removable, and its opening count goes with
-- it — so that is left to the domain, which refuses to delete a part with any
-- history behind it.
CREATE TRIGGER "InventoryMovement_reject_update"
  BEFORE UPDATE ON "InventoryMovement"
  FOR EACH ROW EXECUTE FUNCTION ideeza_reject_row_mutation();

-- What a movement is allowed to say. A count and a price change are the two that
-- do not move stock by a delta; everything else has to.
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "inventory_movement_is_coherent"
  CHECK (
    "resultingStock" >= 0
    AND "resultingReserved" >= 0
    AND ("unitCostMinor" IS NULL OR "unitCostMinor" > 0)
    AND (
      ("kind" = 'price_change' AND "quantityDelta" = 0 AND "unitCostMinor" IS NOT NULL)
      OR ("kind" = 'stock_count')
      OR ("kind" IN ('stock_in', 'reserved', 'released', 'stock_out') AND "quantityDelta" <> 0)
    )
  );
