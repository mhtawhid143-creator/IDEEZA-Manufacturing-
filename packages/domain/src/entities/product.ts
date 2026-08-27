import type {
  FileId,
  IsoTimestamp,
  PackageId,
  ProductId,
  RequirementsId,
  UserId,
} from '../ids.js';
import type { ProductAvailability } from '../status/product.js';

/** An immutable pointer to a stored file revision. */
export interface FileRef {
  readonly id: FileId;
  readonly name: string;
  readonly revision: number;
  readonly contentHash: string;
  readonly byteSize: number;
  readonly uploadedAt: IsoTimestamp;
}

/** One line of a bill of materials. */
export interface BomLine {
  readonly reference: string;
  readonly componentName: string;
  readonly manufacturerPartNumber?: string | undefined;
  readonly sku?: string | undefined;
  readonly footprint?: string | undefined;
  readonly quantityPerUnit: number;
}

export interface Product {
  readonly id: ProductId;
  readonly ownerId: UserId;
  readonly name: string;
  /** Whether the creator still lets this product be sent to manufacture. */
  readonly availability: ProductAvailability;
  readonly files: readonly FileRef[];
  readonly bom: readonly BomLine[];
  readonly createdAt: IsoTimestamp;
}

export const PACKAGE_KINDS = ['pcb', 'module_3d', 'full_product'] as const;
export type PackageKind = (typeof PACKAGE_KINDS)[number];

/** What the buyer is asking to have built. */
export interface ManufacturingPackage {
  readonly id: PackageId;
  readonly productId: ProductId;
  readonly kind: PackageKind;
  readonly includedFiles: readonly FileRef[];
  readonly includedBom: readonly BomLine[];
}

export const ASSEMBLY_MODES = ['none', 'smt', 'through_hole', 'mixed'] as const;
export type AssemblyMode = (typeof ASSEMBLY_MODES)[number];

/**
 * The structured production requirements that replace any generic free-text
 * work boundary. Every field here is part of the documented order record and is
 * therefore admissible when a dispute is decided.
 */
export interface ManufacturingRequirements {
  readonly id: RequirementsId;
  readonly packageId: PackageId;
  readonly files: readonly FileRef[];
  readonly bom: readonly BomLine[];
  readonly quantity: number;
  readonly material: string;
  readonly manufacturingMethod: string;
  readonly tolerance: string;
  readonly leadTimeDays: number;
  readonly shippingRequirement: string;
  readonly assembly: AssemblyMode;
  readonly qualityCheckRequirement: string;
  readonly substitutionPolicy: 'not_allowed' | 'with_approval' | 'manufacturer_discretion';
  readonly notes?: string | undefined;
  readonly lockedAt?: IsoTimestamp | undefined;
}
