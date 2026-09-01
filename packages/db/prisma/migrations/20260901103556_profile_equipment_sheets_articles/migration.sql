-- CreateEnum
CREATE TYPE "CapabilityKind" AS ENUM ('pcb_fabrication', 'pcb_assembly', 'printing_3d', 'cnc_machining', 'injection_moulding', 'other');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('draft', 'in_review', 'published', 'rejected');

-- CreateTable
CREATE TABLE "ShopEquipment" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopCapabilitySheet" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "kind" "CapabilityKind" NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopCapabilitySheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopCapabilityParameter" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "values" TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShopCapabilityParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopArticle" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "body" TEXT NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'draft',
    "rejectReason" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopEquipment_manufacturerId_position_idx" ON "ShopEquipment"("manufacturerId", "position");

-- CreateIndex
CREATE INDEX "ShopCapabilitySheet_manufacturerId_position_idx" ON "ShopCapabilitySheet"("manufacturerId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ShopCapabilitySheet_manufacturerId_kind_key" ON "ShopCapabilitySheet"("manufacturerId", "kind");

-- CreateIndex
CREATE INDEX "ShopCapabilityParameter_sheetId_position_idx" ON "ShopCapabilityParameter"("sheetId", "position");

-- CreateIndex
CREATE INDEX "ShopArticle_manufacturerId_status_createdAt_idx" ON "ShopArticle"("manufacturerId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "ShopEquipment" ADD CONSTRAINT "ShopEquipment_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "ManufacturerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopCapabilitySheet" ADD CONSTRAINT "ShopCapabilitySheet_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "ManufacturerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopCapabilityParameter" ADD CONSTRAINT "ShopCapabilityParameter_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "ShopCapabilitySheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopArticle" ADD CONSTRAINT "ShopArticle_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "ManufacturerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
