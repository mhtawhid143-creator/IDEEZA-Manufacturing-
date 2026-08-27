/**
 * Fixtures the browser verification needs but the reference seed must not carry.
 *
 * The seed is the approved reference scenario: one request that has run all the
 * way to production, so nothing in it is still open. To exercise "this product
 * already has an open request", the verification needs one open request, and it
 * belongs here rather than in the seed.
 *
 *   DATABASE_URL=... node --import tsx tools/verify-fixtures.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BUYER = 'seed_user_buyer';
/** The product that already has an open request when the checks run. */
export const OPEN_REQUEST_PRODUCT = 'seed_product_drone';

const IDS = {
  package: 'verify_package_open',
  requirements: 'verify_requirements_open',
  rfq: 'verify_rfq_open',
  recipientA: 'verify_recipient_a',
  recipientB: 'verify_recipient_b',
  quoteA: 'verify_quote_a',
  quoteB: 'verify_quote_b',
  quoteItemA: 'verify_quote_item_a',
  quoteItemB: 'verify_quote_item_b',
  substitutionA: 'verify_substitution_a',
  rfqItem: 'verify_rfq_item_u1',
} as const;

const MANUFACTURER_A = 'seed_mfr_a';
const MANUFACTURER_B = 'seed_mfr_b';

/**
 * The manufacturers answer.
 *
 * A quote is written by the manufacturer panel, which is not part of the buyer
 * work: this writes exactly the rows that panel would write, so the buyer side
 * can be exercised against real quotes rather than against a mock.
 */
const quotesArrive = async (at: Date): Promise<void> => {
  // The bill of materials as the request carried it, so a substitution has
  // something real to point at.
  await prisma.rfqItem.upsert({
    where: { id: IDS.rfqItem },
    update: {},
    create: {
      id: IDS.rfqItem,
      rfqId: IDS.rfq,
      reference: 'U1',
      componentName: 'STM32F405 MCU',
      manufacturerPartNumber: 'STM32F405RGT6',
      sku: 'MCU-STM32F405',
      quantityRequired: 250,
    },
  });

  for (const [id, manufacturerId] of [
    [IDS.recipientA, MANUFACTURER_A],
    [IDS.recipientB, MANUFACTURER_B],
  ] as const) {
    await prisma.rfqRecipient.upsert({
      where: { rfqId_manufacturerId: { rfqId: IDS.rfq, manufacturerId } },
      update: { status: 'quoted', viewedAt: at, quotedAt: at },
      create: {
        id,
        rfqId: IDS.rfq,
        manufacturerId,
        status: 'quoted',
        viewedAt: at,
        quotedAt: at,
        createdAt: at,
      },
    });
  }

  // A quote has to still be open when the checks run, so its expiry is counted
  // from now rather than from the scenario date.
  const expires = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);

  // A cheaper quote that suggests a replacement part, and a dearer, faster one
  // that prices the bill of materials exactly as it was sent.
  await prisma.quote.upsert({
    where: { id: IDS.quoteA },
    update: { status: 'submitted', expiresAt: expires },
    create: {
      id: IDS.quoteA,
      rfqId: IDS.rfq,
      manufacturerId: MANUFACTURER_A,
      status: 'submitted',
      version: 1,
      quantity: 250,
      currency: 'USD',
      unitPriceMinor: 412n,
      totalPriceMinor: 103_000n,
      shippingEstimateMinor: 8_400n,
      toolingSetupCostMinor: 12_000n,
      leadTimeDays: 18,
      materialProcessNotes:
        'FR-4 TG150, ENIG finish, SMT on both sides, AOI on 100% of boards.',
      warrantyTerms: '12 months against manufacturing defects.',
      terms: '50% on confirmation, 50% before shipping. Ex-works Shenzhen.',
      expiresAt: expires,
      submittedAt: at,
      createdAt: at,
    },
  });

  await prisma.quote.upsert({
    where: { id: IDS.quoteB },
    update: { status: 'submitted', expiresAt: expires },
    create: {
      id: IDS.quoteB,
      rfqId: IDS.rfq,
      manufacturerId: MANUFACTURER_B,
      status: 'submitted',
      version: 1,
      quantity: 250,
      currency: 'USD',
      unitPriceMinor: 468n,
      totalPriceMinor: 117_000n,
      shippingEstimateMinor: 6_200n,
      toolingSetupCostMinor: null,
      leadTimeDays: 14,
      materialProcessNotes:
        'FR-4 TG150, ENIG finish, SMT single sided, functional test on 10%.',
      warrantyTerms: '6 months against manufacturing defects.',
      terms: '100% on confirmation. DAP Dhaka.',
      expiresAt: expires,
      submittedAt: at,
      createdAt: at,
    },
  });

  for (const [id, quoteId, unit, total] of [
    [IDS.quoteItemA, IDS.quoteA, 412n, 103_000n],
    [IDS.quoteItemB, IDS.quoteB, 468n, 117_000n],
  ] as const) {
    await prisma.quoteItem.upsert({
      where: { id },
      update: {},
      create: {
        id,
        quoteId,
        rfqItemId: IDS.rfqItem,
        description: 'Assembled board, 250 units',
        quantity: 250,
        currency: 'USD',
        unitPriceMinor: unit,
        lineTotalMinor: total,
      },
    });
  }

  await prisma.substitution.upsert({
    where: { quoteId_rfqItemId: { quoteId: IDS.quoteA, rfqItemId: IDS.rfqItem } },
    update: { status: 'proposed', decidedAt: null },
    create: {
      id: IDS.substitutionA,
      quoteId: IDS.quoteA,
      rfqItemId: IDS.rfqItem,
      status: 'proposed',
      requestedPartReference: 'U1',
      suggestedPartName: 'STM32F405RGT7 (same die, wider temperature range)',
      technicalJustification:
        'The requested part is on 26 weeks lead time. The suggested part is pin compatible, in stock, and rated to 105°C.',
      currency: 'USD',
      priceImpactMinor: 1_100n,
      leadTimeImpactDays: -14,
      createdAt: at,
    },
  });

  await prisma.domainEvent.createMany({
    data: [
      {
        id: 'verify_event_quote_a',
        kind: 'quote_submitted' as const,
        actorRole: 'manufacturer' as const,
        actorManufacturerId: MANUFACTURER_A,
        subjectKind: 'quote' as const,
        subjectId: IDS.quoteA,
        payload: {},
        occurredAt: at,
      },
      {
        id: 'verify_event_quote_b',
        kind: 'quote_submitted' as const,
        actorRole: 'manufacturer' as const,
        actorManufacturerId: MANUFACTURER_B,
        subjectKind: 'quote' as const,
        subjectId: IDS.quoteB,
        payload: {},
        occurredAt: at,
      },
      {
        id: 'verify_event_substitution',
        kind: 'substitution_suggested' as const,
        actorRole: 'manufacturer' as const,
        actorManufacturerId: MANUFACTURER_A,
        subjectKind: 'substitution' as const,
        subjectId: IDS.substitutionA,
        payload: {},
        occurredAt: at,
      },
    ],
    skipDuplicates: true,
  });
};


/**
 * Two orders that have finished being made.
 *
 * The manufacturer panel owns everything up to delivery, so these write exactly
 * the rows that panel would write: one order delivered with its review window
 * running, and one already completed and reviewed. Without them the delivery,
 * review and history screens would have nothing real to show.
 */
const pastOrder = async (input: {
  readonly suffix: string;
  readonly productId: string;
  readonly status: 'delivered' | 'completed';
  readonly quantity: number;
  readonly unitPriceMinor: bigint;
  readonly deliveredDaysAgo: number;
  readonly reviewed: boolean;
}): Promise<void> => {
  const day = 24 * 60 * 60 * 1000;
  const deliveredAt = new Date(Date.now() - input.deliveredDaysAgo * day);
  const confirmedAt = new Date(deliveredAt.getTime() - 20 * day);
  const total = input.unitPriceMinor * BigInt(input.quantity);
  const id = (kind: string): string => `verify_${kind}_${input.suffix}`;

  await prisma.manufacturingPackage.upsert({
    where: { id: id('package') },
    update: {},
    create: {
      id: id('package'),
      productId: input.productId,
      kind: 'full_product',
      createdAt: confirmedAt,
    },
  });

  // The package has to carry the product files: a package with nothing in it
  // cannot be quoted, and re-ordering from it would be refused.
  const productFiles = await prisma.productFile.findMany({
    where: { productId: input.productId },
    select: { fileId: true },
  });
  for (const file of productFiles) {
    await prisma.packageFile.upsert({
      where: { packageId_fileId: { packageId: id('package'), fileId: file.fileId } },
      update: {},
      create: { packageId: id('package'), fileId: file.fileId },
    });
  }
  const productBom = await prisma.bomLine.findMany({
    where: { productId: input.productId },
    select: { id: true },
  });
  for (const line of productBom) {
    await prisma.packageBomLine.upsert({
      where: { packageId_bomLineId: { packageId: id('package'), bomLineId: line.id } },
      update: {},
      create: { packageId: id('package'), bomLineId: line.id },
    });
  }

  await prisma.manufacturingRequirements.upsert({
    where: { id: id('requirements') },
    update: {},
    create: {
      id: id('requirements'),
      packageId: id('package'),
      version: 1,
      quantity: input.quantity,
      material: 'FR-4 TG150 + PETG enclosure',
      manufacturingMethod: 'PCB fabrication + SMT assembly + FDM enclosure',
      tolerance: 'Board outline +/-0.15mm',
      leadTimeDays: 20,
      shippingRequirement: 'Courier, tracked, DAP Dhaka',
      assembly: 'smt',
      qualityCheckRequirement: 'Optical inspection on 100%',
      substitutionPolicy: 'with_approval',
      lockedAt: confirmedAt,
      createdAt: confirmedAt,
    },
  });

  await prisma.rfq.upsert({
    where: { id: id('rfq') },
    update: { status: 'closed' },
    create: {
      id: id('rfq'),
      buyerId: BUYER,
      packageId: id('package'),
      requirementsId: id('requirements'),
      status: 'closed',
      quantity: input.quantity,
      requestedServices: ['pcb_fabrication', 'pcb_assembly', 'enclosure_3d'],
      volumeTiers: [],
      currency: 'USD',
      shipToLine1: '20/3, Sector 9',
      shipToCity: 'Dhaka',
      shipToPostalCode: '1230',
      shipToCountryCode: 'BD',
      submittedAt: confirmedAt,
      closedAt: confirmedAt,
      createdAt: confirmedAt,
    },
  });

  await prisma.quote.upsert({
    where: { id: id('quote') },
    update: { status: 'accepted' },
    create: {
      id: id('quote'),
      rfqId: id('rfq'),
      manufacturerId: MANUFACTURER_A,
      status: 'accepted',
      version: 1,
      acceptedForRfqId: id('rfq'),
      quantity: input.quantity,
      currency: 'USD',
      unitPriceMinor: input.unitPriceMinor,
      totalPriceMinor: total,
      shippingEstimateMinor: 7_200n,
      toolingSetupCostMinor: 9_000n,
      leadTimeDays: 20,
      materialProcessNotes: 'FR-4 TG150, ENIG, SMT both sides, PETG enclosure.',
      warrantyTerms: '12 months against manufacturing defects.',
      terms: 'Funds secured through the platform.',
      expiresAt: new Date(confirmedAt.getTime() + 30 * day),
      submittedAt: confirmedAt,
      acceptedAt: confirmedAt,
      createdAt: confirmedAt,
    },
  });

  await prisma.quoteItem.upsert({
    where: { id: id('quote_item') },
    update: {},
    create: {
      id: id('quote_item'),
      quoteId: id('quote'),
      description: `Assembled product, ${input.quantity} units`,
      quantity: input.quantity,
      currency: 'USD',
      unitPriceMinor: input.unitPriceMinor,
      lineTotalMinor: total,
    },
  });

  await prisma.payment.upsert({
    where: { id: id('payment') },
    update: {},
    create: {
      id: id('payment'),
      quoteId: id('quote'),
      buyerId: BUYER,
      status: input.status === 'completed' ? 'released' : 'secured',
      method: 'card',
      currency: 'USD',
      goodsAmountMinor: total + 9_000n,
      shippingAmountMinor: 7_200n,
      taxAmountMinor: 0n,
      platformFeeMinor: total / 100n * 3n,
      discountAmountMinor: 0n,
      totalChargedMinor: total + 9_000n + 7_200n + (total / 100n * 3n),
      securedAt: confirmedAt,
      ...(input.status === 'completed' ? { releasedAt: deliveredAt } : {}),
      createdAt: confirmedAt,
    },
  });

  await prisma.manufacturingOrder.upsert({
    where: { id: id('order') },
    update: {
      status: input.status,
      deliveredAt,
      reviewWindowEndsAt: new Date(deliveredAt.getTime() + 7 * day),
      ...(input.status === 'completed' ? { completedAt: deliveredAt } : {}),
    },
    create: {
      id: id('order'),
      rfqId: id('rfq'),
      acceptedQuoteId: id('quote'),
      buyerId: BUYER,
      manufacturerId: MANUFACTURER_A,
      paymentId: id('payment'),
      status: input.status,
      shipToLine1: '20/3, Sector 9',
      shipToCity: 'Dhaka',
      shipToPostalCode: '1230',
      shipToCountryCode: 'BD',
      shippingChoice: 'standard',
      confirmedAt,
      deliveredAt,
      reviewWindowEndsAt: new Date(deliveredAt.getTime() + 7 * day),
      ...(input.status === 'completed' ? { completedAt: deliveredAt } : {}),
      createdAt: confirmedAt,
    },
  });

  // Append-only, so it is written once and never updated.
  await prisma.acceptedQuoteSnapshot.createMany({
    data: [
      {
        orderId: id('order'),
        quoteId: id('quote'),
        quoteVersion: 1,
        manufacturerId: MANUFACTURER_A,
        quantity: input.quantity,
        currency: 'USD',
        unitPriceMinor: input.unitPriceMinor,
        totalPriceMinor: total,
        shippingEstimateMinor: 7_200n,
        toolingSetupCostMinor: 9_000n,
        leadTimeDays: 20,
        materialProcessNotes: 'FR-4 TG150, ENIG, SMT both sides, PETG enclosure.',
        warrantyTerms: '12 months against manufacturing defects.',
        terms: 'Funds secured through the platform.',
        requirements: { quantity: input.quantity, material: 'FR-4 TG150 + PETG enclosure' },
        approvedSubstitutionIds: [],
        checksum: `verifychecksum_${input.suffix}`,
        capturedAt: confirmedAt,
      },
    ],
    skipDuplicates: true,
  });

  // All ten stages, complete, with the delivery record attached to the last one.
  const stages = [
    'quote_accepted',
    'payment_secured',
    'files_under_review',
    'materials_confirmed',
    'in_production',
    'quality_check',
    'ready_to_ship',
    'shipped',
    'delivered',
    'completed',
  ] as const;
  for (const [index, key] of stages.entries()) {
    const done = input.status === 'completed' || key !== 'completed';
    await prisma.productionStage.upsert({
      where: { orderId_key: { orderId: id('order'), key } },
      update: {},
      create: {
        id: `${id('stage')}_${key}`,
        orderId: id('order'),
        key,
        position: index + 1,
        status: done ? 'completed' : 'pending',
        ...(done ? { startedAt: confirmedAt, completedAt: deliveredAt } : {}),
      },
    });
  }

  await prisma.payout.upsert({
    where: { orderId: id('order') },
    update: {},
    create: {
      id: id('payout'),
      orderId: id('order'),
      paymentId: id('payment'),
      manufacturerId: MANUFACTURER_A,
      status: input.status === 'completed' ? 'released' : 'pending_release',
      currency: 'USD',
      orderAmountMinor: total,
      platformFeeMinor: (total / 100n) * 3n,
      netAmountMinor: total - (total / 100n) * 3n,
      ...(input.status === 'completed' ? { releasedAt: deliveredAt } : {}),
      createdAt: confirmedAt,
    },
  });

  await prisma.evidence.upsert({
    where: { id: id('evidence_delivery') },
    update: {},
    create: {
      id: id('evidence_delivery'),
      contextKind: 'delivery',
      kind: 'delivery_record',
      title: 'Courier delivery record',
      orderId: id('order'),
      capturedAt: deliveredAt,
    },
  });

  if (input.reviewed) {
    await prisma.review.upsert({
      where: { orderId: id('order') },
      update: {},
      create: {
        id: id('review'),
        orderId: id('order'),
        manufacturerId: MANUFACTURER_A,
        authorId: BUYER,
        rating: 5,
        body: 'Boards arrived on time and passed our incoming inspection.',
        anonymous: false,
        createdAt: deliveredAt,
      },
    });
  }
};


/**
 * The conversation and the notifications a buyer would already have.
 *
 * Threads are opened by the platform when a request goes out and when an order
 * is confirmed, and the manufacturer's side of them is written by the
 * manufacturer panel. Both are written here so the buyer's messaging and
 * notification screens can be exercised against real rows, including the cards
 * that are rendered from recorded domain events.
 */
const conversationsAndNotices = async (): Promise<void> => {
  const now = Date.now();
  const minutes = (count: number): Date => new Date(now - count * 60 * 1000);

  await prisma.messageThread.upsert({
    where: { id: 'verify_thread_rfq' },
    update: { lastMessageAt: minutes(4) },
    create: {
      id: 'verify_thread_rfq',
      contextKind: 'rfq',
      rfqId: IDS.rfq,
      lastMessageAt: minutes(4),
      createdAt: minutes(90),
    },
  });

  for (const userId of [BUYER, 'seed_user_member_a']) {
    await prisma.messageThreadParticipant.upsert({
      where: { threadId_userId: { threadId: 'verify_thread_rfq', userId } },
      update: {},
      create: { threadId: 'verify_thread_rfq', userId, joinedAt: minutes(90) },
    });
  }

  // The event the quote card is rendered from: the record, not typed text.
  await prisma.domainEvent.upsert({
    where: { id: 'verify_event_quote_card' },
    update: {},
    create: {
      id: 'verify_event_quote_card',
      kind: 'quote_submitted',
      actorRole: 'manufacturer',
      actorManufacturerId: MANUFACTURER_A,
      subjectKind: 'quote',
      subjectId: IDS.quoteA,
      payload: {
        quoteId: IDS.quoteA,
        quantity: 250,
        unitPriceMinor: 412,
        totalPriceMinor: 103_000,
        leadTimeDays: 18,
      },
      occurredAt: minutes(20),
    },
  });

  const messages = [
    {
      id: 'verify_msg_1',
      authorId: BUYER,
      body: 'Sent the Gerbers and the bill of materials. Can you quote both assembly sides?',
      sentAt: minutes(80),
      referencedEventId: null,
    },
    {
      id: 'verify_msg_2',
      authorId: 'seed_user_member_a',
      body: 'Yes. One part is on long lead time, so we will suggest a replacement.',
      sentAt: minutes(60),
      referencedEventId: null,
    },
    {
      id: 'verify_msg_3',
      authorId: 'seed_user_member_a',
      body: null,
      sentAt: minutes(20),
      referencedEventId: 'verify_event_quote_card',
    },
    {
      id: 'verify_msg_4',
      authorId: 'seed_user_member_a',
      body: 'Quote is in. The price holds for three weeks.',
      sentAt: minutes(4),
      referencedEventId: null,
    },
  ] as const;

  for (const message of messages) {
    await prisma.message.upsert({
      where: { id: message.id },
      update: {},
      create: {
        id: message.id,
        threadId: 'verify_thread_rfq',
        authorId: message.authorId,
        body: message.body,
        referencedEventId: message.referencedEventId,
        sentAt: message.sentAt,
      },
    });
  }

  const notices = [
    {
      id: 'verify_notice_quote',
      kind: 'quote.submitted',
      title: 'Quote received',
      body: 'PrecisionCircuit Co. has quoted your request for the Complete Drone System.',
      deepLink: `/manufacturing/rfq/${IDS.rfq}/quotes`,
      minutesAgo: 20,
      read: false,
    },
    {
      id: 'verify_notice_substitution',
      kind: 'substitution.suggested',
      title: 'Parts review required',
      body: 'A replacement part was suggested. Approve or refuse it before accepting a quote.',
      deepLink: `/manufacturing/rfq/${IDS.rfq}/substitutions`,
      minutesAgo: 18,
      read: false,
    },
    {
      id: 'verify_notice_shortage',
      kind: 'inventory.alert',
      title: 'A part is short in production',
      body: 'PrecisionCircuit Co. is 180 units short of the BMP388 barometer and is waiting on your answer.',
      deepLink: '/manufacturing/orders/seed_order_1',
      minutesAgo: 240,
      read: false,
    },
    {
      id: 'verify_notice_delivered',
      kind: 'order.delivered',
      title: 'Delivered',
      body: 'The FPV Flight Stack F7 order has been delivered. Confirm it, or raise an issue.',
      deepLink: '/manufacturing/orders/verify_order_delivered',
      minutesAgo: 2_880,
      read: false,
    },
    {
      id: 'verify_notice_completed',
      kind: 'order.completed',
      title: 'Order completed',
      body: 'The Industrial Sensor Hub order is closed and the money has been released.',
      deepLink: '/manufacturing/orders/verify_order_completed',
      minutesAgo: 57_600,
      read: true,
    },
  ] as const;

  for (const notice of notices) {
    await prisma.notification.upsert({
      where: { id: notice.id },
      update: { readAt: notice.read ? new Date(now - notice.minutesAgo * 60 * 1000) : null },
      create: {
        id: notice.id,
        recipientId: BUYER,
        kind: notice.kind,
        title: notice.title,
        body: notice.body,
        deepLink: notice.deepLink,
        createdAt: new Date(now - notice.minutesAgo * 60 * 1000),
        readAt: notice.read ? new Date(now - notice.minutesAgo * 60 * 1000) : null,
      },
    });
  }
};


/**
 * A draft that has been prepared but not sent.
 *
 * The Draft tab is where a request starts, and a draft only exists because a
 * buyer made one — so the reference scenario has none. A reviewer needs one to
 * look at, and it sits on a product of its own so that starting a fresh request
 * from any other product is still possible: a buyer may hold only one open
 * request per product, and a draft is open.
 */
const preparedDraft = async (): Promise<void> => {
  const at = new Date(Date.now() - 3 * 60 * 60 * 1000);

  await prisma.user.upsert({
    where: { id: 'verify_user_creator_c' },
    update: {},
    create: {
      id: 'verify_user_creator_c',
      email: 'studio@brightforge.test',
      displayName: 'Brightforge Studio',
      role: 'buyer',
      createdAt: at,
    },
  });

  await prisma.product.upsert({
    where: { id: 'verify_product_bracket' },
    update: {},
    create: {
      id: 'verify_product_bracket',
      ownerId: 'verify_user_creator_c',
      name: 'Thermal Camera Bracket',
      availability: 'available',
      createdAt: at,
    },
  });

  const files = [
    {
      id: 'verify_file_bracket_board',
      name: 'thermal-bracket-sensor-gerber.zip',
      contentHash: 'verifyhash-bracket-gerber',
      byteSize: 244_902,
    },
    {
      id: 'verify_file_bracket_model',
      name: 'thermal-bracket.stl',
      contentHash: 'verifyhash-bracket-stl',
      byteSize: 842_112,
    },
    {
      id: 'verify_file_bracket_drawing',
      name: 'thermal-bracket-drawing.pdf',
      contentHash: 'verifyhash-bracket-pdf',
      byteSize: 121_004,
    },
  ];
  for (const file of files) {
    await prisma.fileRef.upsert({
      where: { id: file.id },
      update: {},
      create: { ...file, uploadedById: 'verify_user_creator_c', uploadedAt: at },
    });
    await prisma.productFile.upsert({
      where: { productId_fileId: { productId: 'verify_product_bracket', fileId: file.id } },
      update: {},
      create: { productId: 'verify_product_bracket', fileId: file.id },
    });
  }

  await prisma.manufacturingPackage.upsert({
    where: { id: 'verify_package_draft' },
    update: {},
    create: {
      id: 'verify_package_draft',
      productId: 'verify_product_bracket',
      kind: 'full_product',
      createdAt: at,
    },
  });
  for (const file of files) {
    await prisma.packageFile.upsert({
      where: {
        packageId_fileId: { packageId: 'verify_package_draft', fileId: file.id },
      },
      update: {},
      create: { packageId: 'verify_package_draft', fileId: file.id },
    });
  }

  // A bill of materials on the draft, so the manufacturer selection can be read
  // against what each shop holds in stock. One line the first shop stocks and one
  // nobody does: the point of the screen is that a buyer can see the difference.
  const bracketLines = [
    {
      id: 'verify_bom_insert',
      reference: 'H1',
      componentName: 'M3 heat-set insert, brass',
      manufacturerPartNumber: 'M3-HSI-BRASS',
      sku: 'HW-M3-INSERT',
      quantityPerUnit: 4,
    },
    {
      id: 'verify_bom_screw',
      reference: 'H2',
      componentName: 'M3x8 socket screw, stainless',
      manufacturerPartNumber: 'M3X8-SS-A2',
      sku: 'HW-M3X8-SCREW',
      quantityPerUnit: 4,
    },
  ];
  for (const line of bracketLines) {
    await prisma.bomLine.upsert({
      where: { id: line.id },
      update: {},
      create: { ...line, productId: 'verify_product_bracket', footprint: 'Hardware' },
    });
    await prisma.packageBomLine.upsert({
      where: {
        packageId_bomLineId: { packageId: 'verify_package_draft', bomLineId: line.id },
      },
      update: {},
      create: { packageId: 'verify_package_draft', bomLineId: line.id },
    });
  }

  // The first shop holds the inserts and not the screws, so it covers one of the
  // two lines. Nobody else holds either.
  await prisma.inventoryItem.upsert({
    where: {
      manufacturerId_sku: { manufacturerId: MANUFACTURER_A, sku: 'HW-M3-INSERT' },
    },
    update: { stockQuantity: 4_000, reservedQuantity: 0, enabledForMatching: true },
    create: {
      id: 'verify_inventory_insert',
      manufacturerId: MANUFACTURER_A,
      partName: 'M3 heat-set insert, brass',
      sku: 'HW-M3-INSERT',
      category: 'Hardware',
      stockQuantity: 4_000,
      reservedQuantity: 0,
      lowStockThreshold: 500,
      currency: 'USD',
      unitCostMinor: 6n,
      leadTimeDays: 4,
      minimumOrderQuantity: 500,
      storageLocation: 'H1-02',
      enabledForMatching: true,
    },
  });

  await prisma.manufacturingRequirements.upsert({
    where: { id: 'verify_requirements_draft' },
    update: {},
    create: {
      id: 'verify_requirements_draft',
      packageId: 'verify_package_draft',
      version: 1,
      quantity: 60,
      material: 'PA12, bead blasted',
      manufacturingMethod: 'SLS printing',
      tolerance: '+/-0.3mm',
      leadTimeDays: 14,
      shippingRequirement: 'Courier, tracked, DAP Dhaka',
      assembly: 'none',
      qualityCheckRequirement: 'Dimensional check on 10% of the batch',
      substitutionPolicy: 'with_approval',
      notes: 'The camera boss must stay within 0.2mm or the lens will not seat.',
      printTechnology: 'sls',
      printMaterial: 'PA12',
      printColor: 'Graphite',
      surfaceFinish: 'bead_blasted',
      createdAt: at,
    },
  });

  await prisma.boardSpecification.upsert({
    where: { requirementsId: 'verify_requirements_draft' },
    update: {},
    create: {
      requirementsId: 'verify_requirements_draft',
      layerCount: 2,
      thicknessMm: 1.6,
      surfaceFinish: 'hasl_lead_free',
      stencilRequired: false,
    },
  });

  await prisma.rfq.upsert({
    where: { id: 'verify_rfq_draft' },
    update: { status: 'draft' },
    create: {
      id: 'verify_rfq_draft',
      buyerId: BUYER,
      packageId: 'verify_package_draft',
      requirementsId: 'verify_requirements_draft',
      status: 'draft',
      quantity: 60,
      requestedServices: [],
      volumeTiers: [],
      currency: 'USD',
      shipToLine1: '20/3, Sector 9',
      shipToCity: 'Dhaka',
      shipToPostalCode: '1230',
      shipToCountryCode: 'BD',
      createdAt: at,
    },
  });
};

const main = async (): Promise<void> => {
  const at = new Date('2026-06-01T09:00:00.000Z');

  await prisma.manufacturingPackage.upsert({
    where: { id: IDS.package },
    update: {},
    create: {
      id: IDS.package,
      productId: OPEN_REQUEST_PRODUCT,
      kind: 'pcb',
      createdAt: at,
    },
  });

  await prisma.manufacturingRequirements.upsert({
    where: { id: IDS.requirements },
    update: {},
    create: {
      id: IDS.requirements,
      packageId: IDS.package,
      version: 1,
      quantity: 250,
      material: 'FR-4 TG150',
      manufacturingMethod: 'PCB fabrication + SMT assembly',
      tolerance: 'Board outline +/-0.15mm',
      leadTimeDays: 21,
      shippingRequirement: 'Courier, tracked, DAP Dhaka',
      assembly: 'smt',
      qualityCheckRequirement: 'Optical inspection on 100%',
      substitutionPolicy: 'with_approval',
      lockedAt: at,
      createdAt: at,
    },
  });

  await prisma.rfq.upsert({
    where: { id: IDS.rfq },
    update: { status: 'submitted' },
    create: {
      id: IDS.rfq,
      buyerId: BUYER,
      packageId: IDS.package,
      requirementsId: IDS.requirements,
      status: 'submitted',
      quantity: 250,
      volumeTiers: [250, 500],
      currency: 'USD',
      shipToLine1: '20/3, Sector 9',
      shipToCity: 'Dhaka',
      shipToPostalCode: '1230',
      shipToCountryCode: 'BD',
      submittedAt: at,
      createdAt: at,
    },
  });

  const openFiles = await prisma.productFile.findMany({
    where: { productId: OPEN_REQUEST_PRODUCT },
    select: { fileId: true },
  });
  for (const file of openFiles) {
    await prisma.packageFile.upsert({
      where: { packageId_fileId: { packageId: IDS.package, fileId: file.fileId } },
      update: {},
      create: { packageId: IDS.package, fileId: file.fileId },
    });
  }

  await prisma.boardSpecification.upsert({
    where: { requirementsId: IDS.requirements },
    update: {},
    create: {
      requirementsId: IDS.requirements,
      baseMaterial: 'fr4',
      layerCount: 4,
      thicknessMm: 1.6,
      boardColor: 'green',
      silkscreenColor: 'white',
      surfaceFinish: 'enig',
      outerCopperOz: 1,
      innerCopperOz: 1,
      viaCovering: 'tented',
      minViaHoleMm: 0.3,
      outlineToleranceMm: 0.2,
      deliveryFormat: 'single_pcb',
      electricalTest: 'flying_probe_full',
      workmanshipClass: 'ipc_class_3',
      markOnBoard: 'order_number',
      packaging: 'antistatic_bubble',
      partsSuppliedBy: 'buyer',
      toolingHolesAddedBy: 'manufacturer',
      functionalTest: true,
      remarks:
        'Impedance control on the RF pair. No-clean flux only: the boards are not washed here.',
    },
  });

  await quotesArrive(new Date(at.getTime() + 2 * 24 * 60 * 60 * 1000));

  // One order waiting on the buyer's delivery confirmation, and one closed.
  await pastOrder({
    suffix: 'delivered',
    productId: 'seed_product_fpv_stack',
    status: 'delivered',
    quantity: 120,
    unitPriceMinor: 640n,
    deliveredDaysAgo: 2,
    reviewed: false,
  });
  await pastOrder({
    suffix: 'completed',
    productId: 'seed_product_sensor_hub',
    status: 'completed',
    quantity: 60,
    unitPriceMinor: 1_450n,
    deliveredDaysAgo: 40,
    reviewed: true,
  });

  await conversationsAndNotices();
  await preparedDraft();

  process.stdout.write(
    `fixtures: open request on ${OPEN_REQUEST_PRODUCT}, two quotes, one suggested replacement part, one delivered order, one completed order, one conversation, five notifications and one prepared draft with a bill of materials\n`,
  );
};

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    await prisma.$disconnect();
    process.exit(1);
  });
