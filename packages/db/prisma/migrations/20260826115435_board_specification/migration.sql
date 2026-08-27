-- CreateEnum
CREATE TYPE "BaseMaterial" AS ENUM ('fr4', 'flex', 'aluminium', 'rogers', 'ptfe_teflon');

-- CreateEnum
CREATE TYPE "BoardColor" AS ENUM ('green', 'black', 'white', 'blue', 'red', 'yellow', 'purple');

-- CreateEnum
CREATE TYPE "SilkscreenColor" AS ENUM ('white', 'black');

-- CreateEnum
CREATE TYPE "BoardSurfaceFinish" AS ENUM ('hasl_leaded', 'hasl_lead_free', 'enig', 'osp', 'immersion_silver', 'hard_gold');

-- CreateEnum
CREATE TYPE "ViaCovering" AS ENUM ('tented', 'untented', 'plugged', 'epoxy_filled_capped', 'copper_paste_filled_capped');

-- CreateEnum
CREATE TYPE "DeliveryFormat" AS ENUM ('single_pcb', 'panel_by_buyer', 'panel_by_manufacturer');

-- CreateEnum
CREATE TYPE "ElectricalTest" AS ENUM ('none', 'sample', 'flying_probe_full', 'fixture_full');

-- CreateEnum
CREATE TYPE "UlMarking" AS ENUM ('none', 'any_position', 'specified_position');

-- CreateEnum
CREATE TYPE "MarkOnBoard" AS ENUM ('none', 'order_number', 'order_number_specified_position', 'datamatrix_serial');

-- CreateEnum
CREATE TYPE "WorkmanshipClass" AS ENUM ('ipc_class_2', 'ipc_class_3');

-- CreateEnum
CREATE TYPE "BoardPackaging" AS ENUM ('manufacturer_standard', 'antistatic_bubble', 'vacuum_esd_bag');

-- CreateEnum
CREATE TYPE "AssembledFace" AS ENUM ('top', 'bottom');

-- CreateEnum
CREATE TYPE "SuppliedBy" AS ENUM ('buyer', 'manufacturer');

-- CreateTable
CREATE TABLE "BoardSpecification" (
    "requirementsId" TEXT NOT NULL,
    "baseMaterial" "BaseMaterial",
    "layerCount" INTEGER,
    "thicknessMm" DECIMAL(3,2),
    "boardColor" "BoardColor",
    "silkscreenColor" "SilkscreenColor",
    "surfaceFinish" "BoardSurfaceFinish",
    "outerCopperOz" DECIMAL(3,1),
    "innerCopperOz" DECIMAL(3,1),
    "viaCovering" "ViaCovering",
    "minViaHoleMm" DECIMAL(3,2),
    "outlineToleranceMm" DECIMAL(3,2),
    "deliveryFormat" "DeliveryFormat",
    "distinctDesigns" INTEGER,
    "electricalTest" "ElectricalTest",
    "goldFingers" BOOLEAN NOT NULL DEFAULT false,
    "castellatedHoles" BOOLEAN NOT NULL DEFAULT false,
    "edgePlating" BOOLEAN NOT NULL DEFAULT false,
    "blindOrBuriedVias" BOOLEAN NOT NULL DEFAULT false,
    "ulMarking" "UlMarking",
    "markOnBoard" "MarkOnBoard",
    "workmanshipClass" "WorkmanshipClass",
    "packaging" "BoardPackaging",
    "assembledFace" "AssembledFace",
    "partsSuppliedBy" "SuppliedBy",
    "toolingHolesAddedBy" "SuppliedBy",
    "conformalCoating" BOOLEAN NOT NULL DEFAULT false,
    "functionalTest" BOOLEAN NOT NULL DEFAULT false,
    "stencilRequired" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardSpecification_pkey" PRIMARY KEY ("requirementsId")
);

-- AddForeignKey
ALTER TABLE "BoardSpecification" ADD CONSTRAINT "BoardSpecification_requirementsId_fkey" FOREIGN KEY ("requirementsId") REFERENCES "ManufacturingRequirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
