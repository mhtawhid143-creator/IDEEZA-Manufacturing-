-- CreateEnum
CREATE TYPE "ProductAvailability" AS ENUM ('available', 'unavailable');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "availability" "ProductAvailability" NOT NULL DEFAULT 'available';

-- CreateTable
CREATE TABLE "ProductFavorite" (
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFavorite_pkey" PRIMARY KEY ("userId","productId")
);

-- CreateIndex
CREATE INDEX "ProductFavorite_userId_createdAt_idx" ON "ProductFavorite"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductFavorite_productId_idx" ON "ProductFavorite"("productId");

-- CreateIndex
CREATE INDEX "Product_availability_idx" ON "Product"("availability");

-- AddForeignKey
ALTER TABLE "ProductFavorite" ADD CONSTRAINT "ProductFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFavorite" ADD CONSTRAINT "ProductFavorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
