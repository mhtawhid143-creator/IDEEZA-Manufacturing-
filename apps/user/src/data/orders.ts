import {
  asId,
  printSpecificationRows,
  requirementRows,
  type ManufacturerId,
  type OrderId,
  type OrderStatus,
  type ProductId,
  type RfqId,
  type ShippingChoice,
  type UserId,
} from '@ideeza/domain';
import { database } from '@/lib/db.js';

/** Prisma hands back a Decimal; the document reads plain numbers. */
const decimal = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

export interface OrderSummary {
  readonly orderId: OrderId;
  readonly rfqId: RfqId;
  readonly productId: ProductId;
  readonly productName: string;
  readonly manufacturerId: ManufacturerId;
  readonly manufacturerName: string;
  readonly status: OrderStatus;
  readonly quantity: number;
  readonly currency: string;
  readonly totalPriceMinor: bigint;
  readonly leadTimeDays: number;
  readonly createdAt: Date;
  readonly confirmedAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly completedAt: Date | null;
  /** What the request carried, for the "Show files" and "Type included" cells. */
  readonly fileCount: number;
  readonly packageKind: string;
  readonly requestedServices: readonly string[];
  /** A shortage the manufacturer is waiting on an answer for. */
  readonly openAlertCount: number;
}

export interface OrderDetail extends OrderSummary {
  readonly unitPriceMinor: bigint;
  readonly shippingEstimateMinor: bigint | null;
  readonly toolingSetupCostMinor: bigint | null;
  readonly checksum: string;
  readonly capturedAt: Date;
  readonly approvedSubstitutionIds: readonly string[];
  readonly shippingChoice: ShippingChoice;
  readonly manufacturerCity: string;
  readonly manufacturerCountry: string;
  readonly manufacturerRating: number | null;
  readonly shippingRequirement: string;
  readonly specRows: readonly { readonly label: string; readonly value: string }[];
  readonly printSpecRows: readonly { readonly label: string; readonly value: string }[];
  readonly paymentStatus: string | null;
  readonly paidMinor: number | null;
  readonly reviewWindowEndsAt: Date | null;
  readonly materialProcessNotes: string;
  readonly warrantyTerms: string | null;
  readonly terms: string;
  readonly deliveryAddress: {
    readonly line1: string;
    readonly line2: string | null;
    readonly city: string;
    readonly region: string | null;
    readonly postalCode: string | null;
    readonly countryCode: string;
  };
}

const orderInclude = {
  manufacturer: {
    select: { displayName: true, city: true, countryCode: true, rating: true },
  },
  snapshot: true,
  payment: { select: { status: true, totalChargedMinor: true } },
  _count: { select: { alerts: { where: { status: 'open' as const } } } },
  rfq: {
    select: {
      id: true,
      requestedServices: true,
      requirements: {
        // Everything `requirementRows` reads: the order shows the boundary the
        // quote was priced against, in the words the whole platform uses for it.
        select: {
          quantity: true,
          material: true,
          manufacturingMethod: true,
          tolerance: true,
          leadTimeDays: true,
          assembly: true,
          assemblySides: true,
          qualityCheckRequirement: true,
          shippingRequirement: true,
          substitutionPolicy: true,
          notes: true,
          printTechnology: true,
          printMaterial: true,
          printColor: true,
          surfaceFinish: true,
          infillPercent: true,
          printSpec: true,
        },
      },
      package: {
        select: {
          kind: true,
          product: { select: { id: true, name: true } },
          _count: { select: { files: true } },
        },
      },
    },
  },
} as const;

/** An order the buyer owns, with the accepted terms it was opened against. */
export const getOrder = async (
  buyerId: UserId,
  orderId: OrderId,
): Promise<OrderDetail | null> => {
  const row = await database().manufacturingOrder.findFirst({
    where: { id: orderId, buyerId },
    include: orderInclude,
  });
  if (row === null || row.snapshot === null) return null;

  return {
    orderId: asId<OrderId>(row.id),
    rfqId: asId<RfqId>(row.rfqId),
    productId: asId<ProductId>(row.rfq.package.product.id),
    productName: row.rfq.package.product.name,
    manufacturerId: asId<ManufacturerId>(row.manufacturerId),
    manufacturerName: row.manufacturer.displayName,
    status: row.status,
    quantity: row.snapshot.quantity,
    currency: row.snapshot.currency,
    unitPriceMinor: row.snapshot.unitPriceMinor,
    totalPriceMinor: row.snapshot.totalPriceMinor,
    shippingEstimateMinor: row.snapshot.shippingEstimateMinor,
    toolingSetupCostMinor: row.snapshot.toolingSetupCostMinor,
    leadTimeDays: row.snapshot.leadTimeDays,
    checksum: row.snapshot.checksum,
    capturedAt: row.snapshot.capturedAt,
    approvedSubstitutionIds: row.snapshot.approvedSubstitutionIds,
    shippingChoice: row.shippingChoice,
    manufacturerCity: row.manufacturer.city,
    manufacturerCountry: row.manufacturer.countryCode,
    manufacturerRating: row.manufacturer.rating === null ? null : Number(row.manufacturer.rating),
    shippingRequirement: row.rfq.requirements.shippingRequirement,
    specRows: requirementRows({
      quantity: row.rfq.requirements.quantity,
      material: row.rfq.requirements.material,
      manufacturingMethod: row.rfq.requirements.manufacturingMethod,
      tolerance: row.rfq.requirements.tolerance,
      leadTimeDays: row.rfq.requirements.leadTimeDays,
      shippingRequirement: row.rfq.requirements.shippingRequirement,
      assembly: row.rfq.requirements.assembly,
      assemblySides: row.rfq.requirements.assemblySides,
      qualityCheckRequirement: row.rfq.requirements.qualityCheckRequirement,
      substitutionPolicy: row.rfq.requirements.substitutionPolicy,
      notes: row.rfq.requirements.notes,
      printTechnology: row.rfq.requirements.printTechnology,
      printMaterial: row.rfq.requirements.printMaterial,
      printColor: row.rfq.requirements.printColor,
      surfaceFinish: row.rfq.requirements.surfaceFinish,
      infillPercent: row.rfq.requirements.infillPercent,
    }),
    // The printed part's own document (UIUX-153): the brief above stays a
    // brief, and the depth a printer prices on is read as its peer.
    printSpecRows:
      row.rfq.requirements.printTechnology === null
        ? []
        : printSpecificationRows({
            technology: row.rfq.requirements.printTechnology,
            material: row.rfq.requirements.printMaterial,
            color: row.rfq.requirements.printColor,
            surfaceFinish: row.rfq.requirements.surfaceFinish,
            infillPercent: row.rfq.requirements.infillPercent,
            layerHeightMm: decimal(row.rfq.requirements.printSpec?.layerHeightMm),
            infillPattern: row.rfq.requirements.printSpec?.infillPattern ?? null,
            wallThicknessMm: decimal(row.rfq.requirements.printSpec?.wallThicknessMm),
            dimensionXMm: decimal(row.rfq.requirements.printSpec?.dimensionXMm),
            dimensionYMm: decimal(row.rfq.requirements.printSpec?.dimensionYMm),
            dimensionZMm: decimal(row.rfq.requirements.printSpec?.dimensionZMm),
            toleranceMm: decimal(row.rfq.requirements.printSpec?.toleranceMm),
            supportStructure: row.rfq.requirements.printSpec?.supportStructure ?? null,
            orientationRequirement: row.rfq.requirements.printSpec?.orientationRequirement ?? null,
            durometer: row.rfq.requirements.printSpec?.durometer ?? null,
            postProcessing: row.rfq.requirements.printSpec?.postProcessing ?? null,
            certification: row.rfq.requirements.printSpec?.certification ?? null,
          }),
    paymentStatus: row.payment?.status ?? null,
    paidMinor: row.payment === null ? null : Number(row.payment.totalChargedMinor),
    reviewWindowEndsAt: row.reviewWindowEndsAt,
    materialProcessNotes: row.snapshot.materialProcessNotes,
    warrantyTerms: row.snapshot.warrantyTerms,
    terms: row.snapshot.terms,
    createdAt: row.createdAt,
    confirmedAt: row.confirmedAt,
    deliveredAt: row.deliveredAt,
    completedAt: row.completedAt,
    fileCount: row.rfq.package._count.files,
    packageKind: row.rfq.package.kind,
    requestedServices: row.rfq.requestedServices,
    openAlertCount: row._count.alerts,
    deliveryAddress: {
      line1: row.shipToLine1,
      line2: row.shipToLine2,
      city: row.shipToCity,
      region: row.shipToRegion,
      postalCode: row.shipToPostalCode,
      countryCode: row.shipToCountryCode,
    },
  };
};

/** Orders still being worked on, for the Active Orders tab. */
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = Object.freeze([
  'awaiting_payment',
  'confirmed',
  'in_production',
  'quality_check',
  'ready_to_ship',
  'shipped',
  'delivered',
  'cancel_requested',
  'refund_requested',
  'disputed',
]);

/** Orders that are finished, for the Order History tab. */
export const CLOSED_ORDER_STATUSES: readonly OrderStatus[] = Object.freeze([
  'completed',
  'cancelled',
  'refunded',
  'partially_refunded',
  'resolved',
]);

const toSummary = (row: {
  readonly id: string;
  readonly rfqId: string;
  readonly manufacturerId: string;
  readonly status: OrderStatus;
  readonly createdAt: Date;
  readonly confirmedAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly completedAt: Date | null;
  readonly manufacturer: { readonly displayName: string };
  readonly snapshot: {
    readonly quantity: number;
    readonly currency: string;
    readonly totalPriceMinor: bigint;
    readonly leadTimeDays: number;
  } | null;
  readonly _count: { readonly alerts: number };
  readonly rfq: {
    readonly requestedServices: readonly string[];
    readonly package: {
      readonly kind: string;
      readonly product: { readonly id: string; readonly name: string };
      readonly _count: { readonly files: number };
    };
  };
}): OrderSummary => ({
  orderId: asId<OrderId>(row.id),
  rfqId: asId<RfqId>(row.rfqId),
  productId: asId<ProductId>(row.rfq.package.product.id),
  productName: row.rfq.package.product.name,
  manufacturerId: asId<ManufacturerId>(row.manufacturerId),
  manufacturerName: row.manufacturer.displayName,
  status: row.status,
  quantity: row.snapshot?.quantity ?? 0,
  currency: row.snapshot?.currency ?? 'USD',
  totalPriceMinor: row.snapshot?.totalPriceMinor ?? 0n,
  leadTimeDays: row.snapshot?.leadTimeDays ?? 0,
  createdAt: row.createdAt,
  confirmedAt: row.confirmedAt,
  deliveredAt: row.deliveredAt,
  completedAt: row.completedAt,
  fileCount: row.rfq.package._count.files,
  packageKind: row.rfq.package.kind,
  requestedServices: row.rfq.requestedServices,
  openAlertCount: row._count.alerts,
});

export const listOrders = async (
  buyerId: UserId,
  statuses: readonly OrderStatus[],
): Promise<readonly OrderSummary[]> => {
  const rows = await database().manufacturingOrder.findMany({
    where: { buyerId, status: { in: [...statuses] } },
    include: orderInclude,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => toSummary(row));
};
