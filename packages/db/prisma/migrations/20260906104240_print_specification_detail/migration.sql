-- CreateEnum
CREATE TYPE "InfillPattern" AS ENUM ('grid', 'lines', 'triangles', 'cubic', 'gyroid', 'honeycomb', 'concentric');

-- CreateEnum
CREATE TYPE "SupportStructure" AS ENUM ('none', 'standard', 'soluble', 'tree', 'manufacturer_choice');

-- CreateTable
CREATE TABLE "PrintSpecification" (
    "requirementsId" TEXT NOT NULL,
    "layerHeightMm" DECIMAL(4,3),
    "infillPattern" "InfillPattern",
    "wallThicknessMm" DECIMAL(4,2),
    "dimensionXMm" DECIMAL(7,2),
    "dimensionYMm" DECIMAL(7,2),
    "dimensionZMm" DECIMAL(7,2),
    "toleranceMm" DECIMAL(4,2),
    "supportStructure" "SupportStructure",
    "orientationRequirement" TEXT,
    "durometer" TEXT,
    "postProcessing" TEXT,
    "certification" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintSpecification_pkey" PRIMARY KEY ("requirementsId")
);

-- AddForeignKey
ALTER TABLE "PrintSpecification" ADD CONSTRAINT "PrintSpecification_requirementsId_fkey" FOREIGN KEY ("requirementsId") REFERENCES "ManufacturingRequirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A measurement is a positive number or it is not an answer. Prisma does not
-- model check constraints, so the guards a printed part's geometry needs are
-- written here by hand — the same way the rest of this schema does it.
ALTER TABLE "PrintSpecification"
  ADD CONSTRAINT "print_spec_measures_are_positive" CHECK (
    ("layerHeightMm" IS NULL OR "layerHeightMm" > 0)
    AND ("wallThicknessMm" IS NULL OR "wallThicknessMm" > 0)
    AND ("dimensionXMm" IS NULL OR "dimensionXMm" > 0)
    AND ("dimensionYMm" IS NULL OR "dimensionYMm" > 0)
    AND ("dimensionZMm" IS NULL OR "dimensionZMm" > 0)
    AND ("toleranceMm" IS NULL OR "toleranceMm" > 0)
  );

-- A bounding box is three axes or it is none: two of them describe nothing a
-- printer can put on a build plate, and a half-answered size reads as a fact.
ALTER TABLE "PrintSpecification"
  ADD CONSTRAINT "print_spec_box_is_whole" CHECK (
    ("dimensionXMm" IS NULL AND "dimensionYMm" IS NULL AND "dimensionZMm" IS NULL)
    OR ("dimensionXMm" IS NOT NULL AND "dimensionYMm" IS NOT NULL AND "dimensionZMm" IS NOT NULL)
  );
