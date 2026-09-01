-- DropForeignKey
ALTER TABLE "ShopEquipment" DROP CONSTRAINT "ShopEquipment_manufacturerId_fkey";

-- DropTable
DROP TABLE "ShopEquipment";

-- CreateTable
CREATE TABLE "ShopMachine" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "process" TEXT NOT NULL,
    "subProcesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tolerance" TEXT,
    "turnaroundTime" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopMachine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopMachine_manufacturerId_position_idx" ON "ShopMachine"("manufacturerId", "position");

-- AddForeignKey
ALTER TABLE "ShopMachine" ADD CONSTRAINT "ShopMachine_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "ManufacturerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
