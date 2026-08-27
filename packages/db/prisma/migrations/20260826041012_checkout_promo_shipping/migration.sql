-- CreateEnum
CREATE TYPE "ShippingChoice" AS ENUM ('standard', 'express');

-- AlterTable
ALTER TABLE "ManufacturingOrder" ADD COLUMN     "shippingChoice" "ShippingChoice" NOT NULL DEFAULT 'standard';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "discountAmountMinor" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "promoCodeId" TEXT;

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "percentOff" INTEGER,
    "amountOffMinor" BIGINT,
    "currency" CHAR(3),
    "minimumSpendMinor" BIGINT,
    "maxRedemptions" INTEGER,
    "redeemedCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "PromoCode_active_expiresAt_idx" ON "PromoCode"("active", "expiresAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
