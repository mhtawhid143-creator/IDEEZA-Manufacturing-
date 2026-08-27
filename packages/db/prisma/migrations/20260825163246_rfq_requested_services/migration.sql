-- CreateEnum
CREATE TYPE "AssemblySides" AS ENUM ('single_side', 'double_side');

-- AlterTable
ALTER TABLE "ManufacturingRequirements" ADD COLUMN     "assemblySides" "AssemblySides";

-- AlterTable
ALTER TABLE "Rfq" ADD COLUMN     "requestedServices" TEXT[];
