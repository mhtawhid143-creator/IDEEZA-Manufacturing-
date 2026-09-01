-- CreateEnum
CREATE TYPE "CapabilityVerification" AS ENUM ('pending', 'verified');

-- AlterTable
ALTER TABLE "ShopCapabilitySheet" ADD COLUMN     "attachmentNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "verification" "CapabilityVerification" NOT NULL DEFAULT 'pending';
