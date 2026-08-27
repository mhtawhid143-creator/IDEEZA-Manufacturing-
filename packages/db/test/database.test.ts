import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { seedDatabase } from '../prisma/seed.js';
import { startTestDatabase, type TestDatabase } from '../test-support/index.js';

let database: TestDatabase;
let prisma: PrismaClient;

const countOf = async (sql: string): Promise<number> => {
  const rows = await prisma.$queryRawUnsafe<{ total: number }[]>(sql);
  return rows[0]?.total ?? -1;
};

beforeAll(async () => {
  database = await startTestDatabase();
  prisma = database.prisma;
  await seedDatabase(prisma);
});

afterAll(async () => {
  await database?.stop();
});

// ---------------------------------------------------------------------------
// 1. Migrations
// ---------------------------------------------------------------------------
describe('migrations apply to a clean database', () => {
  it('records both migrations as finished', async () => {
    const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY migration_name
    `;
    expect(rows.map((row) => row.migration_name)).toEqual([
      '20260517090000_init',
      '20260517091000_guards',
      '20260825085934_auth_sessions',
      '20260825090000_auth_guards',
      '20260825135719_product_favorites',
      '20260825163246_rfq_requested_services',
      '20260826041012_checkout_promo_shipping',
      '20260826044820_inventory_alerts',
      '20260826082901_message_read_state',
      '20260826085713_print_specification',
      '20260826115435_board_specification',
      '20260827062618_quote_volume_prices',
      '20260827065859_inventory_movements',
    ]);
  });

  it('creates the expected surface of tables and enums', async () => {
    const tables = await countOf(`
      SELECT count(*)::int AS total FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        AND table_name <> '_prisma_migrations'
    `);
    const enums = await countOf(`
      SELECT count(*)::int AS total FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typtype = 'e' AND n.nspname = 'public'
    `);
    // 41 business tables from T02, Session and UserCredential from T03,
    // ProductFavorite from T05, PromoCode from the checkout work and
    // InventoryAlert from production tracking. The enums gained
    // ProductAvailability, AssemblySides, ShippingChoice and
    // InventoryAlertStatus.
    // QuoteVolumePrice arrived with quoting: a request may ask for alternative
    // volumes, and the answers have to be comparable rather than prose.
    expect(tables).toBe(49);
    // PrintTechnology and SurfaceFinish arrived with the 3D route, the board
    // specification brought fourteen of its own, and InventoryMovementKind
    // arrived with inventory management.
    expect(enums).toBe(46);
  });

  it('is reproducible: the committed migrations produce exactly the schema', async () => {
    const shadowUrl = await database.createDatabase('ideeza_migration_shadow');
    const exitCode = database.runPrisma([
      'migrate',
      'diff',
      '--from-migrations',
      'prisma/migrations',
      '--to-schema-datamodel',
      'prisma/schema.prisma',
      '--shadow-database-url',
      shadowUrl,
      '--exit-code',
    ]);
    // 0 = no difference between the migration history and the schema.
    expect(exitCode).toBe(0);
  });

  it('installs the guard constraints and the append-only triggers', async () => {
    const checks = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint WHERE contype = 'c' AND conname LIKE '%_%'
      ORDER BY conname
    `;
    const names = checks.map((row) => row.conname);
    for (const expected of [
      'order_needs_payment_once_past_awaiting',
      'quote_accepted_pointer_matches_rfq',
      'quote_accepted_pointer_set_iff_accepted',
      'thread_context_present',
      'evidence_single_context',
      'stage_position_matches_canonical_key',
      'payout_money_sane',
      'session_manufacturer_binding',
      'session_expiry_window_ordered',
      'session_revocation_is_explained',
      'credential_counters_sane',
      'inventory_movement_is_coherent',
      'quote_volume_price_is_a_real_price',
    ]) {
      expect(names).toContain(expected);
    }

    const triggers = await prisma.$queryRaw<{ tgname: string }[]>`
      SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname
    `;
    expect(triggers.map((row) => row.tgname)).toEqual([
      'AcceptedQuoteSnapshot_reject_delete',
      'AcceptedQuoteSnapshot_reject_update',
      'DomainEvent_reject_delete',
      'DomainEvent_reject_update',
      // A stock movement may never be edited. It is removable only with the
      // part it belongs to, and the domain refuses to delete a part that has any
      // history behind it.
      'InventoryMovement_reject_update',
    ]);
  });
});

// ---------------------------------------------------------------------------
// 2. Seed
// ---------------------------------------------------------------------------
describe('seed', () => {
  it('creates the reference scenario', async () => {
    // Four accounts plus the two creators whose products the buyer has kept.
    expect(await prisma.user.count()).toBe(6);
    // Two board houses and a print shop, because a 3D module can be sent to
    // manufacture on its own.
    expect(await prisma.manufacturerProfile.count()).toBe(3);
    // Four favourites plus the mixed product the 3D route is exercised on.
    expect(await prisma.product.count()).toBe(5);
    expect(await prisma.productFavorite.count()).toBe(4);
    expect(await prisma.rfq.count()).toBe(1);
    expect(await prisma.rfqRecipient.count()).toBe(2);
    expect(await prisma.rfqItem.count()).toBe(3);
    expect(await prisma.quote.count()).toBe(2);
    expect(await prisma.manufacturingOrder.count()).toBe(1);
    expect(await prisma.acceptedQuoteSnapshot.count()).toBe(1);
    expect(await prisma.productionStage.count()).toBe(10);
    expect(await prisma.productionTask.count()).toBe(10);
    expect(await prisma.payment.count()).toBe(1);
    expect(await prisma.payout.count()).toBe(1);
    expect(await prisma.messageThread.count()).toBe(2);
    expect(await prisma.message.count()).toBe(2);
    expect(await prisma.evidence.count()).toBe(2);
    expect(await prisma.domainEvent.count()).toBe(9);
    expect(await prisma.inventoryItem.count()).toBe(3);
  });

  it('routes one request to two manufacturers and accepts exactly one quote', async () => {
    const rfq = await prisma.rfq.findUniqueOrThrow({
      where: { id: 'seed_rfq_1' },
      include: { recipients: true, quotes: true, acceptedQuote: true, orders: true },
    });

    expect(rfq.recipients).toHaveLength(2);
    expect(rfq.quotes).toHaveLength(2);
    expect(rfq.acceptedQuote?.id).toBe('seed_quote_a');
    expect(rfq.orders).toHaveLength(1);
    expect(rfq.quotes.filter((quote) => quote.status === 'accepted')).toHaveLength(1);
  });

  it('is deterministic: a second run changes no counts', async () => {
    const before = {
      users: await prisma.user.count(),
      quotes: await prisma.quote.count(),
      stages: await prisma.productionStage.count(),
      events: await prisma.domainEvent.count(),
      evidence: await prisma.evidence.count(),
    };

    await seedDatabase(prisma);

    expect({
      users: await prisma.user.count(),
      quotes: await prisma.quote.count(),
      stages: await prisma.productionStage.count(),
      events: await prisma.domainEvent.count(),
      evidence: await prisma.evidence.count(),
    }).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// 2b. Favourites and product availability
// ---------------------------------------------------------------------------
describe('favourites and product availability', () => {
  it('keeps the buyer catalogue, including a product its creator withdrew', async () => {
    const favorites = await prisma.productFavorite.findMany({
      where: { userId: 'seed_user_buyer' },
      include: { product: true },
      orderBy: { createdAt: 'asc' },
    });

    expect(favorites).toHaveLength(4);
    expect(favorites.map((favorite) => favorite.productId)).toEqual([
      'seed_product_drone',
      'seed_product_fpv_stack',
      'seed_product_sensor_hub',
      'seed_product_legacy_beacon',
    ]);
    expect(
      favorites.filter((favorite) => favorite.product.availability === 'unavailable'),
    ).toHaveLength(1);
  });

  it('refuses the same product twice for one buyer', async () => {
    await expect(
      prisma.productFavorite.create({
        data: { userId: 'seed_user_buyer', productId: 'seed_product_drone' },
      }),
    ).rejects.toThrow();
  });

  it('lets two buyers keep the same product', async () => {
    await prisma.productFavorite.create({
      data: { userId: 'seed_user_creator_a', productId: 'seed_product_sensor_hub' },
    });
    const keepers = await prisma.productFavorite.findMany({
      where: { productId: 'seed_product_sensor_hub' },
    });
    expect(keepers.length).toBeGreaterThanOrEqual(2);
    await prisma.productFavorite.delete({
      where: {
        userId_productId: {
          userId: 'seed_user_creator_a',
          productId: 'seed_product_sensor_hub',
        },
      },
    });
  });

  it('drops the favourite with the product, not the other way round', async () => {
    await prisma.product.create({
      data: { id: 'test_product_temp', ownerId: 'seed_user_creator_b', name: 'Temporary' },
    });
    await prisma.productFavorite.create({
      data: { userId: 'seed_user_buyer', productId: 'test_product_temp' },
    });
    await prisma.product.delete({ where: { id: 'test_product_temp' } });
    expect(
      await prisma.productFavorite.count({ where: { productId: 'test_product_temp' } }),
    ).toBe(0);
    expect(await prisma.user.count({ where: { id: 'seed_user_buyer' } })).toBe(1);
  });

  it('defaults a new product to available', async () => {
    const created = await prisma.product.create({
      data: { id: 'test_product_default', ownerId: 'seed_user_buyer', name: 'Default' },
    });
    expect(created.availability).toBe('available');
    await prisma.product.delete({ where: { id: 'test_product_default' } });
  });

  it('finds an open request for a product through its package', async () => {
    const open = await prisma.rfq.findMany({
      where: {
        buyerId: 'seed_user_buyer',
        status: { in: ['draft', 'submitted'] },
        package: { productId: 'seed_product_drone' },
      },
    });
    // The reference scenario has run to production, so its request is closed.
    expect(open).toHaveLength(0);
    const all = await prisma.rfq.findMany({
      where: { package: { productId: 'seed_product_drone' } },
    });
    expect(all).toHaveLength(1);
    expect(all[0]?.status).toBe('closed');
  });
});

// ---------------------------------------------------------------------------
// 3. Duplicate routing record
// ---------------------------------------------------------------------------
describe('a request cannot be routed to the same manufacturer twice', () => {
  it('rejects a duplicate recipient', async () => {
    await expect(
      prisma.rfqRecipient.create({
        data: {
          id: 'test_duplicate_recipient',
          rfqId: 'seed_rfq_1',
          manufacturerId: 'seed_mfr_a',
          status: 'routed',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows the same manufacturer on a different request', async () => {
    const secondRfq = await prisma.rfq.create({
      data: {
        id: 'test_rfq_second',
        buyerId: 'seed_user_buyer',
        packageId: 'seed_package_full',
        requirementsId: 'seed_requirements_v1',
        status: 'draft',
        quantity: 100,
        currency: 'USD',
        shipToLine1: 'x',
        shipToCity: 'Dhaka',
        shipToCountryCode: 'BD',
      },
    });

    const recipient = await prisma.rfqRecipient.create({
      data: {
        id: 'test_recipient_a_second_rfq',
        rfqId: secondRfq.id,
        manufacturerId: 'seed_mfr_a',
        status: 'routed',
      },
    });
    expect(recipient.manufacturerId).toBe('seed_mfr_a');

    await prisma.rfq.delete({ where: { id: secondRfq.id } });
  });
});

// ---------------------------------------------------------------------------
// 4. One accepted quote per request
// ---------------------------------------------------------------------------
describe('only one quote per request can be accepted', () => {
  it('rejects a second accepted quote through the unique accepted pointer', async () => {
    await expect(
      prisma.quote.update({
        where: { id: 'seed_quote_b' },
        data: { status: 'accepted', acceptedForRfqId: 'seed_rfq_1', acceptedAt: new Date() },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    const stillOne = await prisma.quote.count({
      where: { rfqId: 'seed_rfq_1', status: 'accepted' },
    });
    expect(stillOne).toBe(1);
  });

  it('refuses an accepted status without the pointer', async () => {
    await expect(
      prisma.quote.update({
        where: { id: 'seed_quote_b' },
        data: { status: 'accepted' },
      }),
    ).rejects.toThrow(/quote_accepted_pointer_set_iff_accepted/);
  });

  it('refuses a pointer that names a different request', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "Quote" SET "acceptedForRfqId" = 'other_rfq' WHERE id = 'seed_quote_b'`,
      ),
    ).rejects.toThrow(/quote_accepted_pointer/);
  });
});

// ---------------------------------------------------------------------------
// 5. Foreign keys
// ---------------------------------------------------------------------------
describe('records cannot exist without their owners', () => {
  it('rejects a quote for an unknown request', async () => {
    await expect(
      prisma.quote.create({
        data: {
          id: 'test_orphan_quote',
          rfqId: 'rfq_that_does_not_exist',
          manufacturerId: 'seed_mfr_a',
          quantity: 1,
          currency: 'USD',
          unitPriceMinor: 1n,
          totalPriceMinor: 1n,
          leadTimeDays: 1,
          materialProcessNotes: 'x',
          terms: 'x',
          expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('rejects an order for an unknown accepted quote', async () => {
    await expect(
      prisma.manufacturingOrder.create({
        data: {
          id: 'test_orphan_order',
          rfqId: 'seed_rfq_1',
          acceptedQuoteId: 'quote_that_does_not_exist',
          buyerId: 'seed_user_buyer',
          manufacturerId: 'seed_mfr_a',
          shipToLine1: 'x',
          shipToCity: 'x',
          shipToCountryCode: 'BD',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('rejects an inventory item without a manufacturer', async () => {
    await expect(
      prisma.inventoryItem.create({
        data: {
          id: 'test_orphan_inventory',
          manufacturerId: 'mfr_that_does_not_exist',
          partName: 'x',
          sku: 'X-1',
          category: 'Electronics',
          currency: 'USD',
          unitCostMinor: 1n,
          leadTimeDays: 1,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
});

// ---------------------------------------------------------------------------
// 6. Manufacturer ownership
// ---------------------------------------------------------------------------
describe('manufacturer owned records carry their manufacturer', () => {
  it('scopes inventory to its owner', async () => {
    const ownedByA = await prisma.inventoryItem.findMany({
      where: { manufacturerId: 'seed_mfr_a' },
    });
    const ownedByB = await prisma.inventoryItem.findMany({
      where: { manufacturerId: 'seed_mfr_b' },
    });

    expect(ownedByA).toHaveLength(2);
    expect(ownedByB).toHaveLength(1);
    expect(ownedByA.every((item) => item.manufacturerId === 'seed_mfr_a')).toBe(true);
  });

  it('allows the same part number for two different manufacturers', async () => {
    const shared = await prisma.inventoryItem.findMany({
      where: { sku: 'MCU-STM32F405' },
      select: { manufacturerId: true },
    });
    expect(shared.map((item) => item.manufacturerId).sort()).toEqual([
      'seed_mfr_a',
      'seed_mfr_b',
    ]);
  });

  it('rejects a duplicate part number inside one manufacturer', async () => {
    await expect(
      prisma.inventoryItem.create({
        data: {
          id: 'test_duplicate_sku',
          manufacturerId: 'seed_mfr_a',
          partName: 'STM32F405 MCU',
          sku: 'MCU-STM32F405',
          category: 'Electronics',
          currency: 'USD',
          unitCostMinor: 620n,
          leadTimeDays: 7,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('links every quote and order to a manufacturer', async () => {
    const quotes = await prisma.quote.findMany({ include: { manufacturer: true } });
    expect(quotes.every((quote) => quote.manufacturer.id === quote.manufacturerId)).toBe(true);

    const order = await prisma.manufacturingOrder.findUniqueOrThrow({
      where: { id: 'seed_order_1' },
      include: { manufacturer: true, acceptedQuote: true },
    });
    expect(order.manufacturerId).toBe(order.acceptedQuote.manufacturerId);
  });
});

// ---------------------------------------------------------------------------
// 7. Order, payment and the accepted quote snapshot
// ---------------------------------------------------------------------------
describe('an order carries the frozen terms it was created from', () => {
  it('links the order to its snapshot and its accepted quote', async () => {
    const order = await prisma.manufacturingOrder.findUniqueOrThrow({
      where: { id: 'seed_order_1' },
      include: { snapshot: true, acceptedQuote: true, payment: true },
    });

    expect(order.snapshot?.orderId).toBe(order.id);
    expect(order.snapshot?.quoteId).toBe('seed_quote_a');
    expect(order.snapshot?.checksum).toBe('seedchecksum01');
    expect(order.snapshot?.totalPriceMinor).toBe(order.acceptedQuote.totalPriceMinor);
    expect(order.payment?.status).toBe('secured');
  });

  it('refuses a second order for the same accepted quote', async () => {
    await expect(
      prisma.manufacturingOrder.create({
        data: {
          id: 'test_second_order_same_quote',
          rfqId: 'seed_rfq_1',
          acceptedQuoteId: 'seed_quote_a',
          buyerId: 'seed_user_buyer',
          manufacturerId: 'seed_mfr_a',
          shipToLine1: 'x',
          shipToCity: 'x',
          shipToCountryCode: 'BD',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('refuses an order past awaiting_payment with no payment attached', async () => {
    await expect(
      prisma.$executeRawUnsafe(`
        INSERT INTO "ManufacturingOrder"
          (id, "rfqId", "acceptedQuoteId", "buyerId", "manufacturerId", status,
           "shipToLine1", "shipToCity", "shipToCountryCode", "createdAt")
        VALUES
          ('test_unfunded_order', 'seed_rfq_1', 'seed_quote_b', 'seed_user_buyer',
           'seed_mfr_b', 'in_production', 'x', 'x', 'BD', now())
      `),
    ).rejects.toThrow(/order_needs_payment_once_past_awaiting/);
  });

  it('allows an order to sit in awaiting_payment with no payment', async () => {
    const created = await prisma.$executeRawUnsafe(`
      INSERT INTO "ManufacturingOrder"
        (id, "rfqId", "acceptedQuoteId", "buyerId", "manufacturerId", status,
         "shipToLine1", "shipToCity", "shipToCountryCode", "createdAt")
      VALUES
        ('test_awaiting_order', 'seed_rfq_1', 'seed_quote_b', 'seed_user_buyer',
         'seed_mfr_b', 'awaiting_payment', 'x', 'x', 'BD', now())
    `);
    expect(created).toBe(1);
    await prisma.$executeRawUnsafe(
      `DELETE FROM "ManufacturingOrder" WHERE id = 'test_awaiting_order'`,
    );
  });

  it('keeps the snapshot immutable', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "AcceptedQuoteSnapshot" SET "leadTimeDays" = 2 WHERE "orderId" = 'seed_order_1'`,
      ),
    ).rejects.toThrow(/append_only_violation/);

    await expect(
      prisma.$executeRawUnsafe(
        `DELETE FROM "AcceptedQuoteSnapshot" WHERE "orderId" = 'seed_order_1'`,
      ),
    ).rejects.toThrow(/append_only_violation/);
  });
});

// ---------------------------------------------------------------------------
// 8. Production stages and tasks
// ---------------------------------------------------------------------------
describe('production stages are the canonical ten, in order', () => {
  it('links ten stages to the order in business order', async () => {
    const stages = await prisma.productionStage.findMany({
      where: { orderId: 'seed_order_1' },
      orderBy: { position: 'asc' },
    });

    expect(stages.map((stage) => stage.key)).toEqual([
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
    ]);
    expect(stages.map((stage) => stage.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('refuses a stage that claims the wrong canonical position', async () => {
    await expect(
      prisma.$executeRawUnsafe(`
        INSERT INTO "ProductionStage" (id, "orderId", key, position, status)
        VALUES ('test_bad_stage', 'seed_order_1', 'shipped', 3, 'pending')
      `),
    ).rejects.toThrow(/stage_position_matches_canonical_key/);
  });

  it('refuses the same stage twice on one order', async () => {
    await expect(
      prisma.productionStage.create({
        data: {
          id: 'test_duplicate_stage',
          orderId: 'seed_order_1',
          key: 'in_production',
          position: 5,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('nests shop-floor tasks inside a canonical stage', async () => {
    const stage = await prisma.productionStage.findUniqueOrThrow({
      where: { orderId_key: { orderId: 'seed_order_1', key: 'in_production' } },
      include: { tasks: { orderBy: { position: 'asc' } } },
    });

    expect(stage.tasks.map((task) => task.label)).toEqual([
      'Bare board fabrication',
      'Assembly',
      'Firmware flashing',
      'Enclosure production',
    ]);
    expect(stage.tasks.every((task) => task.stageId === stage.id)).toBe(true);
    expect(stage.tasks.every((task) => task.orderId === 'seed_order_1')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. Domain events
// ---------------------------------------------------------------------------
describe('the event log is linked and append-only', () => {
  it('links events to their subject and, where relevant, to the order', async () => {
    const events = await prisma.domainEvent.findMany({ orderBy: { occurredAt: 'asc' } });

    const accepted = events.find((event) => event.kind === 'quote_accepted');
    expect(accepted?.subjectKind).toBe('quote');
    expect(accepted?.subjectId).toBe('seed_quote_a');

    const orderEvents = events.filter((event) => event.orderId === 'seed_order_1');
    expect(orderEvents.map((event) => event.kind)).toEqual([
      'order_created',
      'order_confirmed',
      'order_production_started',
    ]);

    const withOrder = await prisma.manufacturingOrder.findUniqueOrThrow({
      where: { id: 'seed_order_1' },
      include: { domainEvents: true },
    });
    expect(withOrder.domainEvents).toHaveLength(3);
  });

  it('assigns a monotonic sequence', async () => {
    const events = await prisma.domainEvent.findMany({ orderBy: { sequence: 'asc' } });
    const sequences = events.map((event) => Number(event.sequence));
    expect(sequences).toEqual([...sequences].sort((left, right) => left - right));
    expect(new Set(sequences).size).toBe(sequences.length);
  });

  it('refuses to rewrite or remove an event', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "DomainEvent" SET kind = 'order_cancelled' WHERE id = 'seed_event_5'`,
      ),
    ).rejects.toThrow(/append_only_violation/);

    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM "DomainEvent" WHERE id = 'seed_event_5'`),
    ).rejects.toThrow(/append_only_violation/);
  });

  it('rejects an event kind the domain does not know', async () => {
    await expect(
      prisma.$executeRawUnsafe(`
        INSERT INTO "DomainEvent" (id, kind, "actorRole", "subjectKind", "subjectId", payload, "occurredAt")
        VALUES ('test_bad_event', 'proposal_sent', 'buyer', 'quote', 'seed_quote_a', '{}', now())
      `),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 10. Money representation
// ---------------------------------------------------------------------------
describe('money is stored as integer minor units with an explicit currency', () => {
  it('uses bigint for every amount column and never a floating point type', async () => {
    const amountColumns = await prisma.$queryRaw<
      { table_name: string; column_name: string; data_type: string }[]
    >`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name LIKE '%Minor'
      ORDER BY table_name, column_name
    `;

    expect(amountColumns.length).toBeGreaterThan(20);
    expect(amountColumns.every((column) => column.data_type === 'bigint')).toBe(true);

    const floats = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND data_type IN ('double precision', 'real')
    `;
    expect(floats).toEqual([]);
  });

  it('stores currency as a three character code', async () => {
    const currencyColumns = await prisma.$queryRaw<
      { table_name: string; data_type: string; character_maximum_length: number }[]
    >`
      SELECT table_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'currency'
    `;
    expect(currencyColumns.length).toBeGreaterThan(8);
    expect(
      currencyColumns.every(
        (column) => column.data_type === 'character' && column.character_maximum_length === 3,
      ),
    ).toBe(true);
  });

  it('reads amounts back as exact integers', async () => {
    const quote = await prisma.quote.findUniqueOrThrow({ where: { id: 'seed_quote_a' } });
    expect(quote.unitPriceMinor).toBe(790n);
    expect(quote.totalPriceMinor).toBe(395_000n);
    expect(quote.currency).toBe('USD');

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: 'seed_payment_1' } });
    expect(
      payment.goodsAmountMinor +
        payment.shippingAmountMinor +
        payment.taxAmountMinor +
        payment.platformFeeMinor,
    ).toBe(payment.totalChargedMinor);
  });

  it('refuses a negative amount and a malformed currency', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "Quote" SET "totalPriceMinor" = -1 WHERE id = 'seed_quote_b'`,
      ),
    ).rejects.toThrow(/quote_money_sane/);

    await expect(
      prisma.$executeRawUnsafe(`UPDATE "Quote" SET currency = 'usd' WHERE id = 'seed_quote_b'`),
    ).rejects.toThrow(/quote_money_sane/);
  });

  it('keeps payout arithmetic internally consistent', async () => {
    const payout = await prisma.payout.findUniqueOrThrow({ where: { orderId: 'seed_order_1' } });
    expect(payout.netAmountMinor).toBe(payout.orderAmountMinor - payout.platformFeeMinor);

    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "Payout" SET "netAmountMinor" = 1 WHERE "orderId" = 'seed_order_1'`,
      ),
    ).rejects.toThrow(/payout_money_sane/);
  });
});

// ---------------------------------------------------------------------------
// 11. Context bound messaging and evidence
// ---------------------------------------------------------------------------
describe('conversation and evidence are bound to a business object', () => {
  it('links every seeded thread to its context', async () => {
    const threads = await prisma.messageThread.findMany({ orderBy: { createdAt: 'asc' } });
    expect(threads[0]?.contextKind).toBe('rfq');
    expect(threads[0]?.rfqId).toBe('seed_rfq_1');
    expect(threads[1]?.contextKind).toBe('order');
    expect(threads[1]?.orderId).toBe('seed_order_1');
  });

  it('refuses a thread with no context', async () => {
    await expect(
      prisma.messageThread.create({
        data: { id: 'test_unbound_thread', contextKind: 'order' },
      }),
    ).rejects.toThrow(/thread_context_present/);
  });

  it('refuses evidence that claims two contexts at once', async () => {
    await expect(
      prisma.evidence.create({
        data: {
          id: 'test_double_context_evidence',
          contextKind: 'order',
          kind: 'photo',
          title: 'x',
          orderId: 'seed_order_1',
          rfqId: 'seed_rfq_1',
        },
      }),
    ).rejects.toThrow(/evidence_single_context/);
  });

  it('refuses evidence whose context does not match its kind', async () => {
    await expect(
      prisma.evidence.create({
        data: {
          id: 'test_mismatched_evidence',
          contextKind: 'refund',
          kind: 'photo',
          title: 'x',
          orderId: 'seed_order_1',
        },
      }),
    ).rejects.toThrow(/evidence_context_matches_kind/);
  });
});
