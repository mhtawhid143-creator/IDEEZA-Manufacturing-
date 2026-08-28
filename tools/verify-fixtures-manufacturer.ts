/**
 * Fixtures the manufacturer panel needs, on top of the shared ones.
 *
 * The reference seed and `verify-fixtures.ts` leave every request routed to a
 * shop already answered, which is exactly what the buyer side needed to exercise
 * comparison. A manufacturer inbox is the other half of that: it needs requests
 * nobody has answered yet, one of each kind of work, with the files, the frozen
 * specification and the bill of materials a real request carries.
 *
 * It is a separate file rather than more of `verify-fixtures.ts` so the buyer
 * harness keeps running against exactly the data it was verified on.
 *
 *   node --import tsx tools/verify-fixtures-manufacturer.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BUYER = 'seed_user_buyer';
const MANUFACTURER_A = 'seed_mfr_a';
const MANUFACTURER_B = 'seed_mfr_b';

const hoursAgo = (hours: number): Date =>
  new Date(Date.now() - hours * 60 * 60 * 1000);

const daysAhead = (days: number): Date =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

interface FileSpec {
  readonly id: string;
  readonly name: string;
  readonly contentHash: string;
  readonly byteSize: number;
}

/** A product with its files, owned by a creator who is not the buyer. */
const product = async (input: {
  readonly creatorId: string;
  readonly creatorEmail: string;
  readonly creatorName: string;
  readonly productId: string;
  readonly productName: string;
  readonly files: readonly FileSpec[];
  readonly at: Date;
}): Promise<void> => {
  await prisma.user.upsert({
    where: { id: input.creatorId },
    update: {},
    create: {
      id: input.creatorId,
      email: input.creatorEmail,
      displayName: input.creatorName,
      role: 'buyer',
      createdAt: input.at,
    },
  });

  await prisma.product.upsert({
    where: { id: input.productId },
    update: {},
    create: {
      id: input.productId,
      ownerId: input.creatorId,
      name: input.productName,
      availability: 'available',
      createdAt: input.at,
    },
  });

  for (const file of input.files) {
    await prisma.fileRef.upsert({
      where: { id: file.id },
      update: {},
      create: { ...file, uploadedById: input.creatorId, uploadedAt: input.at },
    });
    await prisma.productFile.upsert({
      where: { productId_fileId: { productId: input.productId, fileId: file.id } },
      update: {},
      create: { productId: input.productId, fileId: file.id },
    });
  }
};

/**
 * An unanswered request in shop A's inbox: a board with assembly.
 *
 * The specification is frozen and complete, because a quote priced against a
 * moving requirement is worthless, and the bill of materials deliberately holds
 * one part shop A does not stock — the shortage the inventory stage has to find.
 */
const boardRequest = async (): Promise<void> => {
  const at = hoursAgo(20);
  const files: readonly FileSpec[] = [
    {
      id: 'mfrfix_file_driver_gerber',
      name: 'rover-motor-driver-v3-gerber.zip',
      contentHash: 'mfrfixhash-driver-gerber-9f21c4',
      byteSize: 1_204_338,
    },
    {
      id: 'mfrfix_file_driver_bom',
      name: 'rover-motor-driver-v3-bom.csv',
      contentHash: 'mfrfixhash-driver-bom-4ba7d0',
      byteSize: 18_442,
    },
    {
      id: 'mfrfix_file_driver_assembly',
      name: 'rover-motor-driver-assembly-notes.pdf',
      contentHash: 'mfrfixhash-driver-notes-77c1ab',
      byteSize: 262_144,
    },
  ];

  await product({
    creatorId: 'mfrfix_user_creator_rover',
    creatorEmail: 'design@roverworks.test',
    creatorName: 'Roverworks Design',
    productId: 'mfrfix_product_driver',
    productName: 'Rover Motor Driver v3',
    files,
    at,
  });

  await prisma.manufacturingPackage.upsert({
    where: { id: 'mfrfix_package_driver' },
    update: {},
    create: {
      id: 'mfrfix_package_driver',
      productId: 'mfrfix_product_driver',
      kind: 'pcb',
      createdAt: at,
    },
  });
  for (const file of files) {
    await prisma.packageFile.upsert({
      where: {
        packageId_fileId: { packageId: 'mfrfix_package_driver', fileId: file.id },
      },
      update: {},
      create: { packageId: 'mfrfix_package_driver', fileId: file.id },
    });
  }

  await prisma.manufacturingRequirements.upsert({
    where: { id: 'mfrfix_requirements_driver' },
    update: { lockedAt: at },
    create: {
      id: 'mfrfix_requirements_driver',
      packageId: 'mfrfix_package_driver',
      version: 1,
      quantity: 400,
      material: 'FR-4 TG150',
      manufacturingMethod: 'PCB fabrication + SMT assembly',
      tolerance: 'Board outline +/-0.15mm',
      leadTimeDays: 24,
      shippingRequirement: 'Courier, tracked, DAP Dhaka',
      assembly: 'smt',
      assemblySides: 'single_side',
      qualityCheckRequirement: 'AOI on 100%, functional test on 10%',
      substitutionPolicy: 'with_approval',
      notes:
        'The gate driver footprints are tight: confirm your line can place 0402 before quoting.',
      lockedAt: at,
      createdAt: at,
    },
  });

  await prisma.boardSpecification.upsert({
    where: { requirementsId: 'mfrfix_requirements_driver' },
    update: {},
    create: {
      requirementsId: 'mfrfix_requirements_driver',
      baseMaterial: 'fr4',
      layerCount: 4,
      thicknessMm: 1.6,
      boardColor: 'blue',
      silkscreenColor: 'white',
      surfaceFinish: 'enig',
      outerCopperOz: 2,
      innerCopperOz: 1,
      viaCovering: 'tented',
      minViaHoleMm: 0.3,
      outlineToleranceMm: 0.2,
      deliveryFormat: 'panel_by_manufacturer',
      distinctDesigns: 1,
      electricalTest: 'flying_probe_full',
      goldFingers: false,
      castellatedHoles: false,
      edgePlating: false,
      blindOrBuriedVias: false,
      ulMarking: 'none',
      markOnBoard: 'order_number',
      workmanshipClass: 'ipc_class_3',
      packaging: 'antistatic_bubble',
      assembledFace: 'top',
      partsSuppliedBy: 'manufacturer',
      toolingHolesAddedBy: 'manufacturer',
      conformalCoating: false,
      functionalTest: true,
      stencilRequired: true,
      remarks: 'Impedance control on the CAN pair. No-clean flux only.',
    },
  });

  await prisma.rfq.upsert({
    where: { id: 'mfrfix_rfq_driver' },
    update: { status: 'submitted' },
    create: {
      id: 'mfrfix_rfq_driver',
      buyerId: BUYER,
      packageId: 'mfrfix_package_driver',
      requirementsId: 'mfrfix_requirements_driver',
      status: 'submitted',
      quantity: 400,
      requestedServices: ['pcb_fabrication', 'parts_sourcing', 'pcb_assembly', 'testing'],
      volumeTiers: [400, 1000],
      targetPriceMinor: 512_000n,
      currency: 'USD',
      shipToLine1: '20/3, Sector 9',
      shipToCity: 'Dhaka',
      shipToPostalCode: '1230',
      shipToCountryCode: 'BD',
      neededBy: daysAhead(45),
      responseDeadline: daysAhead(6),
      submittedAt: at,
      createdAt: at,
    },
  });

  const lines = [
    {
      reference: 'U1',
      componentName: 'STM32G431 MCU',
      manufacturerPartNumber: 'STM32G431CBT6',
      sku: 'MCU-STM32G431',
      quantityRequired: 1,
    },
    {
      reference: 'U2',
      componentName: 'DRV8353 gate driver',
      manufacturerPartNumber: 'DRV8353RSRGZR',
      sku: 'DRV-8353RS',
      quantityRequired: 2,
    },
    {
      reference: 'Q1',
      componentName: 'N-channel MOSFET 60V 100A',
      manufacturerPartNumber: 'BSC010N04LS',
      sku: 'FET-BSC010N04',
      quantityRequired: 6,
    },
    {
      reference: 'C7',
      componentName: 'Bulk capacitor 470uF 63V',
      manufacturerPartNumber: 'EEU-FR1J471',
      sku: 'CAP-470U63V',
      quantityRequired: 2,
    },
  ];
  for (const line of lines) {
    await prisma.rfqItem.upsert({
      where: { rfqId_reference: { rfqId: 'mfrfix_rfq_driver', reference: line.reference } },
      update: {},
      create: { ...line, id: `mfrfix_item_${line.reference.toLowerCase()}`, rfqId: 'mfrfix_rfq_driver' },
    });
  }

  // Shop A has not opened it; shop B has looked and not answered. Neither can
  // see the other's row, which is the point of routing records.
  await prisma.rfqRecipient.upsert({
    where: {
      rfqId_manufacturerId: {
        rfqId: 'mfrfix_rfq_driver',
        manufacturerId: MANUFACTURER_A,
      },
    },
    update: { status: 'routed', viewedAt: null, expiresAt: daysAhead(6) },
    create: {
      id: 'mfrfix_recipient_driver_a',
      rfqId: 'mfrfix_rfq_driver',
      manufacturerId: MANUFACTURER_A,
      status: 'routed',
      expiresAt: daysAhead(6),
      createdAt: at,
    },
  });
  await prisma.rfqRecipient.upsert({
    where: {
      rfqId_manufacturerId: {
        rfqId: 'mfrfix_rfq_driver',
        manufacturerId: MANUFACTURER_B,
      },
    },
    update: { status: 'viewed' },
    create: {
      id: 'mfrfix_recipient_driver_b',
      rfqId: 'mfrfix_rfq_driver',
      manufacturerId: MANUFACTURER_B,
      status: 'viewed',
      viewedAt: hoursAgo(8),
      expiresAt: daysAhead(6),
      createdAt: at,
    },
  });
};

/**
 * A second unanswered request, printed rather than fabricated.
 *
 * Two kinds of work in the inbox is what makes the work-type filter mean
 * something, and a printed part reads its specification through a different set
 * of rows — which is worth having a real example of on both panels.
 */
const printedRequest = async (): Promise<void> => {
  const at = hoursAgo(5);
  const files: readonly FileSpec[] = [
    {
      id: 'mfrfix_file_housing_model',
      name: 'gimbal-housing-v2.step',
      contentHash: 'mfrfixhash-housing-step-31de77',
      byteSize: 3_401_220,
    },
    {
      id: 'mfrfix_file_housing_drawing',
      name: 'gimbal-housing-drawing.pdf',
      contentHash: 'mfrfixhash-housing-pdf-a0b912',
      byteSize: 184_320,
    },
  ];

  await product({
    creatorId: 'mfrfix_user_creator_gimbal',
    creatorEmail: 'cad@skyframe.test',
    creatorName: 'Skyframe CAD',
    productId: 'mfrfix_product_housing',
    productName: 'Gimbal Housing v2',
    files,
    at,
  });

  await prisma.manufacturingPackage.upsert({
    where: { id: 'mfrfix_package_housing' },
    update: {},
    create: {
      id: 'mfrfix_package_housing',
      productId: 'mfrfix_product_housing',
      kind: 'module_3d',
      createdAt: at,
    },
  });
  for (const file of files) {
    await prisma.packageFile.upsert({
      where: {
        packageId_fileId: { packageId: 'mfrfix_package_housing', fileId: file.id },
      },
      update: {},
      create: { packageId: 'mfrfix_package_housing', fileId: file.id },
    });
  }

  await prisma.manufacturingRequirements.upsert({
    where: { id: 'mfrfix_requirements_housing' },
    update: { lockedAt: at },
    create: {
      id: 'mfrfix_requirements_housing',
      packageId: 'mfrfix_package_housing',
      version: 1,
      quantity: 150,
      material: 'PA12 nylon',
      manufacturingMethod: 'SLS printing',
      tolerance: '+/-0.25mm',
      leadTimeDays: 12,
      shippingRequirement: 'Courier, tracked, DAP Dhaka',
      assembly: 'none',
      qualityCheckRequirement: 'Dimensional check on 10% of the batch',
      substitutionPolicy: 'not_allowed',
      notes: 'The bearing seat is the critical dimension. Do not sand it.',
      printTechnology: 'sls',
      printMaterial: 'PA12',
      printColor: 'Black',
      surfaceFinish: 'bead_blasted',
      infillPercent: 100,
      lockedAt: at,
      createdAt: at,
    },
  });

  await prisma.rfq.upsert({
    where: { id: 'mfrfix_rfq_housing' },
    update: { status: 'submitted' },
    create: {
      id: 'mfrfix_rfq_housing',
      buyerId: BUYER,
      packageId: 'mfrfix_package_housing',
      requirementsId: 'mfrfix_requirements_housing',
      status: 'submitted',
      quantity: 150,
      requestedServices: ['enclosure_3d'],
      volumeTiers: [],
      currency: 'USD',
      shipToLine1: '20/3, Sector 9',
      shipToCity: 'Dhaka',
      shipToPostalCode: '1230',
      shipToCountryCode: 'BD',
      neededBy: daysAhead(30),
      responseDeadline: daysAhead(4),
      submittedAt: at,
      createdAt: at,
    },
  });

  await prisma.rfqRecipient.upsert({
    where: {
      rfqId_manufacturerId: {
        rfqId: 'mfrfix_rfq_housing',
        manufacturerId: MANUFACTURER_A,
      },
    },
    update: { status: 'routed', viewedAt: null, expiresAt: daysAhead(4) },
    create: {
      id: 'mfrfix_recipient_housing_a',
      rfqId: 'mfrfix_rfq_housing',
      manufacturerId: MANUFACTURER_A,
      status: 'routed',
      expiresAt: daysAhead(4),
      createdAt: at,
    },
  });
};


/**
 * Stock for shop A, arranged so the bill of materials above has one line of each
 * kind: covered, short with a substitute the shop itself declared, and two not
 * stocked at all with something in the same category that could stand in.
 *
 * Availability is stock minus what is reserved, so the short line is short
 * because part of its stock is already promised to another order — which is the
 * realistic reason, and the one a shop has to be able to see.
 */
const stockForShopA = async (): Promise<void> => {
  const items = [
    {
      id: 'mfrfix_inv_g431',
      partName: 'STM32G431 MCU',
      sku: 'MCU-STM32G431',
      category: 'Microcontrollers',
      stockQuantity: 900,
      reservedQuantity: 100,
      unitCostMinor: 480n,
      leadTimeDays: 6,
      storageLocation: 'A1-03',
    },
    {
      id: 'mfrfix_inv_drv8353',
      partName: 'DRV8353 gate driver',
      sku: 'DRV-8353RS',
      category: 'Gate drivers',
      stockQuantity: 300,
      reservedQuantity: 100,
      unitCostMinor: 1_240n,
      leadTimeDays: 12,
      storageLocation: 'B2-11',
    },
    {
      id: 'mfrfix_inv_drv8323',
      partName: 'DRV8323 gate driver',
      sku: 'DRV-8323RS',
      category: 'Gate drivers',
      stockQuantity: 1_600,
      reservedQuantity: 0,
      unitCostMinor: 1_060n,
      leadTimeDays: 8,
      storageLocation: 'B2-12',
    },
    {
      id: 'mfrfix_inv_fet016',
      partName: 'N-channel MOSFET 60V 80A',
      sku: 'FET-BSC016N04',
      category: 'Power MOSFETs',
      stockQuantity: 5_000,
      reservedQuantity: 200,
      unitCostMinor: 96n,
      leadTimeDays: 5,
      storageLocation: 'C1-04',
    },
    {
      id: 'mfrfix_inv_cap470',
      partName: 'Bulk capacitor 470uF 100V',
      sku: 'CAP-470U100V',
      category: 'Electrolytic capacitors',
      stockQuantity: 2_400,
      reservedQuantity: 0,
      unitCostMinor: 210n,
      leadTimeDays: 9,
      storageLocation: 'C3-08',
    },
  ];

  for (const item of items) {
    await prisma.inventoryItem.upsert({
      where: { manufacturerId_sku: { manufacturerId: MANUFACTURER_A, sku: item.sku } },
      update: {
        stockQuantity: item.stockQuantity,
        reservedQuantity: item.reservedQuantity,
        enabledForMatching: true,
      },
      create: {
        ...item,
        manufacturerId: MANUFACTURER_A,
        currency: 'USD',
        lowStockThreshold: 200,
        enabledForMatching: true,
        minimumOrderQuantity: 100,
      },
    });
  }

  // The shop's own declared alternative, which is what a shop actually knows and
  // what the proposal list has to offer first.
  await prisma.inventorySubstitute.upsert({
    where: {
      itemId_substituteId: {
        itemId: 'mfrfix_inv_drv8353',
        substituteId: 'mfrfix_inv_drv8323',
      },
    },
    update: {},
    create: { itemId: 'mfrfix_inv_drv8353', substituteId: 'mfrfix_inv_drv8323' },
  });
};


/**
 * A funded order in production, which is the state the orders screens are about.
 *
 * The shared fixtures leave every order delivered or finished; a shop needs one
 * it is still building. Everything here is exactly what the buyer's checkout
 * writes when it takes the money: the accepted quote, its immutable snapshot, a
 * secured payment, and the ten canonical stages with the shop-floor tasks under
 * the ones that have them.
 */
const liveOrder = async (): Promise<void> => {
  const day = 24 * 60 * 60 * 1000;
  const confirmedAt = new Date(Date.now() - 6 * day);
  const quantity = 250;
  const unitPriceMinor = 1_180n;
  const total = unitPriceMinor * BigInt(quantity);

  const files: readonly FileSpec[] = [
    {
      id: 'mfrfix_file_beacon_gerber',
      name: 'beacon-light-board-gerber.zip',
      contentHash: 'mfrfixhash-beacon-gerber-5ac881',
      byteSize: 884_210,
    },
    {
      id: 'mfrfix_file_beacon_bom',
      name: 'beacon-light-board-bom.csv',
      contentHash: 'mfrfixhash-beacon-bom-2fd104',
      byteSize: 12_004,
    },
  ];

  await product({
    creatorId: 'mfrfix_user_creator_beacon',
    creatorEmail: 'hardware@lumenworks.test',
    creatorName: 'Lumenworks Hardware',
    productId: 'mfrfix_product_beacon',
    productName: 'Beacon Light Board',
    files,
    at: confirmedAt,
  });

  await prisma.manufacturingPackage.upsert({
    where: { id: 'mfrfix_package_beacon' },
    update: {},
    create: {
      id: 'mfrfix_package_beacon',
      productId: 'mfrfix_product_beacon',
      kind: 'pcb',
      createdAt: confirmedAt,
    },
  });
  for (const file of files) {
    await prisma.packageFile.upsert({
      where: {
        packageId_fileId: { packageId: 'mfrfix_package_beacon', fileId: file.id },
      },
      update: {},
      create: { packageId: 'mfrfix_package_beacon', fileId: file.id },
    });
  }

  await prisma.manufacturingRequirements.upsert({
    where: { id: 'mfrfix_requirements_beacon' },
    update: {},
    create: {
      id: 'mfrfix_requirements_beacon',
      packageId: 'mfrfix_package_beacon',
      version: 1,
      quantity,
      material: 'FR-4 TG150',
      manufacturingMethod: 'PCB fabrication + SMT assembly',
      tolerance: 'Board outline +/-0.15mm',
      leadTimeDays: 18,
      shippingRequirement: 'Courier, tracked, DAP Dhaka',
      assembly: 'smt',
      assemblySides: 'single_side',
      qualityCheckRequirement: 'AOI on 100%',
      substitutionPolicy: 'with_approval',
      lockedAt: confirmedAt,
      createdAt: confirmedAt,
      boardSpec: {
        create: {
          baseMaterial: 'fr4',
          layerCount: 2,
          thicknessMm: 1.6,
          boardColor: 'black',
          silkscreenColor: 'white',
          surfaceFinish: 'hasl_lead_free',
          electricalTest: 'flying_probe_full',
          workmanshipClass: 'ipc_class_2',
          packaging: 'antistatic_bubble',
          assembledFace: 'top',
          partsSuppliedBy: 'manufacturer',
          functionalTest: true,
        },
      },
    },
  });

  await prisma.rfq.upsert({
    where: { id: 'mfrfix_rfq_beacon' },
    update: { status: 'closed' },
    create: {
      id: 'mfrfix_rfq_beacon',
      buyerId: BUYER,
      packageId: 'mfrfix_package_beacon',
      requirementsId: 'mfrfix_requirements_beacon',
      status: 'closed',
      quantity,
      requestedServices: ['pcb_fabrication', 'parts_sourcing', 'pcb_assembly'],
      volumeTiers: [],
      currency: 'USD',
      shipToLine1: '20/3, Sector 9',
      shipToCity: 'Dhaka',
      shipToPostalCode: '1230',
      shipToCountryCode: 'BD',
      neededBy: new Date(confirmedAt.getTime() + 30 * day),
      submittedAt: new Date(confirmedAt.getTime() - 4 * day),
      closedAt: confirmedAt,
      createdAt: new Date(confirmedAt.getTime() - 5 * day),
      items: {
        create: [
          {
            id: 'mfrfix_item_beacon_u1',
            reference: 'U1',
            componentName: 'LED driver 1A',
            manufacturerPartNumber: 'AL8862QSP-13',
            sku: 'DRV-AL8862',
            quantityRequired: 2,
          },
        ],
      },
      recipients: {
        create: [
          {
            id: 'mfrfix_recipient_beacon',
            manufacturerId: MANUFACTURER_A,
            status: 'quoted',
            viewedAt: new Date(confirmedAt.getTime() - 4 * day),
            quotedAt: new Date(confirmedAt.getTime() - 3 * day),
            createdAt: new Date(confirmedAt.getTime() - 4 * day),
          },
        ],
      },
    },
  });

  await prisma.quote.upsert({
    where: { id: 'mfrfix_quote_beacon' },
    update: { status: 'accepted' },
    create: {
      id: 'mfrfix_quote_beacon',
      rfqId: 'mfrfix_rfq_beacon',
      manufacturerId: MANUFACTURER_A,
      status: 'accepted',
      version: 1,
      acceptedForRfqId: 'mfrfix_rfq_beacon',
      quantity,
      currency: 'USD',
      unitPriceMinor,
      totalPriceMinor: total,
      shippingEstimateMinor: 6_400n,
      toolingSetupCostMinor: 8_000n,
      leadTimeDays: 18,
      materialProcessNotes: 'FR-4 TG150, lead-free HASL, SMT on the top side, AOI on 100%.',
      warrantyTerms: '12 months against manufacturing defects.',
      terms: '50% on confirmation, 50% before shipping. Ex-works Dhaka.',
      expiresAt: new Date(confirmedAt.getTime() + 30 * day),
      submittedAt: new Date(confirmedAt.getTime() - 3 * day),
      acceptedAt: confirmedAt,
      createdAt: new Date(confirmedAt.getTime() - 3 * day),
    },
  });

  await prisma.payment.upsert({
    where: { id: 'mfrfix_payment_beacon' },
    update: { status: 'secured' },
    create: {
      id: 'mfrfix_payment_beacon',
      quoteId: 'mfrfix_quote_beacon',
      buyerId: BUYER,
      status: 'secured',
      method: 'card',
      currency: 'USD',
      goodsAmountMinor: total + 8_000n,
      shippingAmountMinor: 6_400n,
      taxAmountMinor: 0n,
      platformFeeMinor: (total / 100n) * 3n,
      discountAmountMinor: 0n,
      totalChargedMinor: total + 8_000n + 6_400n + (total / 100n) * 3n,
      securedAt: confirmedAt,
      createdAt: confirmedAt,
    },
  });

  await prisma.manufacturingOrder.upsert({
    where: { id: 'mfrfix_order_beacon' },
    update: { status: 'in_production' },
    create: {
      id: 'mfrfix_order_beacon',
      rfqId: 'mfrfix_rfq_beacon',
      acceptedQuoteId: 'mfrfix_quote_beacon',
      buyerId: BUYER,
      manufacturerId: MANUFACTURER_A,
      paymentId: 'mfrfix_payment_beacon',
      status: 'in_production',
      shipToLine1: '20/3, Sector 9',
      shipToCity: 'Dhaka',
      shipToPostalCode: '1230',
      shipToCountryCode: 'BD',
      shippingChoice: 'standard',
      confirmedAt,
      createdAt: confirmedAt,
    },
  });

  await prisma.acceptedQuoteSnapshot.createMany({
    data: [
      {
        orderId: 'mfrfix_order_beacon',
        quoteId: 'mfrfix_quote_beacon',
        quoteVersion: 1,
        manufacturerId: MANUFACTURER_A,
        quantity,
        currency: 'USD',
        unitPriceMinor,
        totalPriceMinor: total,
        shippingEstimateMinor: 6_400n,
        toolingSetupCostMinor: 8_000n,
        leadTimeDays: 18,
        materialProcessNotes:
          'FR-4 TG150, lead-free HASL, SMT on the top side, AOI on 100%.',
        warrantyTerms: '12 months against manufacturing defects.',
        terms: '50% on confirmation, 50% before shipping. Ex-works Dhaka.',
        requirements: { quantity, material: 'FR-4 TG150' },
        approvedSubstitutionIds: [],
        checksum: 'mfrfixchecksum_beacon',
        capturedAt: confirmedAt,
      },
    ],
    skipDuplicates: true,
  });

  // The ten canonical stages. The two the platform owns are done, the file and
  // materials reviews are done, and production is under way — which is exactly
  // where a shop picks the order up.
  const stages = [
    { key: 'quote_accepted', status: 'completed' },
    { key: 'payment_secured', status: 'completed' },
    { key: 'files_under_review', status: 'completed' },
    { key: 'materials_confirmed', status: 'completed' },
    { key: 'in_production', status: 'in_progress' },
    { key: 'quality_check', status: 'pending' },
    { key: 'ready_to_ship', status: 'pending' },
    { key: 'shipped', status: 'pending' },
    { key: 'delivered', status: 'pending' },
    { key: 'completed', status: 'pending' },
  ] as const;

  const tasks: Readonly<Record<string, readonly string[]>> = {
    files_under_review: ['Design file review', 'Manufacturability review'],
    materials_confirmed: ['Inventory check', 'Parts sourcing'],
    in_production: ['Bare board fabrication', 'Assembly', 'Firmware flashing'],
    quality_check: ['Optical inspection', 'Functional test'],
    ready_to_ship: ['Packaging', 'Shipping documents'],
  };

  for (const [index, stage] of stages.entries()) {
    const stageId = `mfrfix_stage_beacon_${stage.key}`;
    await prisma.productionStage.upsert({
      where: { orderId_key: { orderId: 'mfrfix_order_beacon', key: stage.key } },
      update: {},
      create: {
        id: stageId,
        orderId: 'mfrfix_order_beacon',
        key: stage.key,
        position: index + 1,
        status: stage.status,
        ...(stage.status === 'completed'
          ? {
              startedAt: new Date(confirmedAt.getTime() + index * 6 * 60 * 60 * 1000),
              completedAt: new Date(confirmedAt.getTime() + (index + 1) * 6 * 60 * 60 * 1000),
            }
          : stage.status === 'in_progress'
            ? { startedAt: new Date(confirmedAt.getTime() + index * 6 * 60 * 60 * 1000) }
            : {}),
      },
    });

    for (const [taskIndex, label] of (tasks[stage.key] ?? []).entries()) {
      await prisma.productionTask.upsert({
        where: { stageId_position: { stageId, position: taskIndex + 1 } },
        update: {},
        create: {
          id: `${stageId}_task_${taskIndex + 1}`,
          orderId: 'mfrfix_order_beacon',
          stageId,
          label,
          position: taskIndex + 1,
          status: stage.status === 'completed' ? 'completed' : 'pending',
          ...(stage.status === 'completed'
            ? { startedAt: confirmedAt, completedAt: confirmedAt }
            : {}),
        },
      });
    }
  }
};

/**
 * What the platform has told shop A.
 *
 * The bell in the navbar has always counted these rows; until the notifications
 * screen existed there was nowhere for them to be read, so nothing seeded them.
 * One of each kind a shop actually receives, one already read, each carrying the
 * deep link to the screen that owns the thing it is about.
 */
const notificationsForShopA = async (): Promise<void> => {
  const member = 'seed_user_member_a';
  const rows = [
    {
      id: 'mfrfix_notif_request',
      kind: 'rfq.routed',
      title: 'A request reached your shop',
      body: 'Gimbal Housing v2 — 150 units, printed housing. It has a reply deadline.',
      deepLink: '/rfqs/mfrfix_rfq_driver',
      readAt: null,
      createdAt: hoursAgo(20),
    },
    {
      id: 'mfrfix_notif_shortage',
      kind: 'order.shortage_answered',
      title: 'The buyer answered a part shortage',
      body: 'Beacon Light Board — the substitute you suggested was approved, so production may continue.',
      deepLink: '/orders/mfrfix_order_beacon',
      readAt: null,
      createdAt: hoursAgo(6),
    },
    {
      id: 'mfrfix_notif_quote',
      kind: 'quote.accepted',
      title: 'Your quote was accepted',
      body: 'An order is open against the terms you quoted, and they cannot change now.',
      deepLink: '/orders/mfrfix_order_beacon',
      readAt: hoursAgo(30),
      createdAt: hoursAgo(34),
    },
  ];

  for (const row of rows) {
    await prisma.notification.upsert({
      where: { id: row.id },
      update: {},
      create: { ...row, recipientId: member },
    });
  }
};

/**
 * A refund claim the buyer has made and the shop has not answered.
 *
 * The shop's side of refunds and disputes had no fixture at all, which is why
 * neither its banner nor its case screen was ever exercised in a browser. The
 * claim sits on the delivered order — the only state the domain admits one from —
 * with the record a claim is required to carry.
 */
const refundClaimForShopA = async (): Promise<void> => {
  const order = await prisma.manufacturingOrder.findUnique({
    where: { id: 'verify_order_delivered' },
    select: {
      id: true,
      buyerId: true,
      snapshot: { select: { currency: true } },
    },
  });
  if (order === null) return;

  const claimedAt = hoursAgo(9);

  await prisma.refund.upsert({
    where: { id: 'mfrfix_refund_open' },
    update: {},
    create: {
      id: 'mfrfix_refund_open',
      orderId: order.id,
      requestedById: order.buyerId,
      status: 'requested',
      reason: 'failed_quality_check',
      currency: order.snapshot?.currency ?? 'USD',
      requestedAmountMinor: 24_000n,
      description:
        'Eleven boards out of 120 failed our incoming inspection: the RF pair reads 61 ohm against the 50 ohm on the specification.',
      createdAt: claimedAt,
    },
  });

  // A claim carries a record, which is the rule on both sides.
  await prisma.evidence.upsert({
    where: { id: 'mfrfix_refund_record' },
    update: {},
    create: {
      id: 'mfrfix_refund_record',
      contextKind: 'refund',
      kind: 'measurement_data',
      title: 'Incoming inspection sheet, 11 of 120 boards out of tolerance',
      refundId: 'mfrfix_refund_open',
      submittedById: order.buyerId,
      capturedAt: claimedAt,
    },
  });
};

const main = async (): Promise<void> => {
  await boardRequest();
  await printedRequest();
  await stockForShopA();
  await liveOrder();
  await notificationsForShopA();
  await refundClaimForShopA();
  process.stdout.write(
    'manufacturer fixtures: two unanswered requests in shop A’s inbox — one board with assembly, one printed housing — stock that covers one line, is short on another and misses two, one funded order in production, three notifications for its member, and one unanswered refund claim\n',
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
