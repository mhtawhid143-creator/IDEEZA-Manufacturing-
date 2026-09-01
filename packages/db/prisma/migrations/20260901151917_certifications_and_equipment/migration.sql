-- CreateEnum
CREATE TYPE "CertificationStatus" AS ENUM ('pending', 'verified', 'issued_by_ideeza');

-- CreateTable
CREATE TABLE "ShopCertification" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "issuingAuthority" TEXT,
    "status" "CertificationStatus" NOT NULL DEFAULT 'pending',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopEquipment" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopCertification_manufacturerId_position_idx" ON "ShopCertification"("manufacturerId", "position");

-- CreateIndex
CREATE INDEX "ShopEquipment_manufacturerId_position_idx" ON "ShopEquipment"("manufacturerId", "position");

-- AddForeignKey
ALTER TABLE "ShopCertification" ADD CONSTRAINT "ShopCertification_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "ManufacturerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopEquipment" ADD CONSTRAINT "ShopEquipment_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "ManufacturerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
