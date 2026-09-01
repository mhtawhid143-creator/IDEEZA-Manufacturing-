import { PrismaClient } from '@prisma/client';

/**
 * Deterministic development seed.
 *
 * Every row has a fixed id and is written with upsert, so running the seed
 * repeatedly converges on the same database instead of piling up duplicates.
 * The two append-only tables are written with skipDuplicates, because the
 * database refuses to update them.
 *
 * The scenario is the reference walk-through of the business model: one buyer
 * request routed to two manufacturers, one quote from each, the buyer accepts
 * one, funding is secured, the order is confirmed and production is under way.
 */

const at = (iso: string): Date => new Date(iso);

const T = {
  requirementsLocked: at('2026-05-01T09:00:00.000Z'),
  rfqCreated: at('2026-05-01T09:05:00.000Z'),
  rfqSubmitted: at('2026-05-01T09:30:00.000Z'),
  quoteA: at('2026-05-03T11:00:00.000Z'),
  quoteB: at('2026-05-03T15:20:00.000Z'),
  accepted: at('2026-05-05T08:10:00.000Z'),
  paymentSecured: at('2026-05-05T08:25:00.000Z'),
  orderConfirmed: at('2026-05-05T08:26:00.000Z'),
  productionStarted: at('2026-05-06T07:00:00.000Z'),
  rfqClosed: at('2026-05-05T08:30:00.000Z'),
} as const;

const ID = {
  buyer: 'seed_user_buyer',
  ops: 'seed_user_ops',
  memberA: 'seed_user_member_a',
  memberB: 'seed_user_member_b',
  addressBuyer: 'seed_address_buyer_primary',
  manufacturerA: 'seed_mfr_a',
  manufacturerB: 'seed_mfr_b',
  manufacturerC: 'seed_mfr_c',
  membershipA: 'seed_membership_a',
  membershipB: 'seed_membership_b',
  creatorA: 'seed_user_creator_a',
  creatorB: 'seed_user_creator_b',
  product: 'seed_product_drone',
  productStack: 'seed_product_fpv_stack',
  productSensor: 'seed_product_sensor_hub',
  productBeacon: 'seed_product_legacy_beacon',
  productGimbal: 'seed_product_gimbal',
  fileGimbalGerber: 'seed_file_gimbal_gerber',
  fileGimbalModel: 'seed_file_gimbal_stl',
  bomGimbalU1: 'seed_bom_gimbal_u1',
  fileStackGerber: 'seed_file_stack_gerber',
  fileStackBom: 'seed_file_stack_bom',
  fileSensorStep: 'seed_file_sensor_step',
  fileBeaconGerber: 'seed_file_beacon_gerber',
  bomStackU1: 'seed_bom_stack_u1',
  bomStackU2: 'seed_bom_stack_u2',
  fileGerber: 'seed_file_gerber',
  fileBom: 'seed_file_bom',
  fileStep: 'seed_file_step',
  bomU1: 'seed_bom_u1',
  bomU2: 'seed_bom_u2',
  bomU3: 'seed_bom_u3',
  package: 'seed_package_full',
  requirements: 'seed_requirements_v1',
  rfq: 'seed_rfq_1',
  recipientA: 'seed_recipient_a',
  recipientB: 'seed_recipient_b',
  rfqItemU1: 'seed_rfq_item_u1',
  rfqItemU2: 'seed_rfq_item_u2',
  rfqItemU3: 'seed_rfq_item_u3',
  quoteA: 'seed_quote_a',
  quoteB: 'seed_quote_b',
  quoteItemA1: 'seed_quote_item_a1',
  quoteItemA2: 'seed_quote_item_a2',
  quoteItemB1: 'seed_quote_item_b1',
  substitutionA: 'seed_substitution_a',
  inventoryA1: 'seed_inventory_a1',
  inventoryA2: 'seed_inventory_a2',
  inventoryB1: 'seed_inventory_b1',
  payment: 'seed_payment_1',
  order: 'seed_order_1',
  payout: 'seed_payout_1',
  threadRfq: 'seed_thread_rfq',
  threadOrder: 'seed_thread_order',
  messageRfq: 'seed_message_rfq',
  messageOrder: 'seed_message_order',
  evidenceQuote: 'seed_evidence_quote',
  evidenceQc: 'seed_evidence_qc',
  notification: 'seed_notification_1',
  alertOpen: 'seed_alert_open',
  alertDecided: 'seed_alert_decided',
} as const;

const CURRENCY = 'USD';

const stagePlan = [
  { key: 'quote_accepted', position: 1, status: 'completed' },
  { key: 'payment_secured', position: 2, status: 'completed' },
  { key: 'files_under_review', position: 3, status: 'completed' },
  { key: 'materials_confirmed', position: 4, status: 'completed' },
  { key: 'in_production', position: 5, status: 'in_progress' },
  { key: 'quality_check', position: 6, status: 'pending' },
  { key: 'ready_to_ship', position: 7, status: 'pending' },
  { key: 'shipped', position: 8, status: 'pending' },
  { key: 'delivered', position: 9, status: 'pending' },
  { key: 'completed', position: 10, status: 'pending' },
] as const;

const taskPlan = [
  { stage: 'files_under_review', label: 'Design file review', position: 0, status: 'completed' },
  { stage: 'files_under_review', label: 'Manufacturability review', position: 1, status: 'completed' },
  { stage: 'materials_confirmed', label: 'Inventory check', position: 0, status: 'completed' },
  { stage: 'materials_confirmed', label: 'Substitution approvals applied', position: 1, status: 'completed' },
  { stage: 'in_production', label: 'Bare board fabrication', position: 0, status: 'completed' },
  { stage: 'in_production', label: 'Assembly', position: 1, status: 'in_progress' },
  { stage: 'in_production', label: 'Firmware flashing', position: 2, status: 'pending' },
  { stage: 'in_production', label: 'Enclosure production', position: 3, status: 'pending' },
  { stage: 'quality_check', label: 'Optical inspection', position: 0, status: 'pending' },
  { stage: 'quality_check', label: 'Functional test', position: 1, status: 'pending' },
] as const;

const eventPlan = [
  { id: 'seed_event_1', kind: 'rfq_submitted', subjectKind: 'rfq', subjectId: ID.rfq, role: 'buyer', at: T.rfqSubmitted, order: false },
  { id: 'seed_event_2', kind: 'quote_submitted', subjectKind: 'quote', subjectId: ID.quoteA, role: 'manufacturer', at: T.quoteA, order: false },
  { id: 'seed_event_3', kind: 'quote_submitted', subjectKind: 'quote', subjectId: ID.quoteB, role: 'manufacturer', at: T.quoteB, order: false },
  { id: 'seed_event_4', kind: 'substitution_approved', subjectKind: 'substitution', subjectId: ID.substitutionA, role: 'buyer', at: T.accepted, order: false },
  { id: 'seed_event_5', kind: 'quote_accepted', subjectKind: 'quote', subjectId: ID.quoteA, role: 'buyer', at: T.accepted, order: false },
  { id: 'seed_event_6', kind: 'payment_secured', subjectKind: 'payment', subjectId: ID.payment, role: 'buyer', at: T.paymentSecured, order: false },
  { id: 'seed_event_7', kind: 'order_created', subjectKind: 'order', subjectId: ID.order, role: 'ops_admin', at: T.orderConfirmed, order: true },
  { id: 'seed_event_8', kind: 'order_confirmed', subjectKind: 'order', subjectId: ID.order, role: 'ops_admin', at: T.orderConfirmed, order: true },
  { id: 'seed_event_9', kind: 'order_production_started', subjectKind: 'order', subjectId: ID.order, role: 'manufacturer', at: T.productionStarted, order: true },
] as const;

export const seedDatabase = async (prisma: PrismaClient): Promise<void> => {
  // -- parties ------------------------------------------------------------
  const users = [
    { id: ID.buyer, email: 'buyer@example.test', displayName: 'Nova Robotics (Buyer)', role: 'buyer' as const },
    { id: ID.ops, email: 'ops@example.test', displayName: 'IDEEZA Operations', role: 'ops_admin' as const },
    { id: ID.memberA, email: 'ops@precisioncircuit.test', displayName: 'PrecisionCircuit Operator', role: 'manufacturer' as const },
    { id: ID.memberB, email: 'ops@shenzhenboards.test', displayName: 'Shenzhen Boards Operator', role: 'manufacturer' as const },
    { id: ID.creatorA, email: 'studio@asterlabs.test', displayName: 'Aster Labs', role: 'buyer' as const },
    { id: ID.creatorB, email: 'studio@kitesystems.test', displayName: 'Kite Systems', role: 'buyer' as const },
  ];
  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { email: user.email, displayName: user.displayName, role: user.role },
      create: { ...user, createdAt: T.requirementsLocked },
    });
  }

  await prisma.postalAddress.upsert({
    where: { id: ID.addressBuyer },
    update: {},
    create: {
      id: ID.addressBuyer,
      ownerId: ID.buyer,
      label: 'Head office',
      line1: '20/3, Sector 9',
      city: 'Dhaka',
      postalCode: '1230',
      countryCode: 'BD',
      createdAt: T.requirementsLocked,
    },
  });

  const manufacturers = [
    {
      id: ID.manufacturerA,
      legalName: 'PrecisionCircuit Manufacturing Ltd.',
      displayName: 'PrecisionCircuit Co.',
      addressLine1: '88 Bao An Road',
      city: 'Shenzhen',
      countryCode: 'CN',
      rating: '4.90',
      onTimeDeliveryRate: '0.9800',
      completedOrderCount: 128,
      tagline: 'Boards built right the first time, from prototype to production.',
      about:
        'PrecisionCircuit has been fabricating and assembling boards in Shenzhen since 2009. We run four SMT lines, keep our own stencil shop, and inspect every panel with AOI before it leaves the floor. Most of what we build is low to mid volume for people who need the first article to be right rather than early — instrumentation, robotics, medical sub-assemblies. We would rather ask a question on day one than send a surprise on day ten.',
      phone: '+86 755 8100 4412',
      websiteUrl: 'https://precisioncircuit.example',
      employeeBand: '50-200',
      shippingMethods: ['DHL', 'FedEx', 'UPS', 'Sea freight'],
      facebookUrl: 'https://facebook.com/precisioncircuit',
      twitterUrl: 'https://x.com/precisioncircuit',
      instagramUrl: 'https://instagram.com/precisioncircuit',
      linkedinUrl: 'https://linkedin.com/company/precisioncircuit',
      capability: {
        services: ['fabrication', 'assembly', 'parts_sourcing', 'testing', '3d_enclosure'],
        certifications: ['ISO 9001', 'UL', 'IPC-A-600 Class 3'],
        servedRegions: ['APAC', 'EU', 'NA'],
        minimumOrderQuantity: 5,
        standardLeadTimeDays: 18,
      },
    },
    {
      id: ID.manufacturerB,
      legalName: 'Shenzhen Boards Industrial Co.',
      displayName: 'Shenzhen Boards',
      addressLine1: '12 Longhua Avenue',
      city: 'Shenzhen',
      countryCode: 'CN',
      rating: '4.60',
      onTimeDeliveryRate: '0.9400',
      completedOrderCount: 74,
      tagline: 'High volume fabrication and assembly, quoted the same day.',
      about:
        'Shenzhen Boards runs two fabrication lines and one assembly line, and takes work from fifty pieces upwards. We are at our best on repeat builds where the design has settled and the question is cost and consistency.',
      phone: '+86 755 8399 2210',
      websiteUrl: 'https://shenzhenboards.example',
      employeeBand: '200-500',
      shippingMethods: ['DHL', 'Sea freight'],
      linkedinUrl: 'https://linkedin.com/company/shenzhenboards',
      capability: {
        services: ['fabrication', 'assembly'],
        certifications: ['ISO 9001'],
        servedRegions: ['APAC'],
        minimumOrderQuantity: 50,
        standardLeadTimeDays: 25,
      },
    },
    {
      // A print shop. The platform can send a 3D module to manufacture on its
      // own, so the reference scenario has a manufacturer that only does that.
      id: ID.manufacturerC,
      legalName: 'AdditiveWorks Studio BV',
      displayName: 'AdditiveWorks Studio',
      addressLine1: '8 Hoogstraat',
      city: 'Eindhoven',
      countryCode: 'NL',
      rating: '4.80',
      onTimeDeliveryRate: '0.9600',
      completedOrderCount: 41,
      tagline: 'Enclosures and functional prototypes, printed in the Netherlands.',
      about:
        'AdditiveWorks is a print shop: SLS, MJF and resin, with finishing and assembly in house. We take one-offs and short runs, and we will tell you when a part wants to be machined instead.',
      phone: '+31 40 213 8890',
      websiteUrl: 'https://additiveworks.example',
      employeeBand: '10-50',
      shippingMethods: ['DHL', 'DPD'],
      instagramUrl: 'https://instagram.com/additiveworks',
      linkedinUrl: 'https://linkedin.com/company/additiveworks',
      capability: {
        services: ['3d_enclosure', 'testing'],
        certifications: ['ISO 9001'],
        servedRegions: ['EU', 'NA'],
        minimumOrderQuantity: 1,
        standardLeadTimeDays: 9,
      },
    },
  ];

  for (const manufacturer of manufacturers) {
    const { capability, ...profile } = manufacturer;
    const verified = { ...profile, verifiedAt: T.requirementsLocked };
    await prisma.manufacturerProfile.upsert({
      where: { id: profile.id },
      update: verified,
      create: { ...verified, createdAt: T.requirementsLocked },
    });
    await prisma.manufacturerCapability.upsert({
      where: { manufacturerId: profile.id },
      update: capability,
      create: { manufacturerId: profile.id, ...capability },
    });
  }

  // -- what a buyer reads after the match ---------------------------------
  //
  // The equipment list, the capability sheets and the shop's writing are what
  // the profile shows once a request has reached a shop. They gate nothing —
  // ManufacturerCapability above is what decides that — so they live apart from
  // it, and they are seeded here so the screens draw something true rather than
  // a placeholder with a warning under it.
  const machines = [
    {
      id: 'seed_machine_a1',
      manufacturerId: ID.manufacturerA,
      name: 'SMT placement line',
      process: 'PCB assembly',
      subProcesses: ['Paste printing', 'Placement', 'Reflow'],
      tolerance: '0201 components, plus or minus 0.05 mm placement',
      turnaroundTime: '1-2 days',
      position: 0,
    },
    {
      id: 'seed_machine_a2',
      manufacturerId: ID.manufacturerA,
      name: 'AOI station',
      process: 'Inspection',
      subProcesses: ['Solder joint', 'Polarity', 'Presence'],
      tolerance: 'Detects down to 0201',
      turnaroundTime: 'Same day',
      position: 1,
    },
    {
      id: 'seed_machine_a3',
      manufacturerId: ID.manufacturerA,
      name: 'X-ray inspection',
      process: 'Inspection',
      subProcesses: ['BGA voiding', 'QFN wetting'],
      tolerance: 'Voiding measured to 1%',
      turnaroundTime: 'Same day',
      position: 2,
    },
    {
      id: 'seed_machine_a4',
      manufacturerId: ID.manufacturerA,
      name: 'Stencil cutter',
      process: 'Tooling',
      subProcesses: ['Laser cut', 'Electropolish'],
      tolerance: 'Aperture plus or minus 0.01 mm',
      turnaroundTime: 'Same day',
      position: 3,
    },
    {
      id: 'seed_machine_b1',
      manufacturerId: ID.manufacturerB,
      name: 'SMT placement line',
      process: 'PCB assembly',
      subProcesses: ['Placement', 'Reflow'],
      tolerance: '0402 components',
      turnaroundTime: '3-5 days',
      position: 0,
    },
    {
      id: 'seed_machine_c1',
      manufacturerId: ID.manufacturerC,
      name: 'SLS printer',
      process: 'Additive manufacturing',
      subProcesses: ['Nylon sintering', 'Depowdering', 'Bead blasting'],
      tolerance: 'plus or minus 0.3%, 0.3 mm minimum',
      turnaroundTime: '2-3 days',
      position: 0,
    },
    {
      id: 'seed_machine_c2',
      manufacturerId: ID.manufacturerC,
      name: 'Resin printer',
      process: 'Additive manufacturing',
      subProcesses: ['SLA', 'Post-cure'],
      tolerance: 'plus or minus 0.1 mm',
      turnaroundTime: '1-2 days',
      position: 1,
    },
    {
      id: 'seed_machine_c3',
      manufacturerId: ID.manufacturerC,
      name: '5-axis CNC mill',
      process: 'CNC machining',
      subProcesses: ['Milling', 'Turning', 'Drilling', 'Tapping'],
      tolerance: '0.1% with a 0.025 mm minimum',
      turnaroundTime: '7-10 days',
      position: 2,
    },
  ];
  for (const machine of machines) {
    await prisma.shopMachine.upsert({
      where: { id: machine.id },
      update: machine,
      create: { ...machine, createdAt: T.requirementsLocked },
    });
  }

  const sheets = [
    {
      id: 'seed_sheet_a_pcb',
      manufacturerId: ID.manufacturerA,
      kind: 'pcb_fabrication' as const,
      title: 'PCB fabrication',
      position: 0,
      parameters: [
        { label: 'Layer count', values: ['1-16 layers'] },
        { label: 'Minimum hole size', values: ['0.2 mm'] },
        { label: 'Surface finish', values: ['ENIG', 'HASL', 'OSP'] },
        { label: 'Base material', values: ['FR-4', 'High-Tg FR-4', 'Rogers 4350B'] },
        { label: 'Copper weight', values: ['1 oz', '2 oz'] },
        { label: 'Impedance control', values: ['plus or minus 7%'] },
        { label: 'Build time', values: ['24-48 hours'] },
      ],
    },
    {
      id: 'seed_sheet_a_pcba',
      manufacturerId: ID.manufacturerA,
      kind: 'pcb_assembly' as const,
      title: 'PCB assembly',
      position: 1,
      parameters: [
        { label: 'Smallest placement', values: ['0201'] },
        { label: 'Sides', values: ['Single', 'Double'] },
        { label: 'Inspection', values: ['AOI', 'X-ray', 'Functional test'] },
        { label: 'Conformal coating', values: ['Acrylic', 'Silicone'] },
        { label: 'Build time', values: ['24-48 hours'] },
      ],
    },
    {
      id: 'seed_sheet_c_print',
      manufacturerId: ID.manufacturerC,
      kind: 'printing_3d' as const,
      title: '3D printing',
      position: 0,
      parameters: [
        { label: 'Technology', values: ['SLS', 'MJF', 'Resin'] },
        { label: 'Material', values: ['PA12', 'PA11', 'TPU'] },
        { label: 'Maximum part', values: ['340 x 340 x 600 mm'] },
        { label: 'Layer height', values: ['60-120 microns'] },
        { label: 'Finishing', values: ['Bead blast', 'Dye', 'Vapour smooth'] },
        { label: 'Build time', values: ['48-72 hours'] },
      ],
    },
  ];
  for (const sheet of sheets) {
    const { parameters, ...row } = sheet;
    await prisma.shopCapabilitySheet.upsert({ where: { id: row.id }, update: row, create: row });
    await prisma.shopCapabilityParameter.deleteMany({ where: { sheetId: row.id } });
    await prisma.shopCapabilityParameter.createMany({
      data: parameters.map((parameter, index) => ({
        id: row.id + '_p' + String(index),
        sheetId: row.id,
        label: parameter.label,
        values: parameter.values,
        position: index,
      })),
    });
  }

  const articles = [
    {
      id: 'seed_article_a1',
      manufacturerId: ID.manufacturerA,
      title: 'What we check before a board goes on the line',
      category: 'Quality',
      tags: ['AOI', 'process'],
      body: 'Every job that reaches our floor gets the same first hour: the gerbers are opened next to the assembly drawing, the stack-up is checked against the impedance the buyer asked for, and the bill of materials is matched line by line against what is on the shelf.\n\nMost problems are found in that hour, and they are cheap there. The same problem found after the stencil is cut is a week and a scrapped panel.',
      status: 'published' as const,
      rejectReason: null,
      publishedAt: T.requirementsLocked,
    },
    {
      id: 'seed_article_a2',
      manufacturerId: ID.manufacturerA,
      title: 'Why we ask about your test plan before quoting',
      category: 'Process',
      tags: ['testing'],
      body: 'A board that cannot be tested is a board nobody can accept. We ask early because the answer changes the quote: test points, a fixture, or a functional rig are all different numbers.',
      status: 'in_review' as const,
      rejectReason: null,
      publishedAt: null,
    },
    {
      id: 'seed_article_a3',
      manufacturerId: ID.manufacturerA,
      title: 'Ten reasons to choose us over everyone else',
      category: null,
      tags: [],
      body: 'A draft that reads as advertising rather than as something a buyer learns from.',
      status: 'rejected' as const,
      rejectReason:
        'Reads as advertising. Buyers use the blog to judge competence, so it has to teach them something.',
      publishedAt: null,
    },
  ];
  for (const article of articles) {
    await prisma.shopArticle.upsert({
      where: { id: article.id },
      update: article,
      create: { ...article, createdAt: T.requirementsLocked },
    });
  }

  const memberships = [
    { id: ID.membershipA, manufacturerId: ID.manufacturerA, userId: ID.memberA },
    { id: ID.membershipB, manufacturerId: ID.manufacturerB, userId: ID.memberB },
  ];
  for (const membership of memberships) {
    await prisma.manufacturerMember.upsert({
      where: { id: membership.id },
      update: {},
      create: { ...membership, isOwner: true, createdAt: T.requirementsLocked },
    });
  }

  // -- product, files, bill of materials, package, requirements -----------
  await prisma.product.upsert({
    where: { id: ID.product },
    update: { name: 'Complete Drone System', availability: 'available' },
    create: {
      id: ID.product,
      ownerId: ID.buyer,
      name: 'Complete Drone System',
      availability: 'available',
      createdAt: T.requirementsLocked,
    },
  });

  // -- the catalogue behind the favourites list --------------------------
  const catalogue = [
    {
      id: ID.productStack,
      ownerId: ID.creatorA,
      name: 'FPV Flight Stack F7',
      availability: 'available' as const,
      files: [
        { id: ID.fileStackGerber, name: 'fpv-stack-gerber.zip', contentHash: 'seedhash-stack-gerber', byteSize: 391_442 },
        { id: ID.fileStackBom, name: 'fpv-stack-bom.csv', contentHash: 'seedhash-stack-bom', byteSize: 9_112 },
      ],
      bom: [
        { id: ID.bomStackU1, reference: 'U1', componentName: 'STM32F722 MCU', manufacturerPartNumber: 'STM32F722RET6', sku: 'MCU-STM32F722', quantityPerUnit: 1 },
        { id: ID.bomStackU2, reference: 'U2', componentName: 'ICM-42688 IMU', manufacturerPartNumber: 'ICM-42688-P', sku: 'SENS-ICM42688', quantityPerUnit: 1 },
      ],
    },
    {
      id: ID.productSensor,
      ownerId: ID.creatorB,
      name: 'Industrial Sensor Hub',
      availability: 'available' as const,
      files: [
        { id: ID.fileSensorStep, name: 'sensor-hub-enclosure.step', contentHash: 'seedhash-sensor-step', byteSize: 2_114_880 },
      ],
      bom: [],
    },
    {
      // A product with boards and printed parts in it: the 3D module can be sent
      // to manufacture on its own, which is what this product exercises.
      id: ID.productGimbal,
      ownerId: ID.creatorA,
      name: 'Gimbal Damper Kit',
      availability: 'available' as const,
      files: [
        {
          id: ID.fileGimbalGerber,
          name: 'gimbal-control-gerber.zip',
          contentHash: 'seedhash-gimbal-gerber',
          byteSize: 288_140,
        },
        {
          id: ID.fileGimbalModel,
          name: 'gimbal-damper.stl',
          contentHash: 'seedhash-gimbal-stl',
          byteSize: 1_902_336,
        },
      ],
      bom: [
        {
          id: ID.bomGimbalU1,
          reference: 'U1',
          componentName: 'MP6500 stepper driver',
          manufacturerPartNumber: 'MP6500GU',
          sku: 'DRV-MP6500',
          quantityPerUnit: 2,
        },
      ],
    },
    {
      id: ID.productBeacon,
      ownerId: ID.creatorB,
      name: 'Legacy Asset Beacon',
      availability: 'unavailable' as const,
      files: [
        { id: ID.fileBeaconGerber, name: 'beacon-gerber-rev-b.zip', contentHash: 'seedhash-beacon-gerber', byteSize: 204_881 },
      ],
      bom: [],
    },
  ];
  for (const entry of catalogue) {
    await prisma.product.upsert({
      where: { id: entry.id },
      update: { name: entry.name, availability: entry.availability },
      create: {
        id: entry.id,
        ownerId: entry.ownerId,
        name: entry.name,
        availability: entry.availability,
        createdAt: T.requirementsLocked,
      },
    });
    for (const file of entry.files) {
      await prisma.fileRef.upsert({
        where: { id: file.id },
        update: {},
        create: { ...file, revision: 1, uploadedById: entry.ownerId, uploadedAt: T.requirementsLocked },
      });
      await prisma.productFile.upsert({
        where: { productId_fileId: { productId: entry.id, fileId: file.id } },
        update: {},
        create: { productId: entry.id, fileId: file.id },
      });
    }
    for (const line of entry.bom) {
      await prisma.bomLine.upsert({
        where: { id: line.id },
        update: {},
        create: { ...line, productId: entry.id, footprint: 'SMD' },
      });
    }
  }

  // Everything the buyer has kept, including the product whose creator has
  // withdrawn it: the card has to be able to show that state.
  // The mixed product is not a favourite: it exists to be sent to manufacture
  // directly, and the favourites scenario stays as approved.
  for (const [index, productId] of [ID.product, ID.productStack, ID.productSensor, ID.productBeacon].entries()) {
    await prisma.productFavorite.upsert({
      where: { userId_productId: { userId: ID.buyer, productId } },
      update: {},
      create: {
        userId: ID.buyer,
        productId,
        createdAt: new Date(T.requirementsLocked.getTime() + index * 60_000),
      },
    });
  }

  const files = [
    { id: ID.fileGerber, name: 'main-board-gerber.zip', contentHash: 'seedhash-gerber', byteSize: 482_133 },
    { id: ID.fileBom, name: 'main-board-bom.csv', contentHash: 'seedhash-bom', byteSize: 12_004 },
    { id: ID.fileStep, name: 'enclosure.step', contentHash: 'seedhash-step', byteSize: 1_284_552 },
  ];
  for (const file of files) {
    await prisma.fileRef.upsert({
      where: { id: file.id },
      update: {},
      create: { ...file, revision: 1, uploadedById: ID.buyer, uploadedAt: T.requirementsLocked },
    });
    await prisma.productFile.upsert({
      where: { productId_fileId: { productId: ID.product, fileId: file.id } },
      update: {},
      create: { productId: ID.product, fileId: file.id },
    });
  }

  const bomLines = [
    { id: ID.bomU1, reference: 'U1', componentName: 'STM32F405 MCU', manufacturerPartNumber: 'STM32F405RGT6', sku: 'MCU-STM32F405', quantityPerUnit: 1 },
    { id: ID.bomU2, reference: 'U2', componentName: 'BMP388 barometer', manufacturerPartNumber: 'BMP388', sku: 'SENS-BMP388', quantityPerUnit: 1 },
    { id: ID.bomU3, reference: 'U3', componentName: 'SiK telemetry radio 915MHz', manufacturerPartNumber: 'SIK-915-V3', sku: 'RF-SIK915', quantityPerUnit: 1 },
  ];
  for (const line of bomLines) {
    await prisma.bomLine.upsert({
      where: { id: line.id },
      update: {},
      create: { ...line, productId: ID.product, footprint: 'SMD' },
    });
  }

  await prisma.manufacturingPackage.upsert({
    where: { id: ID.package },
    update: { kind: 'full_product' },
    create: {
      id: ID.package,
      productId: ID.product,
      kind: 'full_product',
      createdAt: T.requirementsLocked,
    },
  });

  for (const file of files) {
    await prisma.packageFile.upsert({
      where: { packageId_fileId: { packageId: ID.package, fileId: file.id } },
      update: {},
      create: { packageId: ID.package, fileId: file.id },
    });
  }
  for (const line of bomLines) {
    await prisma.packageBomLine.upsert({
      where: { packageId_bomLineId: { packageId: ID.package, bomLineId: line.id } },
      update: {},
      create: { packageId: ID.package, bomLineId: line.id },
    });
  }

  await prisma.manufacturingRequirements.upsert({
    where: { id: ID.requirements },
    update: {},
    create: {
      id: ID.requirements,
      packageId: ID.package,
      version: 1,
      quantity: 500,
      material: 'FR-4 TG135',
      manufacturingMethod: 'PCB fabrication + SMT assembly + SLA enclosure',
      tolerance: 'Board outline +/-0.2mm',
      leadTimeDays: 18,
      shippingRequirement: 'Courier, tracked, DAP Dhaka',
      assembly: 'smt',
      qualityCheckRequirement: 'Optical inspection on 100%, functional test on 10% sample',
      substitutionPolicy: 'with_approval',
      notes: 'ENIG finish required. Panelisation left to the manufacturer.',
      lockedAt: T.rfqSubmitted,
      createdAt: T.requirementsLocked,
    },
  });

  for (const file of files) {
    await prisma.requirementsFile.upsert({
      where: { requirementsId_fileId: { requirementsId: ID.requirements, fileId: file.id } },
      update: {},
      create: { requirementsId: ID.requirements, fileId: file.id },
    });
  }

  // -- one request, routed to two manufacturers ---------------------------
  await prisma.rfq.upsert({
    where: { id: ID.rfq },
    update: { status: 'closed', closedAt: T.rfqClosed },
    create: {
      id: ID.rfq,
      buyerId: ID.buyer,
      packageId: ID.package,
      requirementsId: ID.requirements,
      status: 'closed',
      quantity: 500,
      volumeTiers: [100, 500, 1000],
      targetPriceMinor: 380_000n,
      currency: CURRENCY,
      shipToLine1: '20/3, Sector 9',
      shipToCity: 'Dhaka',
      shipToPostalCode: '1230',
      shipToCountryCode: 'BD',
      neededBy: at('2026-06-15T00:00:00.000Z'),
      responseDeadline: at('2026-05-04T00:00:00.000Z'),
      submittedAt: T.rfqSubmitted,
      closedAt: T.rfqClosed,
      createdAt: T.rfqCreated,
    },
  });

  const recipients = [
    { id: ID.recipientA, manufacturerId: ID.manufacturerA, quotedAt: T.quoteA },
    { id: ID.recipientB, manufacturerId: ID.manufacturerB, quotedAt: T.quoteB },
  ];
  for (const recipient of recipients) {
    await prisma.rfqRecipient.upsert({
      where: { rfqId_manufacturerId: { rfqId: ID.rfq, manufacturerId: recipient.manufacturerId } },
      update: { status: 'quoted', quotedAt: recipient.quotedAt },
      create: {
        id: recipient.id,
        rfqId: ID.rfq,
        manufacturerId: recipient.manufacturerId,
        status: 'quoted',
        viewedAt: T.rfqSubmitted,
        quotedAt: recipient.quotedAt,
        createdAt: T.rfqSubmitted,
      },
    });
  }

  const rfqItems = [
    { id: ID.rfqItemU1, reference: 'U1', componentName: 'STM32F405 MCU', manufacturerPartNumber: 'STM32F405RGT6', sku: 'MCU-STM32F405' },
    { id: ID.rfqItemU2, reference: 'U2', componentName: 'BMP388 barometer', manufacturerPartNumber: 'BMP388', sku: 'SENS-BMP388' },
    { id: ID.rfqItemU3, reference: 'U3', componentName: 'SiK telemetry radio 915MHz', manufacturerPartNumber: 'SIK-915-V3', sku: 'RF-SIK915' },
  ];
  for (const item of rfqItems) {
    await prisma.rfqItem.upsert({
      where: { rfqId_reference: { rfqId: ID.rfq, reference: item.reference } },
      update: {},
      create: { ...item, id: item.id, rfqId: ID.rfq, quantityRequired: 500 },
    });
  }

  // -- inventory (manufacturer owned) ------------------------------------
  const inventory = [
    { id: ID.inventoryA1, manufacturerId: ID.manufacturerA, partName: 'STM32F405 MCU', sku: 'MCU-STM32F405', category: 'Electronics', stockQuantity: 1_200, reservedQuantity: 500, unitCostMinor: 620n, leadTimeDays: 7 },
    { id: ID.inventoryA2, manufacturerId: ID.manufacturerA, partName: 'SiK telemetry radio 868MHz', sku: 'RF-SIK868', category: 'Electronics', stockQuantity: 300, reservedQuantity: 0, unitCostMinor: 1_850n, leadTimeDays: 10 },
    { id: ID.inventoryB1, manufacturerId: ID.manufacturerB, partName: 'STM32F405 MCU', sku: 'MCU-STM32F405', category: 'Electronics', stockQuantity: 400, reservedQuantity: 0, unitCostMinor: 660n, leadTimeDays: 12 },
  ];
  for (const item of inventory) {
    await prisma.inventoryItem.upsert({
      where: { manufacturerId_sku: { manufacturerId: item.manufacturerId, sku: item.sku } },
      update: { stockQuantity: item.stockQuantity, reservedQuantity: item.reservedQuantity },
      create: {
        ...item,
        currency: CURRENCY,
        lowStockThreshold: 50,
        minimumOrderQuantity: 10,
        storageLocation: 'Warehouse A',
        enabledForMatching: true,
        lastCountedAt: T.rfqSubmitted,
      },
    });
  }

  // -- two competing quotes ----------------------------------------------
  await prisma.quote.upsert({
    where: { id: ID.quoteA },
    update: { status: 'accepted', acceptedForRfqId: ID.rfq, acceptedAt: T.accepted },
    create: {
      id: ID.quoteA,
      rfqId: ID.rfq,
      manufacturerId: ID.manufacturerA,
      status: 'accepted',
      version: 1,
      acceptedForRfqId: ID.rfq,
      quantity: 500,
      currency: CURRENCY,
      unitPriceMinor: 790n,
      totalPriceMinor: 395_000n,
      shippingEstimateMinor: 2_800n,
      toolingSetupCostMinor: 12_000n,
      leadTimeDays: 24,
      materialProcessNotes: 'FR-4 TG135, ENIG finish, IPC Class 2 workmanship.',
      warrantyTerms: '90 days against manufacturing defects.',
      terms: 'Funds secured through the platform. Substitution of U3 requires buyer approval.',
      expiresAt: at('2026-05-31T00:00:00.000Z'),
      submittedAt: T.quoteA,
      acceptedAt: T.accepted,
      createdAt: T.quoteA,
    },
  });

  await prisma.quote.upsert({
    where: { id: ID.quoteB },
    update: { status: 'rejected', acceptedForRfqId: null },
    create: {
      id: ID.quoteB,
      rfqId: ID.rfq,
      manufacturerId: ID.manufacturerB,
      status: 'rejected',
      version: 1,
      quantity: 500,
      currency: CURRENCY,
      unitPriceMinor: 740n,
      totalPriceMinor: 370_000n,
      shippingEstimateMinor: 4_100n,
      leadTimeDays: 35,
      materialProcessNotes: 'FR-4 standard, HASL finish.',
      terms: 'Funds secured through the platform. HASL finish instead of ENIG.',
      expiresAt: at('2026-05-25T00:00:00.000Z'),
      submittedAt: T.quoteB,
      createdAt: T.quoteB,
    },
  });

  const quoteItems = [
    { id: ID.quoteItemA1, quoteId: ID.quoteA, rfqItemId: ID.rfqItemU1, description: 'PCB fabrication and SMT assembly', quantity: 500, unitPriceMinor: 620n, lineTotalMinor: 310_000n },
    { id: ID.quoteItemA2, quoteId: ID.quoteA, rfqItemId: ID.rfqItemU3, description: 'Telemetry radio, approved substitute', quantity: 500, unitPriceMinor: 170n, lineTotalMinor: 85_000n },
    { id: ID.quoteItemB1, quoteId: ID.quoteB, rfqItemId: ID.rfqItemU1, description: 'PCB fabrication and SMT assembly', quantity: 500, unitPriceMinor: 740n, lineTotalMinor: 370_000n },
  ];
  for (const item of quoteItems) {
    await prisma.quoteItem.upsert({
      where: { id: item.id },
      update: {},
      create: { ...item, currency: CURRENCY },
    });
  }

  await prisma.quoteAttachment.upsert({
    where: { quoteId_fileId: { quoteId: ID.quoteA, fileId: ID.fileBom } },
    update: {},
    create: { quoteId: ID.quoteA, fileId: ID.fileBom },
  });

  await prisma.substitution.upsert({
    where: { quoteId_rfqItemId: { quoteId: ID.quoteA, rfqItemId: ID.rfqItemU3 } },
    update: { status: 'approved', decidedAt: T.accepted },
    create: {
      id: ID.substitutionA,
      quoteId: ID.quoteA,
      rfqItemId: ID.rfqItemU3,
      status: 'approved',
      requestedPartReference: 'U3',
      suggestedPartName: 'SiK telemetry radio 868MHz',
      suggestedInventoryItemId: ID.inventoryA2,
      technicalJustification:
        'The 915MHz variant is unavailable. The 868MHz part is pin compatible and within the same power envelope.',
      currency: CURRENCY,
      priceImpactMinor: 1_000n,
      leadTimeImpactDays: 0,
      decidedAt: T.accepted,
      createdAt: T.quoteA,
    },
  });

  // -- secured payment, then the order -----------------------------------
  await prisma.payment.upsert({
    where: { id: ID.payment },
    update: { status: 'secured', securedAt: T.paymentSecured },
    create: {
      id: ID.payment,
      quoteId: ID.quoteA,
      buyerId: ID.buyer,
      status: 'secured',
      method: 'card',
      currency: CURRENCY,
      goodsAmountMinor: 395_000n,
      shippingAmountMinor: 2_800n,
      taxAmountMinor: 10_045n,
      platformFeeMinor: 19_750n,
      totalChargedMinor: 427_595n,
      securedAt: T.paymentSecured,
      createdAt: T.accepted,
    },
  });

  await prisma.manufacturingOrder.upsert({
    where: { id: ID.order },
    update: { status: 'in_production', paymentId: ID.payment },
    create: {
      id: ID.order,
      rfqId: ID.rfq,
      acceptedQuoteId: ID.quoteA,
      buyerId: ID.buyer,
      manufacturerId: ID.manufacturerA,
      paymentId: ID.payment,
      status: 'in_production',
      shipToLine1: '20/3, Sector 9',
      shipToCity: 'Dhaka',
      shipToPostalCode: '1230',
      shipToCountryCode: 'BD',
      confirmedAt: T.orderConfirmed,
      createdAt: T.accepted,
    },
  });

  // Append-only: created once, never updated.
  await prisma.acceptedQuoteSnapshot.createMany({
    data: [
      {
        orderId: ID.order,
        quoteId: ID.quoteA,
        quoteVersion: 1,
        manufacturerId: ID.manufacturerA,
        quantity: 500,
        currency: CURRENCY,
        unitPriceMinor: 790n,
        totalPriceMinor: 395_000n,
        shippingEstimateMinor: 2_800n,
        toolingSetupCostMinor: 12_000n,
        leadTimeDays: 24,
        materialProcessNotes: 'FR-4 TG135, ENIG finish, IPC Class 2 workmanship.',
        warrantyTerms: '90 days against manufacturing defects.',
        terms: 'Funds secured through the platform. Substitution of U3 requires buyer approval.',
        requirements: {
          quantity: 500,
          material: 'FR-4 TG135',
          manufacturingMethod: 'PCB fabrication + SMT assembly + SLA enclosure',
          tolerance: 'Board outline +/-0.2mm',
          leadTimeDays: 18,
          shippingRequirement: 'Courier, tracked, DAP Dhaka',
          assembly: 'smt',
          qualityCheckRequirement: 'Optical inspection on 100%, functional test on 10% sample',
          substitutionPolicy: 'with_approval',
        },
        approvedSubstitutionIds: [ID.substitutionA],
        checksum: 'seedchecksum01',
        capturedAt: T.accepted,
      },
    ],
    skipDuplicates: true,
  });

  // -- production: canonical stages, with shop-floor tasks inside them ----
  const stageIds = new Map<string, string>();
  for (const stage of stagePlan) {
    const id = `seed_stage_${stage.key}`;
    stageIds.set(stage.key, id);
    await prisma.productionStage.upsert({
      where: { orderId_key: { orderId: ID.order, key: stage.key } },
      update: { status: stage.status },
      create: {
        id,
        orderId: ID.order,
        key: stage.key,
        position: stage.position,
        status: stage.status,
        ...(stage.status === 'completed'
          ? { startedAt: T.orderConfirmed, completedAt: T.productionStarted }
          : stage.status === 'in_progress'
            ? { startedAt: T.productionStarted }
            : {}),
      },
    });
  }

  for (const task of taskPlan) {
    const stageId = stageIds.get(task.stage);
    if (stageId === undefined) continue;
    await prisma.productionTask.upsert({
      where: { stageId_position: { stageId, position: task.position } },
      update: { status: task.status, label: task.label },
      create: {
        id: `seed_task_${task.stage}_${task.position}`,
        orderId: ID.order,
        stageId,
        label: task.label,
        position: task.position,
        status: task.status,
      },
    });
  }

  // -- payout, still waiting for a documented release event --------------
  await prisma.payout.upsert({
    where: { orderId: ID.order },
    update: { status: 'pending_release' },
    create: {
      id: ID.payout,
      orderId: ID.order,
      paymentId: ID.payment,
      manufacturerId: ID.manufacturerA,
      status: 'pending_release',
      currency: CURRENCY,
      orderAmountMinor: 397_800n,
      platformFeeMinor: 19_750n,
      netAmountMinor: 378_050n,
      createdAt: T.orderConfirmed,
    },
  });

  // -- context bound conversation ----------------------------------------
  await prisma.messageThread.upsert({
    where: { id: ID.threadRfq },
    update: {},
    create: {
      id: ID.threadRfq,
      contextKind: 'rfq',
      rfqId: ID.rfq,
      lastMessageAt: T.quoteA,
      createdAt: T.rfqSubmitted,
    },
  });
  await prisma.messageThread.upsert({
    where: { id: ID.threadOrder },
    update: {},
    create: {
      id: ID.threadOrder,
      contextKind: 'order',
      orderId: ID.order,
      lastMessageAt: T.productionStarted,
      createdAt: T.orderConfirmed,
    },
  });

  const participants = [
    { threadId: ID.threadRfq, userId: ID.buyer },
    { threadId: ID.threadRfq, userId: ID.memberA },
    { threadId: ID.threadOrder, userId: ID.buyer },
    { threadId: ID.threadOrder, userId: ID.memberA },
  ];
  for (const participant of participants) {
    await prisma.messageThreadParticipant.upsert({
      where: { threadId_userId: participant },
      update: {},
      create: { ...participant, joinedAt: T.rfqSubmitted },
    });
  }

  await prisma.message.upsert({
    where: { id: ID.messageRfq },
    update: {},
    create: {
      id: ID.messageRfq,
      threadId: ID.threadRfq,
      authorId: ID.memberA,
      body: 'U3 is unavailable at 915MHz. A pin compatible 868MHz part is suggested inside the quote.',
      sentAt: T.quoteA,
    },
  });
  await prisma.message.upsert({
    where: { id: ID.messageOrder },
    update: {},
    create: {
      id: ID.messageOrder,
      threadId: ID.threadOrder,
      authorId: ID.memberA,
      body: 'Bare boards are finished. Assembly starts today.',
      sentAt: T.productionStarted,
    },
  });

  await prisma.notification.upsert({
    where: { id: ID.notification },
    update: {},
    create: {
      id: ID.notification,
      recipientId: ID.buyer,
      kind: 'order.production_started',
      title: 'Production started',
      body: 'PrecisionCircuit Co. has started production on your order.',
      deepLink: `/manufacturing/orders/${ID.order}`,
      createdAt: T.productionStarted,
    },
  });

  // -- documented record --------------------------------------------------
  await prisma.evidence.upsert({
    where: { id: ID.evidenceQuote },
    update: {},
    create: {
      id: ID.evidenceQuote,
      contextKind: 'order',
      kind: 'accepted_quote',
      title: 'Accepted quote QT-A v1',
      orderId: ID.order,
      submittedById: ID.ops,
      capturedAt: T.accepted,
    },
  });
  await prisma.evidence.upsert({
    where: { id: ID.evidenceQc },
    update: {},
    create: {
      id: ID.evidenceQc,
      contextKind: 'production',
      kind: 'quality_report',
      title: 'Optical inspection plan',
      productionStageId: stageIds.get('quality_check') ?? null,
      submittedById: ID.memberA,
      capturedAt: T.productionStarted,
    },
  });

  // -- a shortage the manufacturer hit in production ----------------------
  //
  // One is still open, because that is the state the buyer has to act on: the
  // manufacturer cannot guess, and the accepted terms may not be edited. The
  // other was already answered, so the record shows both sides of the decision.
  await prisma.inventoryAlert.upsert({
    where: { id: ID.alertOpen },
    update: { status: 'open', decidedAt: null, decisionNote: null },
    create: {
      id: ID.alertOpen,
      orderId: ID.order,
      raisedByManufacturerId: ID.manufacturerA,
      partReference: 'U2',
      partName: 'BMP388 barometer',
      shortfallQuantity: 180,
      note: 'Stock covers 320 of the 500 boards. The remaining 180 cannot be built until this is settled.',
      suggestedPartName: 'BMP390 barometer (pin compatible, tighter tolerance)',
      technicalJustification:
        'The BMP390 is pin and register compatible, in stock, and specified to the same pressure range with better noise figures.',
      currency: CURRENCY,
      priceImpactMinor: 9_000n,
      creditMinor: 6_400n,
      leadTimeImpactDays: 2,
      restockLeadTimeDays: 26,
      status: 'open',
      raisedAt: T.productionStarted,
    },
  });

  await prisma.inventoryAlert.upsert({
    where: { id: ID.alertDecided },
    update: {},
    create: {
      id: ID.alertDecided,
      orderId: ID.order,
      raisedByManufacturerId: ID.manufacturerA,
      partReference: 'U3',
      partName: 'SiK telemetry radio 915MHz',
      shortfallQuantity: 500,
      note: 'The 915MHz variant is out of stock with no restock date.',
      suggestedPartName: 'SiK telemetry radio 868MHz',
      suggestedInventoryItemId: ID.inventoryA2,
      technicalJustification:
        'Pin compatible and within the same power envelope. Already approved at quote stage for this order.',
      currency: CURRENCY,
      priceImpactMinor: 1_000n,
      creditMinor: 0n,
      leadTimeImpactDays: 0,
      status: 'substitute_approved',
      decidedAt: T.orderConfirmed,
      decisionNote: 'Approved — same power envelope, no change to the enclosure.',
      raisedAt: T.orderConfirmed,
    },
  });

  await prisma.promoCode.upsert({
    where: { code: 'IDEEZA10' },
    update: { active: true },
    create: {
      id: 'seed_promo_ideeza10',
      code: 'IDEEZA10',
      description: '10% off the goods on your first manufacturing order.',
      percentOff: 10,
      maxRedemptions: 100,
      active: true,
      createdAt: T.requirementsLocked,
    },
  });

  await prisma.domainEvent.createMany({
    data: eventPlan.map((event) => ({
      id: event.id,
      kind: event.kind,
      actorRole: event.role,
      actorUserId:
        event.role === 'buyer' ? ID.buyer : event.role === 'ops_admin' ? ID.ops : ID.memberA,
      actorManufacturerId: event.role === 'manufacturer' ? ID.manufacturerA : null,
      subjectKind: event.subjectKind,
      subjectId: event.subjectId,
      orderId: event.order ? ID.order : null,
      payload: {},
      occurredAt: event.at,
    })),
    skipDuplicates: true,
  });
};

const isDirectRun = (): boolean => {
  const entry = process.argv[1];
  return entry !== undefined && entry.replace(/\\/g, '/').endsWith('prisma/seed.ts');
};

if (isDirectRun()) {
  const prisma = new PrismaClient();
  seedDatabase(prisma)
    .then(async () => {
      process.stdout.write('seed: done\n');
      await prisma.$disconnect();
    })
    .catch(async (error: unknown) => {
      process.stderr.write(`seed: failed ${String(error)}\n`);
      await prisma.$disconnect();
      process.exitCode = 1;
    });
}
