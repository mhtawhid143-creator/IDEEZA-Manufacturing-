import {
  applyTransition,
  assertDiscountWithinGoods,
  assertMethodSupported,
  assertOrderIsPayable,
  assertOrderMayBeConfirmed,
  asId,
  CANONICAL_STAGES,
  checkoutTotalMinor,
  DEFAULT_STAGE_TASK_TEMPLATES,
  orderMachine,
  readPromoCode,
  requirementRows,
  serviceLabels,
  type OrderId,
  type PackageKind,
  type PaymentMethodKind,
  type PromoRefusal,
  type ShippingChoice,
  type UserId,
} from '@ideeza/domain';
import { toDatabaseEventKind } from '@ideeza/db';

/** The print rows apply only to a package with a printed part in it. */
const PRINTS: Readonly<Record<PackageKind, boolean>> = {
  pcb: false,
  module_3d: true,
  full_product: true,
};
import type { PayOrderInput } from '@ideeza/types';
import { database } from '@/lib/db.js';

/**
 * What shipping costs, per choice.
 *
 * The accepted quote prices the goods and, when the manufacturer quoted it,
 * shipping. Express is the buyer's own upgrade on top of that, priced as a
 * platform rate rather than pretending the manufacturer quoted it.
 */
export const EXPRESS_SURCHARGE_MINOR = 4_500;

/** The platform's fee on a manufacturing order, in basis points of the goods. */
export const PLATFORM_FEE_BASIS_POINTS = 300;

export interface CheckoutLineView {
  readonly label: string;
  readonly amountMinor: number;
  readonly note?: string | undefined;
}

export interface CheckoutView {
  readonly orderId: OrderId;
  readonly rfqId: string;
  readonly productId: string;
  readonly productName: string;
  readonly manufacturerName: string;
  readonly manufacturerCity: string;
  readonly manufacturerCountry: string;
  readonly status: string;
  readonly currency: string;
  readonly quantity: number;
  readonly leadTimeDays: number;
  readonly packageKind: string;
  /** The scope the accepted quote froze: what is included, and to what spec. */
  readonly includedServices: readonly string[];
  readonly specRows: readonly { readonly label: string; readonly value: string }[];
  readonly items: readonly {
    readonly name: string;
    readonly detail: string;
    readonly quantityNote: string;
  }[];
  readonly shippingChoice: ShippingChoice;
  readonly goodsMinor: number;
  readonly quotedShippingMinor: number;
  readonly toolingMinor: number;
  readonly shippingMinor: number;
  readonly platformFeeMinor: number;
  readonly taxMinor: number;
  readonly discountMinor: number;
  readonly totalMinor: number;
  readonly promoCode: string | null;
  readonly promoDescription: string | null;
  readonly deliveryAddress: {
    readonly line1: string;
    readonly line2: string | null;
    readonly city: string;
    readonly region: string | null;
    readonly postalCode: string | null;
    readonly countryCode: string;
  };
  readonly savedAddresses: readonly {
    readonly id: string;
    readonly label: string | null;
    readonly line1: string;
    readonly city: string;
    readonly countryCode: string;
  }[];
  readonly payment: {
    readonly id: string;
    readonly status: string;
    readonly method: PaymentMethodKind;
    readonly totalChargedMinor: number;
    readonly securedAt: Date | null;
    readonly failureReason: string | null;
  } | null;
}

const orderInclude = {
  manufacturer: { select: { displayName: true, city: true, countryCode: true } },
  snapshot: true,
  payment: true,
  rfq: {
    select: {
      id: true,
      requestedServices: true,
      package: {
        select: { kind: true, product: { select: { id: true, name: true } } },
      },
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
        },
      },
    },
  },
} as const;

const shippingFor = (
  choice: ShippingChoice,
  quotedShippingMinor: number,
): number => (choice === 'express' ? quotedShippingMinor + EXPRESS_SURCHARGE_MINOR : quotedShippingMinor);

/**
 * Everything the checkout needs, priced.
 *
 * The goods, the lead time and the scope come from the accepted quote's
 * immutable snapshot — never from the request, which the buyer could otherwise
 * appear to change after acceptance.
 */
export const getCheckout = async (
  buyerId: UserId,
  orderId: OrderId,
  options: {
    readonly shippingChoice?: ShippingChoice | undefined;
    readonly promoCode?: string | undefined;
    readonly now?: Date | undefined;
  } = {},
): Promise<CheckoutView | null> => {
  const row = await database().manufacturingOrder.findFirst({
    where: { id: orderId, buyerId },
    include: orderInclude,
  });
  if (row === null || row.snapshot === null) return null;

  const now = options.now ?? new Date();
  const currency = row.snapshot.currency;
  const goodsMinor = Number(row.snapshot.totalPriceMinor);
  const quotedShippingMinor = Number(row.snapshot.shippingEstimateMinor ?? 0n);
  const toolingMinor = Number(row.snapshot.toolingSetupCostMinor ?? 0n);
  const choice = options.shippingChoice ?? row.shippingChoice;
  const shippingMinor = shippingFor(choice, quotedShippingMinor);
  const platformFeeMinor = Math.round((goodsMinor * PLATFORM_FEE_BASIS_POINTS) / 10_000);

  const code = options.promoCode?.trim().toUpperCase();
  const promo =
    code === undefined || code === ''
      ? null
      : await database().promoCode.findUnique({ where: { code } });
  const verdict = readPromoCode(
    promo === null
      ? undefined
      : {
          active: promo.active,
          startsAt: promo.startsAt ?? undefined,
          expiresAt: promo.expiresAt ?? undefined,
          maxRedemptions: promo.maxRedemptions ?? undefined,
          redeemedCount: promo.redeemedCount,
          minimumSpendMinor:
            promo.minimumSpendMinor === null ? undefined : Number(promo.minimumSpendMinor),
          percentOff: promo.percentOff ?? undefined,
          amountOffMinor:
            promo.amountOffMinor === null ? undefined : Number(promo.amountOffMinor),
          currency: promo.currency ?? undefined,
        },
    goodsMinor + toolingMinor,
    currency,
    now,
  );

  const discountMinor = verdict.usable ? verdict.discountMinor : 0;
  const requirements = row.rfq.requirements;

  return {
    orderId: asId<OrderId>(row.id),
    rfqId: row.rfqId,
    productId: row.rfq.package.product.id,
    productName: row.rfq.package.product.name,
    manufacturerName: row.manufacturer.displayName,
    manufacturerCity: row.manufacturer.city,
    manufacturerCountry: row.manufacturer.countryCode,
    status: row.status,
    currency,
    quantity: row.snapshot.quantity,
    leadTimeDays: row.snapshot.leadTimeDays,
    packageKind: row.rfq.package.kind,
    includedServices: serviceLabels(row.rfq.requestedServices),
    specRows: requirementRows(
      {
        quantity: requirements.quantity,
        material: requirements.material,
        manufacturingMethod: requirements.manufacturingMethod,
        tolerance: requirements.tolerance,
        leadTimeDays: requirements.leadTimeDays,
        shippingRequirement: requirements.shippingRequirement,
        assembly: requirements.assembly,
        assemblySides: requirements.assemblySides,
        qualityCheckRequirement: requirements.qualityCheckRequirement,
        substitutionPolicy: requirements.substitutionPolicy,
        notes: requirements.notes,
        printTechnology: requirements.printTechnology,
        printMaterial: requirements.printMaterial,
        printColor: requirements.printColor,
        surfaceFinish: requirements.surfaceFinish,
        infillPercent: requirements.infillPercent,
      },
      { includesPrint: PRINTS[row.rfq.package.kind] },
    ),
    items: [
      {
        name: row.rfq.package.product.name,
        detail: row.snapshot.materialProcessNotes,
        quantityNote: `${row.snapshot.quantity} pcs · as quoted`,
      },
    ],
    shippingChoice: choice,
    goodsMinor,
    quotedShippingMinor,
    toolingMinor,
    shippingMinor,
    platformFeeMinor,
    taxMinor: 0,
    discountMinor,
    totalMinor: checkoutTotalMinor({
      goodsMinor: goodsMinor + toolingMinor,
      shippingMinor,
      taxMinor: 0,
      platformFeeMinor,
      discountMinor,
    }),
    promoCode: verdict.usable && code !== undefined ? code : null,
    promoDescription: verdict.usable ? (promo?.description ?? null) : null,
    deliveryAddress: {
      line1: row.shipToLine1,
      line2: row.shipToLine2,
      city: row.shipToCity,
      region: row.shipToRegion,
      postalCode: row.shipToPostalCode,
      countryCode: row.shipToCountryCode,
    },
    savedAddresses: (
      await database().postalAddress.findMany({
        where: { ownerId: buyerId },
        orderBy: { createdAt: 'asc' },
      })
    ).map((address) => ({
      id: address.id,
      label: address.label,
      line1: address.line1,
      city: address.city,
      countryCode: address.countryCode,
    })),
    payment:
      row.payment === null
        ? null
        : {
            id: row.payment.id,
            status: row.payment.status,
            method: row.payment.method,
            totalChargedMinor: Number(row.payment.totalChargedMinor),
            securedAt: row.payment.securedAt,
            failureReason: row.payment.failureReason,
          },
  };
};

export interface PromoRead {
  readonly usable: boolean;
  readonly refusal?: PromoRefusal | undefined;
  readonly discountMinor: number;
  readonly description: string | null;
}

/** Reads a promotion code against one order, without writing anything. */
export const readPromoForOrder = async (
  buyerId: UserId,
  orderId: OrderId,
  code: string,
  now: Date = new Date(),
): Promise<PromoRead> => {
  const checkout = await getCheckout(buyerId, orderId, { now });
  if (checkout === null) throw new Error('That order does not exist.');

  const normalised = code.trim().toUpperCase();
  const promo = await database().promoCode.findUnique({ where: { code: normalised } });
  const verdict = readPromoCode(
    promo === null
      ? undefined
      : {
          active: promo.active,
          startsAt: promo.startsAt ?? undefined,
          expiresAt: promo.expiresAt ?? undefined,
          maxRedemptions: promo.maxRedemptions ?? undefined,
          redeemedCount: promo.redeemedCount,
          minimumSpendMinor:
            promo.minimumSpendMinor === null ? undefined : Number(promo.minimumSpendMinor),
          percentOff: promo.percentOff ?? undefined,
          amountOffMinor:
            promo.amountOffMinor === null ? undefined : Number(promo.amountOffMinor),
          currency: promo.currency ?? undefined,
        },
    checkout.goodsMinor + checkout.toolingMinor,
    checkout.currency,
    now,
  );

  return {
    usable: verdict.usable,
    refusal: verdict.refusal,
    discountMinor: verdict.discountMinor,
    description: promo?.description ?? null,
  };
};

/** Saves the delivery address the buyer chose or typed at checkout. */
export const setCheckoutAddress = async (
  buyerId: UserId,
  orderId: OrderId,
  address: {
    readonly line1: string;
    readonly line2?: string | undefined;
    readonly city: string;
    readonly region?: string | undefined;
    readonly postalCode?: string | undefined;
    readonly countryCode: string;
  },
  saveForNextTime: boolean,
): Promise<void> => {
  const order = await database().manufacturingOrder.findFirst({
    where: { id: orderId, buyerId },
    select: { id: true, status: true },
  });
  if (order === null) throw new Error('That order does not exist.');
  assertOrderIsPayable(asId<OrderId>(order.id), order.status);

  await database().$transaction(async (transaction) => {
    await transaction.manufacturingOrder.update({
      where: { id: orderId },
      data: {
        shipToLine1: address.line1,
        shipToLine2: address.line2 ?? null,
        shipToCity: address.city,
        shipToRegion: address.region ?? null,
        shipToPostalCode: address.postalCode ?? null,
        shipToCountryCode: address.countryCode.toUpperCase(),
      },
    });

    if (saveForNextTime) {
      await transaction.postalAddress.create({
        data: {
          id: identifier('addr'),
          ownerId: buyerId,
          label: 'Delivery address',
          line1: address.line1,
          line2: address.line2 ?? null,
          city: address.city,
          region: address.region ?? null,
          postalCode: address.postalCode ?? null,
          countryCode: address.countryCode.toUpperCase(),
        },
      });
    }
  });
};

const identifier = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export interface PaymentResult {
  readonly paid: boolean;
  readonly paymentId: string;
  readonly totalChargedMinor: number;
  readonly failureReason?: string | undefined;
}

/**
 * Pays an order, which is what confirms it.
 *
 * The whole point of the platform sits in this transaction: the payment is
 * recorded, the funds are marked as held by IDEEZA, and only then does the
 * order become confirmed and the production stages appear. Every step goes
 * through the domain — the order status through its machine, the confirmation
 * through the funding invariant.
 *
 * No payment provider is connected in this build: the money is not moved, it is
 * recorded as held. The screen says so.
 */
export const payOrder = async (
  buyerId: UserId,
  input: PayOrderInput,
  now: Date = new Date(),
): Promise<PaymentResult> => {
  const orderId = asId<OrderId>(input.orderId);
  assertMethodSupported(input.method);

  const order = await database().manufacturingOrder.findFirst({
    where: { id: orderId, buyerId },
    include: { snapshot: true, payment: true, rfq: { select: { id: true } } },
  });
  if (order === null || order.snapshot === null) {
    throw new Error('That order does not exist.');
  }
  assertOrderIsPayable(orderId, order.status);
  if (order.payment !== null && order.payment.status !== 'initiated') {
    throw new Error('This order already has a payment against it.');
  }

  const checkout = await getCheckout(buyerId, orderId, {
    shippingChoice: input.shippingChoice,
    promoCode: input.promoCode,
    now,
  });
  if (checkout === null) throw new Error('That order does not exist.');

  assertDiscountWithinGoods(
    checkout.discountMinor,
    checkout.goodsMinor + checkout.toolingMinor,
  );

  const promo =
    checkout.promoCode === null
      ? null
      : await database().promoCode.findUnique({ where: { code: checkout.promoCode } });

  // A card that fails its own check never reaches the ledger.
  const cardRefusal =
    input.method === 'card' && input.savedMethodId === undefined
      ? refuseCard(input)
      : undefined;

  const paymentId = identifier('pay');

  if (cardRefusal !== undefined) {
    await database().payment.create({
      data: {
        id: paymentId,
        quoteId: order.acceptedQuoteId,
        buyerId,
        status: 'initiated',
        method: input.method,
        currency: checkout.currency,
        goodsAmountMinor: BigInt(checkout.goodsMinor + checkout.toolingMinor),
        shippingAmountMinor: BigInt(checkout.shippingMinor),
        taxAmountMinor: 0n,
        platformFeeMinor: BigInt(checkout.platformFeeMinor),
        discountAmountMinor: BigInt(checkout.discountMinor),
        promoCodeId: promo?.id ?? null,
        failureReason: cardRefusal,
        totalChargedMinor: BigInt(checkout.totalMinor),
        createdAt: now,
      },
    });
    return {
      paid: false,
      paymentId,
      totalChargedMinor: checkout.totalMinor,
      failureReason: cardRefusal,
    };
  }

  const confirmedStatus = applyTransition(orderMachine, order.status, 'confirmed', {
    paymentStatus: 'secured',
    actorRole: 'buyer',
  });

  await database().$transaction(async (transaction) => {
    await transaction.payment.create({
      data: {
        id: paymentId,
        quoteId: order.acceptedQuoteId,
        buyerId,
        status: 'secured',
        method: input.method,
        currency: checkout.currency,
        goodsAmountMinor: BigInt(checkout.goodsMinor + checkout.toolingMinor),
        shippingAmountMinor: BigInt(checkout.shippingMinor),
        taxAmountMinor: 0n,
        platformFeeMinor: BigInt(checkout.platformFeeMinor),
        discountAmountMinor: BigInt(checkout.discountMinor),
        promoCodeId: promo?.id ?? null,
        totalChargedMinor: BigInt(checkout.totalMinor),
        securedAt: now,
        createdAt: now,
      },
    });

    // The funding invariant, applied to the row that was just written.
    assertOrderMayBeConfirmed({ id: asId(paymentId), status: 'secured' });

    await transaction.manufacturingOrder.update({
      where: { id: orderId },
      data: {
        status: confirmedStatus,
        paymentId,
        shippingChoice: input.shippingChoice,
        confirmedAt: now,
      },
    });

    if (promo !== null) {
      await transaction.promoCode.update({
        where: { id: promo.id },
        data: { redeemedCount: { increment: 1 } },
      });
    }

    // Production can be tracked from here, so the canonical stages appear, each
    // with the shop-floor tasks that stage is made of. The buyer reads the
    // stage; the tasks are what makes the stage's progress legible.
    //
    // Both go in as one statement each: this runs inside the transaction that
    // holds the buyer's money, so it stays short.
    const stageRows = CANONICAL_STAGES.map((stage) => {
      const done = stage.key === 'quote_accepted' || stage.key === 'payment_secured';
      return {
        id: identifier(`stage${stage.position}`),
        orderId,
        key: stage.key,
        position: stage.position,
        status: done ? ('completed' as const) : ('pending' as const),
        startedAt: done ? now : null,
        completedAt: done ? now : null,
      };
    });
    await transaction.productionStage.createMany({ data: stageRows });

    await transaction.productionTask.createMany({
      data: stageRows.flatMap((stage) =>
        (DEFAULT_STAGE_TASK_TEMPLATES[stage.key] ?? []).map((label, position) => ({
          id: identifier(`task${stage.position}x${position}`),
          orderId,
          stageId: stage.id,
          label,
          position,
          status: 'pending' as const,
        })),
      ),
    });

    await transaction.domainEvent.createMany({
      data: (
        [
          ['payment.initiated', 'payment', paymentId],
          ['payment.secured', 'payment', paymentId],
          ['order.confirmed', 'order', orderId],
        ] as const
      ).map(([kind, subjectKind, subjectId]) => ({
        id: identifier(`evt-${kind}`),
        kind: toDatabaseEventKind(kind),
        actorRole: 'buyer' as const,
        actorUserId: buyerId,
        subjectKind,
        subjectId,
        orderId,
        payload: {
          method: input.method,
          totalChargedMinor: checkout.totalMinor,
          currency: checkout.currency,
        },
        occurredAt: now,
      })),
    });
  });

  return { paid: true, paymentId, totalChargedMinor: checkout.totalMinor };
};

/**
 * The card checks a browser cannot do for us.
 *
 * There is no provider to ask, so the platform applies the checks it can: a
 * Luhn-valid number and an expiry in the future. Anything else is refused with
 * a reason the buyer can act on.
 */
const refuseCard = (input: PayOrderInput): string | undefined => {
  const digits = (input.cardNumber ?? '').replace(/\D/g, '');
  if (digits.length < 12) return 'That card number is too short.';

  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  if (sum % 10 !== 0) return 'That card number did not pass its checksum.';

  const expiry = input.cardExpiry ?? '';
  const [monthText, yearText] = expiry.split('/');
  const month = Number(monthText);
  const year = 2000 + Number(yearText);
  if (!Number.isInteger(month) || !Number.isInteger(year)) return 'That expiry date is not valid.';
  const endOfMonth = new Date(Date.UTC(year, month, 1));
  if (endOfMonth.getTime() <= Date.now()) return 'That card has expired.';

  return undefined;
};
