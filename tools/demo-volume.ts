/**
 * A shop with a working week behind it.
 *
 * The seed and the two fixture sets build the scenarios the tests need: exact,
 * few, and each one there to be asserted against. That is right for a test and
 * wrong for a review — a dashboard drawn for a shop with two requests and four
 * orders reads as a screen that was never finished, whoever is looking.
 *
 * So this lays a body of ordinary work on top: requests in every state of being
 * answered, orders spread across the production stages, stock at every level,
 * payouts held and released, and a log with something in it from this morning.
 * Every row goes through the same tables the product writes, so every figure on
 * every screen is still a query and not a fixture.
 *
 * It runs for the review environment and for the demo deployment, never for the
 * harnesses — their counts are assertions, and this would break them.
 *
 * Safe to run again: every row is keyed on an id of its own.
 */
import { PrismaClient, type OrderStatus, type RfqDeclineReason } from '@prisma/client';

const prisma = new PrismaClient();

const BUYER = 'seed_user_buyer';
const SHOP = 'seed_mfr_a';
const OTHER_SHOP = 'seed_mfr_b';

const hoursAgo = (hours: number): Date => new Date(Date.now() - hours * 60 * 60 * 1_000);
const daysAhead = (days: number): Date => new Date(Date.now() + days * 24 * 60 * 60 * 1_000);

const STAGES = [
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

/** How far through the ten stages an order of each status has got. */
const REACHED: Readonly<Partial<Record<OrderStatus, number>>> = {
  confirmed: 2,
  in_production: 5,
  quality_check: 6,
  ready_to_ship: 7,
  shipped: 8,
  delivered: 9,
  completed: 10,
};

interface WorkSpec {
  readonly key: string;
  readonly productName: string;
  readonly kind: 'pcb' | 'module_3d' | 'full_product';
  readonly method: string;
  readonly quantity: number;
  readonly unitPriceMinor: number;
  readonly leadTimeDays: number;
  readonly openedHoursAgo: number;
  /** What has happened to it so far. */
  readonly state:
    | { readonly stage: 'routed' }
    | { readonly stage: 'viewed' }
    | { readonly stage: 'declined'; readonly reason: RfqDeclineReason }
    | { readonly stage: 'quoted' }
    | { readonly stage: 'order'; readonly status: OrderStatus }
    | { readonly stage: 'lost' };
}

/**
 * A week of a busy shop's inbox and line.
 *
 * The mix is deliberate: more requests than quotes, more quotes than orders,
 * orders spread across the stages rather than bunched at one, and two requests
 * that went nowhere — one declined and one lost to another shop — because an
 * inbox where everything converts is not one anybody would recognise.
 */
const WORK: readonly WorkSpec[] = [
  { key: 'lidar', productName: 'LiDAR Interface Board', kind: 'pcb', method: 'PCB fabrication + SMT assembly', quantity: 320, unitPriceMinor: 4_180, leadTimeDays: 18, openedHoursAgo: 3, state: { stage: 'routed' } },
  { key: 'imu', productName: 'IMU Carrier Rev B', kind: 'pcb', method: 'PCB fabrication + SMT assembly', quantity: 180, unitPriceMinor: 2_640, leadTimeDays: 15, openedHoursAgo: 7, state: { stage: 'routed' } },
  { key: 'batterytray', productName: 'Battery Tray, printed', kind: 'module_3d', method: 'SLS printing', quantity: 240, unitPriceMinor: 1_980, leadTimeDays: 12, openedHoursAgo: 11, state: { stage: 'viewed' } },
  { key: 'esc', productName: 'ESC Power Stage v2', kind: 'pcb', method: 'PCB fabrication + SMT assembly', quantity: 500, unitPriceMinor: 5_240, leadTimeDays: 21, openedHoursAgo: 26, state: { stage: 'viewed' } },
  { key: 'antenna', productName: 'Antenna Mount Bracket', kind: 'module_3d', method: 'CNC machining', quantity: 150, unitPriceMinor: 3_100, leadTimeDays: 10, openedHoursAgo: 30, state: { stage: 'quoted' } },
  { key: 'powerhub', productName: 'Power Distribution Hub', kind: 'full_product', method: 'PCB fabrication + assembly', quantity: 260, unitPriceMinor: 6_450, leadTimeDays: 24, openedHoursAgo: 34, state: { stage: 'quoted' } },
  { key: 'telemetry', productName: 'Telemetry Radio Module', kind: 'pcb', method: 'PCB fabrication + SMT assembly', quantity: 400, unitPriceMinor: 3_720, leadTimeDays: 19, openedHoursAgo: 52, state: { stage: 'quoted' } },
  { key: 'gimbalarm', productName: 'Gimbal Arm, machined', kind: 'module_3d', method: 'CNC machining', quantity: 120, unitPriceMinor: 7_800, leadTimeDays: 14, openedHoursAgo: 58, state: { stage: 'declined', reason: 'capacity_unavailable' } },
  { key: 'sensorring', productName: 'Sensor Ring PCB', kind: 'pcb', method: 'PCB fabrication', quantity: 600, unitPriceMinor: 1_450, leadTimeDays: 16, openedHoursAgo: 74, state: { stage: 'lost' } },
  { key: 'chargedock', productName: 'Charging Dock Controller', kind: 'full_product', method: 'PCB fabrication + assembly', quantity: 300, unitPriceMinor: 5_960, leadTimeDays: 22, openedHoursAgo: 96, state: { stage: 'order', status: 'confirmed' } },
  { key: 'motorbrkt', productName: 'Motor Bracket, printed', kind: 'module_3d', method: 'SLS printing', quantity: 480, unitPriceMinor: 1_240, leadTimeDays: 11, openedHoursAgo: 120, state: { stage: 'order', status: 'in_production' } },
  { key: 'flightctl', productName: 'Flight Controller F7 Pro', kind: 'pcb', method: 'PCB fabrication + SMT assembly', quantity: 350, unitPriceMinor: 8_150, leadTimeDays: 20, openedHoursAgo: 168, state: { stage: 'order', status: 'in_production' } },
  { key: 'camgimbal', productName: 'Camera Gimbal Controller', kind: 'pcb', method: 'PCB fabrication + SMT assembly', quantity: 220, unitPriceMinor: 6_700, leadTimeDays: 18, openedHoursAgo: 220, state: { stage: 'order', status: 'quality_check' } },
  { key: 'landinggear', productName: 'Landing Gear Set', kind: 'module_3d', method: 'CNC machining', quantity: 200, unitPriceMinor: 4_450, leadTimeDays: 13, openedHoursAgo: 264, state: { stage: 'order', status: 'ready_to_ship' } },
  { key: 'radiolink', productName: 'Radio Link Board', kind: 'pcb', method: 'PCB fabrication + SMT assembly', quantity: 380, unitPriceMinor: 3_980, leadTimeDays: 17, openedHoursAgo: 320, state: { stage: 'order', status: 'shipped' } },
  { key: 'payloadbay', productName: 'Payload Bay Assembly', kind: 'full_product', method: 'PCB fabrication + assembly', quantity: 160, unitPriceMinor: 9_240, leadTimeDays: 26, openedHoursAgo: 400, state: { stage: 'order', status: 'delivered' } },
  { key: 'gpsmodule', productName: 'GPS Module Carrier', kind: 'pcb', method: 'PCB fabrication + SMT assembly', quantity: 450, unitPriceMinor: 2_890, leadTimeDays: 15, openedHoursAgo: 520, state: { stage: 'order', status: 'completed' } },
  { key: 'servohub', productName: 'Servo Hub Board', kind: 'pcb', method: 'PCB fabrication + SMT assembly', quantity: 280, unitPriceMinor: 3_360, leadTimeDays: 16, openedHoursAgo: 640, state: { stage: 'order', status: 'completed' } },
];

const id = (kind: string, key: string): string => `demo_${kind}_${key}`;

const upsertProduct = async (spec: WorkSpec, at: Date): Promise<void> => {
  await prisma.product.upsert({
    where: { id: id('product', spec.key) },
    update: {},
    create: {
      id: id('product', spec.key),
      ownerId: BUYER,
      name: spec.productName,
      availability: 'available',
      createdAt: at,
    },
  });

  await prisma.fileRef.upsert({
    where: { id: id('file', spec.key) },
    update: {},
    create: {
      id: id('file', spec.key),
      name: `${spec.key}-package.zip`,
      contentHash: `demohash-${spec.key}-${spec.quantity}`,
      byteSize: 400_000 + spec.quantity * 37,
      uploadedById: BUYER,
      uploadedAt: at,
    },
  });
  await prisma.productFile.upsert({
    where: {
      productId_fileId: { productId: id('product', spec.key), fileId: id('file', spec.key) },
    },
    update: {},
    create: { productId: id('product', spec.key), fileId: id('file', spec.key) },
  });

  await prisma.manufacturingPackage.upsert({
    where: { id: id('package', spec.key) },
    update: {},
    create: {
      id: id('package', spec.key),
      productId: id('product', spec.key),
      kind: spec.kind,
      createdAt: at,
    },
  });
  await prisma.packageFile.upsert({
    where: {
      packageId_fileId: { packageId: id('package', spec.key), fileId: id('file', spec.key) },
    },
    update: {},
    create: { packageId: id('package', spec.key), fileId: id('file', spec.key) },
  });

  await prisma.manufacturingRequirements.upsert({
    where: { id: id('requirements', spec.key) },
    update: { lockedAt: at },
    create: {
      id: id('requirements', spec.key),
      packageId: id('package', spec.key),
      version: 1,
      quantity: spec.quantity,
      material: spec.kind === 'module_3d' ? 'PA12 nylon' : 'FR-4 TG150',
      manufacturingMethod: spec.method,
      tolerance: '+/-0.15mm',
      leadTimeDays: spec.leadTimeDays,
      shippingRequirement: 'Courier, tracked, DAP Dhaka',
      assembly: spec.kind === 'module_3d' ? 'none' : 'smt',
      qualityCheckRequirement: 'Inspection report with the shipment',
      substitutionPolicy: 'with_approval',
      lockedAt: at,
      createdAt: at,
    },
  });
};

const upsertRequest = async (spec: WorkSpec, at: Date): Promise<void> => {
  await prisma.rfq.upsert({
    where: { id: id('rfq', spec.key) },
    update: {},
    create: {
      id: id('rfq', spec.key),
      buyerId: BUYER,
      packageId: id('package', spec.key),
      requirementsId: id('requirements', spec.key),
      status: spec.state.stage === 'order' ? 'closed' : 'submitted',
      quantity: spec.quantity,
      currency: 'USD',
      shipToLine1: '14 Gulshan Avenue',
      shipToCity: 'Dhaka',
      shipToCountryCode: 'BD',
      responseDeadline: daysAhead(4),
      createdAt: at,
    },
  });

  const lines = [
    { reference: 'U1', componentName: 'STM32G431 MCU', manufacturerPartNumber: 'STM32G431CBT6', sku: 'MCU-STM32G431', quantityRequired: 1 },
    { reference: 'C3', componentName: 'Bulk capacitor 470uF 100V', manufacturerPartNumber: 'EEU-FR1J471', sku: 'CAP-470U100V', quantityRequired: 2 },
    { reference: 'R7', componentName: 'SMD Resistor 10k 0402', manufacturerPartNumber: 'RC0402FR-0710KL', sku: 'RES-10K-0402', quantityRequired: 8 },
  ];
  for (const line of lines) {
    await prisma.rfqItem.upsert({
      where: { rfqId_reference: { rfqId: id('rfq', spec.key), reference: line.reference } },
      update: {},
      create: { ...line, id: `${id('item', spec.key)}_${line.reference.toLowerCase()}`, rfqId: id('rfq', spec.key) },
    });
  }

  const recipientStatus =
    spec.state.stage === 'routed'
      ? 'routed'
      : spec.state.stage === 'viewed'
        ? 'viewed'
        : spec.state.stage === 'declined'
          ? 'declined'
          : 'quoted';

  await prisma.rfqRecipient.upsert({
    where: {
      rfqId_manufacturerId: { rfqId: id('rfq', spec.key), manufacturerId: SHOP },
    },
    update: { status: recipientStatus },
    create: {
      id: id('recipient', spec.key),
      rfqId: id('rfq', spec.key),
      manufacturerId: SHOP,
      status: recipientStatus,
      viewedAt: spec.state.stage === 'routed' ? null : at,
      declinedAt: spec.state.stage === 'declined' ? at : null,
      declineReason: spec.state.stage === 'declined' ? spec.state.reason : null,
      expiresAt: daysAhead(5),
      createdAt: at,
    },
  });

  // A request nobody else was asked about is not a market. The other shop is on
  // every one of these, and won the one this shop lost.
  await prisma.rfqRecipient.upsert({
    where: {
      rfqId_manufacturerId: { rfqId: id('rfq', spec.key), manufacturerId: OTHER_SHOP },
    },
    update: {},
    create: {
      id: `${id('recipient', spec.key)}_b`,
      rfqId: id('rfq', spec.key),
      manufacturerId: OTHER_SHOP,
      status: spec.state.stage === 'lost' ? 'quoted' : 'routed',
      expiresAt: daysAhead(5),
      createdAt: at,
    },
  });
};

const upsertQuote = async (spec: WorkSpec, at: Date): Promise<void> => {
  const total = spec.unitPriceMinor * spec.quantity;
  const accepted = spec.state.stage === 'order';
  await prisma.quote.upsert({
    where: { id: id('quote', spec.key) },
    update: {},
    create: {
      id: id('quote', spec.key),
      rfqId: id('rfq', spec.key),
      manufacturerId: SHOP,
      version: 1,
      status: accepted ? 'accepted' : spec.state.stage === 'lost' ? 'rejected' : 'submitted',
      quantity: spec.quantity,
      currency: 'USD',
      unitPriceMinor: BigInt(spec.unitPriceMinor),
      totalPriceMinor: BigInt(total),
      shippingEstimateMinor: BigInt(24_000),
      leadTimeDays: spec.leadTimeDays,
      materialProcessNotes: `${spec.method}. Panelised, electrical test on every board.`,
      terms: 'Fifty per cent on acceptance, the balance against the shipping document.',
      expiresAt: daysAhead(9),
      // The database holds the pair together: a quote is accepted only for the
      // request it answers, and the pointer is what says so.
      acceptedForRfqId: accepted ? id('rfq', spec.key) : null,
      acceptedAt: accepted ? at : null,
      submittedAt: at,
      createdAt: at,
    },
  });
};

const upsertOrder = async (spec: WorkSpec, at: Date): Promise<void> => {
  if (spec.state.stage !== 'order') return;
  const status = spec.state.status;
  const total = spec.unitPriceMinor * spec.quantity;
  const platformFee = Math.round(total * 0.07);

  await prisma.payment.upsert({
    where: { id: id('payment', spec.key) },
    update: {},
    create: {
      id: id('payment', spec.key),
      quoteId: id('quote', spec.key),
      buyerId: BUYER,
      status: 'secured',
      method: 'card',
      currency: 'USD',
      goodsAmountMinor: BigInt(total),
      shippingAmountMinor: BigInt(24_000),
      platformFeeMinor: BigInt(platformFee),
      totalChargedMinor: BigInt(total + 24_000),
      securedAt: at,
      createdAt: at,
    },
  });

  await prisma.manufacturingOrder.upsert({
    where: { id: id('order', spec.key) },
    update: { status },
    create: {
      id: id('order', spec.key),
      rfqId: id('rfq', spec.key),
      acceptedQuoteId: id('quote', spec.key),
      buyerId: BUYER,
      manufacturerId: SHOP,
      paymentId: id('payment', spec.key),
      status,
      shipToLine1: '14 Gulshan Avenue',
      shipToCity: 'Dhaka',
      shipToCountryCode: 'BD',
      createdAt: at,
    },
  });

  await prisma.acceptedQuoteSnapshot.upsert({
    where: { orderId: id('order', spec.key) },
    update: {},
    create: {
      orderId: id('order', spec.key),
      quoteId: id('quote', spec.key),
      quoteVersion: 1,
      manufacturerId: SHOP,
      quantity: spec.quantity,
      currency: 'USD',
      unitPriceMinor: BigInt(spec.unitPriceMinor),
      totalPriceMinor: BigInt(total),
      shippingEstimateMinor: BigInt(24_000),
      leadTimeDays: spec.leadTimeDays,
      materialProcessNotes: `${spec.method}. Panelised, electrical test on every board.`,
      terms: 'Fifty per cent on acceptance, the balance against the shipping document.',
      requirements: { quantity: spec.quantity, method: spec.method },
      approvedSubstitutionIds: [],
      checksum: `demochecksum-${spec.key}-${total}`,
      capturedAt: at,
    },
  });

  const reached = REACHED[status] ?? 1;
  for (const [index, key] of STAGES.entries()) {
    const done = index < reached - 1;
    const current = index === reached - 1;
    await prisma.productionStage.upsert({
      where: { orderId_key: { orderId: id('order', spec.key), key } },
      update: { status: done ? 'completed' : current ? 'in_progress' : 'pending' },
      create: {
        id: `${id('stage', spec.key)}_${key}`,
        orderId: id('order', spec.key),
        key,
        position: index + 1,
        status: done ? 'completed' : current ? 'in_progress' : 'pending',
        startedAt: done || current ? at : null,
        completedAt: done ? at : null,
      },
    });
  }

  // The money follows the work: held while it is being made, released once the
  // record says it arrived.
  await prisma.payout.upsert({
    where: { id: id('payout', spec.key) },
    update: {},
    create: {
      id: id('payout', spec.key),
      orderId: id('order', spec.key),
      paymentId: id('payment', spec.key),
      manufacturerId: SHOP,
      status: status === 'completed' ? 'released' : 'pending_release',
      currency: 'USD',
      orderAmountMinor: BigInt(total),
      platformFeeMinor: BigInt(platformFee),
      netAmountMinor: BigInt(total - platformFee),
      releasedAt: status === 'completed' ? at : null,
      createdAt: at,
    },
  });
};

/** Stock at every level, so the health table has something to say. */
const PARTS = [
  { key: 'res10k', partName: 'SMD Resistor 10k 0402', sku: 'RES-10K-0402', category: 'passive', stock: 14_200, reserved: 1_800, threshold: 2_000, moq: 5_000, cost: 2 },
  { key: 'cap100n', partName: 'SMD Capacitor 100nF 0402', sku: 'CAP-100N-0402', category: 'passive', stock: 9_400, reserved: 900, threshold: 2_000, moq: 5_000, cost: 3 },
  { key: 'cap470u', partName: 'Bulk capacitor 470uF 100V', sku: 'CAP-470U100V', category: 'passive', stock: 320, reserved: 40, threshold: 400, moq: 100, cost: 180 },
  { key: 'mosfet', partName: 'N-channel MOSFET 60V 100A', sku: 'FET-BSC010N04', category: 'semiconductor', stock: 210, reserved: 60, threshold: 300, moq: 100, cost: 240 },
  { key: 'drv8353', partName: 'DRV8353 gate driver', sku: 'DRV-8353RS', category: 'semiconductor', stock: 0, reserved: 0, threshold: 150, moq: 100, cost: 610 },
  { key: 'stm32g4', partName: 'STM32G431 MCU', sku: 'MCU-STM32G431', category: 'semiconductor', stock: 640, reserved: 120, threshold: 200, moq: 100, cost: 430 },
  { key: 'imu6dof', partName: 'IMU 6-axis LSM6DSO', sku: 'IMU-LSM6DSO', category: 'sensor', stock: 45, reserved: 30, threshold: 120, moq: 50, cost: 380 },
  { key: 'gpsmod', partName: 'GPS module NEO-M9N', sku: 'GPS-NEOM9N', category: 'module', stock: 0, reserved: 0, threshold: 60, moq: 25, cost: 2_450 },
  { key: 'connjst', partName: 'JST-GH 6-way connector', sku: 'CON-JSTGH6', category: 'connector', stock: 3_800, reserved: 200, threshold: 500, moq: 1_000, cost: 24 },
  { key: 'pa12', partName: 'PA12 nylon powder, 5kg', sku: 'MAT-PA12-5KG', category: 'material', stock: 26, reserved: 8, threshold: 20, moq: 10, cost: 8_900 },
  { key: 'alu6061', partName: 'Aluminium 6061 billet', sku: 'MAT-AL6061', category: 'material', stock: 12, reserved: 6, threshold: 15, moq: 5, cost: 12_400 },
  { key: 'solder', partName: 'SAC305 solder paste, 500g', sku: 'MAT-SAC305', category: 'material', stock: 18, reserved: 4, threshold: 10, moq: 10, cost: 5_600 },
];

const upsertStock = async (): Promise<void> => {
  for (const part of PARTS) {
    // A shop holds one line per part number, so that is the key: the fixtures
    // already stock some of these, and a second row for the same SKU would be a
    // second truth about the same shelf.
    await prisma.inventoryItem.upsert({
      where: { manufacturerId_sku: { manufacturerId: SHOP, sku: part.sku } },
      update: { stockQuantity: part.stock, reservedQuantity: part.reserved },
      create: {
        id: id('inv', part.key),
        manufacturerId: SHOP,
        partName: part.partName,
        sku: part.sku,
        category: part.category,
        stockQuantity: part.stock,
        reservedQuantity: part.reserved,
        lowStockThreshold: part.threshold,
        minimumOrderQuantity: part.moq,
        currency: 'USD',
        unitCostMinor: BigInt(part.cost),
        leadTimeDays: 21,
        updatedAt: hoursAgo(6),
      },
    });
  }
};

/**
 * The log, which is what the activity feed reads.
 *
 * Written straight to the table rather than through the recorder because these
 * are backdated: a feed whose oldest line is "just now" is not a feed.
 */
const logEvent = async (input: {
  readonly key: string;
  readonly kind: string;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly orderId?: string;
  readonly at: Date;
}): Promise<void> => {
  await prisma.domainEvent.upsert({
    where: { id: id('event', input.key) },
    update: {},
    create: {
      id: id('event', input.key),
      kind: input.kind as never,
      actorRole: 'manufacturer',
      actorManufacturerId: SHOP,
      subjectKind: input.subjectKind as never,
      subjectId: input.subjectId,
      orderId: input.orderId ?? null,
      payload: {},
      occurredAt: input.at,
    },
  });
};

const main = async (): Promise<void> => {
  const shop = await prisma.manufacturerProfile.findUnique({ where: { id: SHOP } });
  if (shop === null) {
    throw new Error('the seed has not run: no shop to give this work to');
  }

  for (const spec of WORK) {
    const at = hoursAgo(spec.openedHoursAgo);
    await upsertProduct(spec, at);
    await upsertRequest(spec, at);

    if (spec.state.stage === 'quoted' || spec.state.stage === 'order' || spec.state.stage === 'lost') {
      await upsertQuote(spec, hoursAgo(Math.max(1, spec.openedHoursAgo - 2)));
    }
    await upsertOrder(spec, hoursAgo(Math.max(1, spec.openedHoursAgo - 4)));

    // What the feed will say about it.
    await logEvent({
      key: `${spec.key}_rfq`,
      kind: 'rfq_submitted',
      subjectKind: 'rfq',
      subjectId: id('rfq', spec.key),
      at,
    });
    if (spec.state.stage === 'quoted' || spec.state.stage === 'order' || spec.state.stage === 'lost') {
      await logEvent({
        key: `${spec.key}_quote`,
        kind: 'quote_submitted',
        subjectKind: 'quote',
        subjectId: id('quote', spec.key),
        at: hoursAgo(Math.max(1, spec.openedHoursAgo - 2)),
      });
    }
    if (spec.state.stage === 'order') {
      await logEvent({
        key: `${spec.key}_order`,
        kind: 'order_created',
        subjectKind: 'order',
        subjectId: id('order', spec.key),
        orderId: id('order', spec.key),
        at: hoursAgo(Math.max(1, spec.openedHoursAgo - 4)),
      });
      if ((REACHED[spec.state.status] ?? 0) >= 5) {
        await logEvent({
          key: `${spec.key}_production`,
          kind: 'order_production_started',
          subjectKind: 'order',
          subjectId: id('order', spec.key),
          orderId: id('order', spec.key),
          at: hoursAgo(Math.max(1, spec.openedHoursAgo - 8)),
        });
      }
    }
  }

  await upsertStock();

  const [requests, quotes, orders, parts, payouts] = await Promise.all([
    prisma.rfqRecipient.count({ where: { manufacturerId: SHOP } }),
    prisma.quote.count({ where: { manufacturerId: SHOP } }),
    prisma.manufacturingOrder.count({ where: { manufacturerId: SHOP } }),
    prisma.inventoryItem.count({ where: { manufacturerId: SHOP } }),
    prisma.payout.count({ where: { manufacturerId: SHOP } }),
  ]);
  process.stdout.write(
    `  the demo shop now holds ${requests} requests, ${quotes} quotes, ${orders} orders, ` +
      `${parts} parts and ${payouts} payouts
`,
  );
};

main()
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}
`);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
