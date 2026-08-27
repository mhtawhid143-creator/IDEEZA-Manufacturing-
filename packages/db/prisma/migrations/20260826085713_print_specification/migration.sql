-- CreateEnum
CREATE TYPE "PrintTechnology" AS ENUM ('fdm', 'sla', 'sls', 'mjf', 'cnc_machining');

-- CreateEnum
CREATE TYPE "SurfaceFinish" AS ENUM ('as_printed', 'sanded', 'bead_blasted', 'vapour_smoothed', 'painted');

-- AlterTable
ALTER TABLE "ManufacturingRequirements" ADD COLUMN     "infillPercent" INTEGER,
ADD COLUMN     "printColor" TEXT,
ADD COLUMN     "printMaterial" TEXT,
ADD COLUMN     "printTechnology" "PrintTechnology",
ADD COLUMN     "surfaceFinish" "SurfaceFinish";
