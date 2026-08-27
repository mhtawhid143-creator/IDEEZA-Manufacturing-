import {
  applyTransition,
  assertAssemblyFitsComposition,
  assertCompositionIsMakeable,
  assertDraftEditable,
  assertPackageIncludesFiles,
  assertPrintSpecComplete,
  assertQuantityIsProducible,
  asId,
  packageKindForFiles,
  rfqMachine,
  type AssemblyMode,
  type AssemblySides,
  type FileId,
  type PackageKind,
  type PrintTechnology,
  type ProductId,
  type RfqId,
  type RfqStatus,
  type SurfaceFinish,
  type UserId,
} from '@ideeza/domain';
import { toDatabaseEventKind } from '@ideeza/db';
import type { SaveDraftInput } from '@ideeza/types';
import { database } from '@/lib/db.js';

/**
 * The quoting currency of a request.
 *
 * One currency for now: every seeded manufacturer quotes in it, and a currency
 * choice belongs with the pricing work rather than with the draft.
 */
export const DRAFT_CURRENCY = 'USD';

export interface DraftListItem {
  readonly rfqId: RfqId;
  readonly productId: ProductId;
  readonly productName: string;
  readonly creatorName: string;
  readonly kind: PackageKind;
  readonly quantity: number;
  readonly leadTimeDays: number;
  readonly fileCount: number;
  readonly createdAt: Date;
}

export interface DraftDetail extends DraftListItem {
  readonly status: RfqStatus;
  readonly material: string;
  readonly manufacturingMethod: string;
  readonly tolerance: string;
  readonly shippingRequirement: string;
  readonly assembly: AssemblyMode;
  readonly assemblySides: AssemblySides | null;
  readonly qualityCheckRequirement: string;
  readonly substitutionPolicy: 'not_allowed' | 'with_approval' | 'manufacturer_discretion';
  readonly notes: string | null;
  readonly printTechnology: PrintTechnology | null;
  readonly printMaterial: string | null;
  readonly printColor: string | null;
  readonly surfaceFinish: SurfaceFinish | null;
  readonly infillPercent: number | null;
  readonly includedFileIds: readonly string[];
  readonly includedBomLineIds: readonly string[];
  /** The bill of materials this draft carries, line by line. */
  readonly bomLines: readonly {
    readonly reference: string;
    readonly componentName: string;
    readonly sku: string | null;
    readonly quantityRequired: number;
  }[];
  /** The files themselves, for the "show files" list. */
  readonly files: readonly {
    readonly id: string;
    readonly name: string;
    readonly revision: number;
  }[];
  readonly deliveryAddress: {
    readonly line1: string;
    readonly line2: string | null;
    readonly city: string;
    readonly region: string | null;
    readonly postalCode: string | null;
    readonly countryCode: string;
  };
}

const draftInclude = {
  package: {
    include: {
      product: { include: { owner: { select: { displayName: true } } } },
      files: { include: { file: { select: { id: true, name: true, revision: true } } } },
      bomLines: {
        select: {
          bomLineId: true,
          // What each line actually is, so the manufacturer list can be read
          // against what each shop holds in stock.
          bomLine: {
            select: {
              reference: true,
              componentName: true,
              sku: true,
              quantityPerUnit: true,
            },
          },
        },
      },
    },
  },
  requirements: true,
} as const;

type DraftRow = {
  readonly id: string;
  readonly status: RfqStatus;
  readonly quantity: number;
  readonly createdAt: Date;
  readonly shipToLine1: string;
  readonly shipToLine2: string | null;
  readonly shipToCity: string;
  readonly shipToRegion: string | null;
  readonly shipToPostalCode: string | null;
  readonly shipToCountryCode: string;
  readonly package: {
    readonly kind: PackageKind;
    readonly productId: string;
    readonly product: { readonly name: string; readonly owner: { readonly displayName: string } };
    readonly files: readonly {
      readonly fileId: string;
      readonly file: { readonly id: string; readonly name: string; readonly revision: number };
    }[];
    readonly bomLines: readonly {
      readonly bomLineId: string;
      readonly bomLine: {
        readonly reference: string;
        readonly componentName: string;
        readonly sku: string | null;
        readonly quantityPerUnit: number;
      };
    }[];
  };
  readonly requirements: {
    readonly material: string;
    readonly manufacturingMethod: string;
    readonly tolerance: string;
    readonly leadTimeDays: number;
    readonly shippingRequirement: string;
    readonly assembly: AssemblyMode;
    readonly assemblySides: AssemblySides | null;
    readonly qualityCheckRequirement: string;
    readonly substitutionPolicy: 'not_allowed' | 'with_approval' | 'manufacturer_discretion';
    readonly notes: string | null;
    readonly printTechnology: PrintTechnology | null;
    readonly printMaterial: string | null;
    readonly printColor: string | null;
    readonly surfaceFinish: SurfaceFinish | null;
    readonly infillPercent: number | null;
  };
};

const toDetail = (row: DraftRow): DraftDetail => ({
  rfqId: asId<RfqId>(row.id),
  status: row.status,
  productId: asId<ProductId>(row.package.productId),
  productName: row.package.product.name,
  creatorName: row.package.product.owner.displayName,
  kind: row.package.kind,
  quantity: row.quantity,
  leadTimeDays: row.requirements.leadTimeDays,
  fileCount: row.package.files.length,
  createdAt: row.createdAt,
  material: row.requirements.material,
  manufacturingMethod: row.requirements.manufacturingMethod,
  tolerance: row.requirements.tolerance,
  shippingRequirement: row.requirements.shippingRequirement,
  assembly: row.requirements.assembly,
  assemblySides: row.requirements.assemblySides,
  qualityCheckRequirement: row.requirements.qualityCheckRequirement,
  substitutionPolicy: row.requirements.substitutionPolicy,
  notes: row.requirements.notes,
  printTechnology: row.requirements.printTechnology,
  printMaterial: row.requirements.printMaterial,
  printColor: row.requirements.printColor,
  surfaceFinish: row.requirements.surfaceFinish,
  infillPercent: row.requirements.infillPercent,
  includedFileIds: row.package.files.map((link) => link.fileId),
  includedBomLineIds: row.package.bomLines.map((link) => link.bomLineId),
  bomLines: row.package.bomLines.map((link) => ({
    reference: link.bomLine.reference,
    componentName: link.bomLine.componentName,
    sku: link.bomLine.sku,
    quantityRequired: link.bomLine.quantityPerUnit,
  })),
  files: row.package.files.map((link) => ({
    id: link.file.id,
    name: link.file.name,
    revision: link.file.revision,
  })),
  deliveryAddress: {
    line1: row.shipToLine1,
    line2: row.shipToLine2,
    city: row.shipToCity,
    region: row.shipToRegion,
    postalCode: row.shipToPostalCode,
    countryCode: row.shipToCountryCode,
  },
});

/** The Draft tab: requests the buyer has started but not sent. */
export const listDrafts = async (buyerId: UserId): Promise<readonly DraftDetail[]> => {
  const rows = await database().rfq.findMany({
    where: { buyerId, status: 'draft' },
    include: draftInclude,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => toDetail(row as DraftRow));
};

/** One draft, for the form that edits it. */
export const getDraft = async (
  buyerId: UserId,
  rfqId: RfqId,
): Promise<DraftDetail | null> => {
  const row = await database().rfq.findFirst({
    where: { id: rfqId, buyerId },
    include: draftInclude,
  });
  return row === null ? null : toDetail(row as DraftRow);
};

/** The buyer's saved address, which the draft form starts from. */
export const defaultDeliveryAddress = async (
  buyerId: UserId,
): Promise<DraftDetail['deliveryAddress'] | null> => {
  const address = await database().postalAddress.findFirst({
    where: { ownerId: buyerId },
    orderBy: { createdAt: 'asc' },
  });
  return address === null
    ? null
    : {
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        region: address.region,
        postalCode: address.postalCode,
        countryCode: address.countryCode,
      };
};

/**
 * The names of the chosen files.
 *
 * The kind of work in a package is read from its files, so this is the one thing
 * that has to be looked up before a draft is written.
 */
const fileNamesOf = async (fileIds: readonly string[]): Promise<readonly string[]> => {
  const files = await database().fileRef.findMany({
    where: { id: { in: [...fileIds] } },
    select: { name: true },
  });
  return files.map((file) => file.name);
};

const identifier = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const requirementsData = (input: SaveDraftInput) => ({
  printTechnology: input.printTechnology ?? null,
  printMaterial: input.printMaterial ?? null,
  printColor: input.printColor ?? null,
  surfaceFinish: input.surfaceFinish ?? null,
  infillPercent: input.infillPercent ?? null,
  quantity: input.quantity,
  material: input.material,
  manufacturingMethod: input.manufacturingMethod,
  tolerance: input.tolerance,
  leadTimeDays: input.leadTimeDays,
  shippingRequirement: input.shippingRequirement,
  assembly: input.assembly,
  qualityCheckRequirement: input.qualityCheckRequirement,
  substitutionPolicy: input.substitutionPolicy,
  notes: input.notes ?? null,
});

const shipToData = (input: SaveDraftInput) => ({
  shipToLine1: input.deliveryAddress.line1,
  shipToLine2: input.deliveryAddress.line2 ?? null,
  shipToCity: input.deliveryAddress.city,
  shipToRegion: input.deliveryAddress.region ?? null,
  shipToPostalCode: input.deliveryAddress.postalCode ?? null,
  shipToCountryCode: input.deliveryAddress.countryCode,
});

/**
 * Opens a draft request: the package that says what to build, the requirements
 * that say how, and the request row that owns them both.
 *
 * The request is created in the state the lifecycle starts in, and nothing is
 * routed anywhere until it is sent.
 */
export const createDraft = async (
  buyerId: UserId,
  input: SaveDraftInput,
): Promise<RfqId> => {
  assertPackageIncludesFiles(input.includedFileIds.map((id) => asId<FileId>(id)));
  assertQuantityIsProducible(input.quantity);

  // What is being made is decided by the files that were chosen, so the names
  // are read before anything is written.
  const fileNames = await fileNamesOf(input.includedFileIds);
  assertCompositionIsMakeable(fileNames);
  assertAssemblyFitsComposition(fileNames, input.assembly);
  assertPrintSpecComplete(fileNames, {
    printTechnology: input.printTechnology,
    printMaterial: input.printMaterial,
    printColor: input.printColor,
    infillPercent: input.infillPercent,
  });
  const derivedKind = packageKindForFiles(fileNames);

  const packageId = identifier('pkg');
  const requirementsId = identifier('req');
  const rfqId = identifier('rfq');

  await database().$transaction(async (transaction) => {
    await transaction.manufacturingPackage.create({
      data: {
        id: packageId,
        productId: input.productId,
        kind: derivedKind,
        files: { create: input.includedFileIds.map((fileId) => ({ fileId })) },
        bomLines: {
          create: input.includedBomLineIds.map((bomLineId) => ({ bomLineId })),
        },
      },
    });

    await transaction.manufacturingRequirements.create({
      data: { id: requirementsId, packageId, version: 1, ...requirementsData(input) },
    });

    await transaction.rfq.create({
      data: {
        id: rfqId,
        buyerId,
        packageId,
        requirementsId,
        status: rfqMachine.initial,
        quantity: input.quantity,
        volumeTiers: [],
        currency: DRAFT_CURRENCY,
        ...shipToData(input),
      },
    });
  });

  return asId<RfqId>(rfqId);
};

/** Saves changes to a draft. Only a draft may be changed. */
export const updateDraft = async (
  buyerId: UserId,
  rfqId: RfqId,
  input: SaveDraftInput,
): Promise<void> => {
  assertPackageIncludesFiles(input.includedFileIds.map((id) => asId<FileId>(id)));
  assertQuantityIsProducible(input.quantity);

  // What is being made is decided by the files that were chosen, so the names
  // are read before anything is written.
  const fileNames = await fileNamesOf(input.includedFileIds);
  assertCompositionIsMakeable(fileNames);
  assertAssemblyFitsComposition(fileNames, input.assembly);
  assertPrintSpecComplete(fileNames, {
    printTechnology: input.printTechnology,
    printMaterial: input.printMaterial,
    printColor: input.printColor,
    infillPercent: input.infillPercent,
  });
  const derivedKind = packageKindForFiles(fileNames);

  const existing = await database().rfq.findFirst({
    where: { id: rfqId, buyerId },
    select: { id: true, status: true, packageId: true, requirementsId: true },
  });
  if (existing === null) throw new Error('That draft does not exist.');
  assertDraftEditable(rfqId, existing.status);

  await database().$transaction(async (transaction) => {
    await transaction.manufacturingPackage.update({
      where: { id: existing.packageId },
      data: { kind: derivedKind },
    });
    await transaction.packageFile.deleteMany({ where: { packageId: existing.packageId } });
    await transaction.packageFile.createMany({
      data: input.includedFileIds.map((fileId) => ({
        packageId: existing.packageId,
        fileId,
      })),
    });
    await transaction.packageBomLine.deleteMany({
      where: { packageId: existing.packageId },
    });
    if (input.includedBomLineIds.length > 0) {
      await transaction.packageBomLine.createMany({
        data: input.includedBomLineIds.map((bomLineId) => ({
          packageId: existing.packageId,
          bomLineId,
        })),
      });
    }
    await transaction.manufacturingRequirements.update({
      where: { id: existing.requirementsId },
      data: requirementsData(input),
    });
    await transaction.rfq.update({
      where: { id: rfqId },
      data: { quantity: input.quantity, ...shipToData(input) },
    });
  });
};

/**
 * Drops a draft.
 *
 * The row is not deleted: withdrawing is a lifecycle state, and the append-only
 * event log keeps the fact that the buyer started and abandoned a request.
 */
export const withdrawDraft = async (buyerId: UserId, rfqId: RfqId): Promise<void> => {
  const existing = await database().rfq.findFirst({
    where: { id: rfqId, buyerId },
    select: { id: true, status: true },
  });
  if (existing === null) throw new Error('That draft does not exist.');

  const next = applyTransition(rfqMachine, existing.status, 'withdrawn', undefined);

  await database().$transaction(async (transaction) => {
    await transaction.rfq.update({
      where: { id: rfqId },
      data: { status: next, closedAt: new Date() },
    });
    await transaction.domainEvent.create({
      data: {
        id: identifier('evt'),
        kind: toDatabaseEventKind('rfq.withdrawn'),
        actorRole: 'buyer',
        actorUserId: buyerId,
        subjectKind: 'rfq',
        subjectId: rfqId,
        payload: { from: existing.status },
      },
    });
  });
};

/**
 * Opens a fresh draft from an order that already ran.
 *
 * "Re-order" is not a copy of the order: an order is a frozen agreement with one
 * manufacturer at one price. What can honestly be repeated is the *request* — the
 * same package, files, bill of materials, requirements and destination — so this
 * builds that draft and leaves the buyer at the same place a first draft starts,
 * free to change anything before sending it out for new quotes.
 */
export const createDraftFromOrder = async (
  buyerId: UserId,
  orderId: string,
): Promise<{ readonly rfqId: RfqId; readonly productId: string }> => {
  const order = await database().manufacturingOrder.findFirst({
    where: { id: orderId, buyerId },
    include: {
      rfq: {
        select: {
          quantity: true,
          shipToLine1: true,
          shipToLine2: true,
          shipToCity: true,
          shipToRegion: true,
          shipToPostalCode: true,
          shipToCountryCode: true,
          requirements: true,
          package: {
            select: {
              kind: true,
              productId: true,
              files: { select: { fileId: true } },
              bomLines: { select: { bomLineId: true } },
            },
          },
        },
      },
    },
  });
  if (order === null) throw new Error('That order does not exist.');

  const source = order.rfq;
  const requirements = source.requirements;

  const rfqId = await createDraft(buyerId, {
    productId: source.package.productId,
    kind: source.package.kind,
    includedFileIds: source.package.files.map((file) => file.fileId),
    includedBomLineIds: source.package.bomLines.map((line) => line.bomLineId),
    quantity: source.quantity,
    material: requirements.material,
    manufacturingMethod: requirements.manufacturingMethod,
    tolerance: requirements.tolerance,
    leadTimeDays: requirements.leadTimeDays,
    shippingRequirement: requirements.shippingRequirement,
    assembly: requirements.assembly,
    qualityCheckRequirement: requirements.qualityCheckRequirement,
    substitutionPolicy: requirements.substitutionPolicy,
    ...(requirements.notes === null ? {} : { notes: requirements.notes }),
    deliveryAddress: {
      line1: source.shipToLine1,
      ...(source.shipToLine2 === null ? {} : { line2: source.shipToLine2 }),
      city: source.shipToCity,
      ...(source.shipToRegion === null ? {} : { region: source.shipToRegion }),
      ...(source.shipToPostalCode === null ? {} : { postalCode: source.shipToPostalCode }),
      countryCode: source.shipToCountryCode,
    },
  });

  return { rfqId, productId: source.package.productId };
};
