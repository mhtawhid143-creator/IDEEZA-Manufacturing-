/**
 * End to end verification of the manufacturer app against a real stack.
 *
 * Boots a throwaway PostgreSQL cluster, applies the committed migrations, seeds
 * the reference scenario, provisions a password, starts the built Next.js server
 * and then exercises it over HTTP for the routing and guard behaviour and in a
 * real Chromium for sign-in, the shell, the console and the responsive layout.
 *
 * It is a separate harness from the buyer one on purpose: the two surfaces have
 * different route tables, and a check that passes on one proves nothing about
 * the other.
 *
 *   node tools/verify-manufacturer-app.mjs
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { takeBuildLock } from './build-lock.mjs';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const dbPackage = join(root, 'packages', 'db');
const appDir = join(root, 'apps', 'manufacturer');
const shotDir = join(root, '.verify-shots-manufacturer');
const prismaCli = createRequire(join(dbPackage, 'package.json')).resolve(
  'prisma/build/index.js',
);
const nextCli = createRequire(join(appDir, 'package.json')).resolve(
  'next/dist/bin/next',
);

/**
 * Credentials for this run only, generated here and never written anywhere: the
 * database, the app and the browser all live and die with this process.
 */
const PASSWORD = `Verify-${randomBytes(18).toString('base64url')}`;
const MEMBER_EMAIL = 'ops@precisioncircuit.test';
const BUYER_EMAIL = 'buyer@example.test';
const SHOP_NAME = 'PrecisionCircuit Co.';

const results = [];
let failures = 0;

const check = (name, passed, detail = '') => {
  results.push({ name, passed, detail });
  if (!passed) failures += 1;
  process.stdout.write(
    `${passed ? 'PASS' : 'FAIL'}  ${name}${detail === '' ? '' : ` — ${detail}`}\n`,
  );
};

/** Waits for an element to become visible, and answers rather than throwing. */
const visible = (locator, timeout = 15_000) =>
  locator
    .first()
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);

/**
 * Removes a card through its own kebab, and waits for it to actually go.
 *
 * Written once because three tabs do the same thing, and because the timing is
 * the whole difficulty: a card added a moment ago is still being re-rendered by
 * `router.refresh()`, and a menu opened mid-render is closed by it, so the
 * Delete click lands on nothing. A person seeing the menu vanish opens it
 * again; so does this. Returns whether the card is gone.
 */
/**
 * Sends away any toast still on screen.
 *
 * They sit top-centre with pointer events on, so a toast from the write before
 * this one can be squarely over the card whose kebab is about to be pressed —
 * and a click that lands on a toast is a click that did nothing. This is the
 * cause of the deletes that "failed" in a long harness run while taking 300ms
 * in isolation.
 */
const clearToasts = async (page) => {
  const dismiss = page.getByRole('button', { name: 'Dismiss' });
  for (let round = 0; round < 6; round += 1) {
    const left = await dismiss.count();
    if (left === 0) return;
    await dismiss
      .first()
      .click({ timeout: 3_000 })
      .catch(() => undefined);
    await page.waitForTimeout(200);
    if ((await dismiss.count()) >= left) return;
  }
};

const removeCard = async (page, cards, text) => {
  let why = 'still on the page after three tries';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if ((await cards.filter({ hasText: text }).count()) === 0) return true;
    // Wait out the refresh from whatever came before. The kebab is disabled
    // while a write is in flight, and a menu opened mid-render is closed by it,
    // so a click in that gap lands on nothing.
    const trigger = cards
      .filter({ hasText: text })
      .first()
      .getByRole('button', { name: /Actions for/ });
    try {
      // Any menu left open from a previous card would swallow the next click
      // as a dismissal rather than opening this card's own.
      await clearToasts(page);
      await page.keyboard.press('Escape');
      await trigger.waitFor({ state: 'visible', timeout: 15_000 });
      for (let settle = 0; settle < 40 && (await trigger.isDisabled()); settle += 1) {
        await page.waitForTimeout(500);
      }
      await trigger.click({ timeout: 15_000 });
      // Scoped to this card's own menu by its label. Two menus can be open at
      // once, and deleting from the wrong one would take down a card nobody
      // asked about while leaving this check's card exactly where it was.
      const item = page
        .getByRole('menu', { name: `Actions for ${text}` })
        .getByRole('menuitem', { name: 'Delete' });
      await item.waitFor({ state: 'visible', timeout: 10_000 });
      await item.click({ timeout: 15_000 });
    } catch (error) {
      why = String(error).split('\n')[0].slice(0, 90);
      continue;
    }
    // The profile page is a wide read — machines, sheets, certificates,
    // articles, reviews and their breakdown — so the refresh after a write is
    // not instant on a loaded machine. Wait properly rather than calling a slow
    // delete a broken one.
    for (let poll = 0; poll < 60; poll += 1) {
      await page.waitForTimeout(500);
      if ((await cards.filter({ hasText: text }).count()) === 0) return true;
    }
  }
  process.stdout.write(`      (removeCard ${text}: ${why})
`);
  return false;
};

const freePort = async () =>
  new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });

const waitForServer = async (url, attempts = 90) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status > 0) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
};

const signIn = async (page, base, email) => {
  await page.goto(`${base}/auth/sign-in`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page
    .waitForURL((url) => !url.pathname.startsWith('/auth/sign-in'), { timeout: 25_000 })
    .catch(() => undefined);
  await page.waitForLoadState('networkidle');
};

const main = async () => {
  takeBuildLock('manufacturer verification');
  const dataDir = mkdtempSync(join(tmpdir(), 'ideeza-verify-mfr-pg-'));
  mkdirSync(shotDir, { recursive: true });
  const pgPort = await freePort();
  const appPort = await freePort();

  const postgres = new EmbeddedPostgres({
    databaseDir: dataDir,
    port: pgPort,
    user: 'postgres',
    password: 'postgres',
    authMethod: 'password',
    persistent: false,
    onLog: () => undefined,
    onError: () => undefined,
  });

  let appProcess;
  const appLog = [];

  try {
    process.stdout.write('booting postgres…\n');
    await postgres.initialise();
    await postgres.start();
    await postgres.createDatabase('ideeza_verify_mfr');
    const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${pgPort}/ideeza_verify_mfr?schema=public`;

    const migrate = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
      cwd: dbPackage,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: 'utf8',
    });
    check(
      'migrations apply to an empty database',
      migrate.status === 0,
      (migrate.stderr ?? '').trim().slice(0, 200),
    );

    const seed = spawnSync(
      process.execPath,
      ['--import', 'tsx', join(root, 'tools', 'seed-and-provision.ts')],
      {
        cwd: root,
        env: { ...process.env, DATABASE_URL: databaseUrl, VERIFY_PASSWORD: PASSWORD },
        encoding: 'utf8',
      },
    );
    check(
      'seed and credential provisioning succeed',
      seed.status === 0,
      (seed.stderr ?? '').trim().slice(0, 300),
    );
    if (seed.status !== 0) throw new Error('seed failed');

    const fixtures = spawnSync(
      process.execPath,
      ['--import', 'tsx', join(root, 'tools', 'verify-fixtures.ts')],
      { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8' },
    );
    check(
      'the verification fixtures apply',
      fixtures.status === 0,
      (fixtures.stderr ?? '').trim().slice(0, 300),
    );
    if (fixtures.status !== 0) throw new Error('fixtures failed');

    // The shared fixtures leave every routed request answered, which is what the
    // buyer side needed. An inbox needs unanswered ones.
    const inboxFixtures = spawnSync(
      process.execPath,
      ['--import', 'tsx', join(root, 'tools', 'verify-fixtures-manufacturer.ts')],
      { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8' },
    );
    check(
      'the manufacturer fixtures apply',
      inboxFixtures.status === 0,
      (inboxFixtures.stderr ?? '').trim().slice(0, 300),
    );
    if (inboxFixtures.status !== 0) throw new Error('manufacturer fixtures failed');

    process.stdout.write('starting the built app…\n');
    appProcess = spawn(process.execPath, [nextCli, 'start', '--port', String(appPort)], {
      cwd: appDir,
      env: { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    appProcess.stdout.on('data', (chunk) => appLog.push(String(chunk)));
    appProcess.stderr.on('data', (chunk) => appLog.push(String(chunk)));

    const base = `http://127.0.0.1:${appPort}`;
    const up = await waitForServer(`${base}/health`);
    check('the app answers on its port', up, up ? '' : appLog.join('').slice(-500));
    if (!up) throw new Error('app did not start');

    // ---------------------------------------------------------------- HTTP
    const health = await fetch(`${base}/health`);
    const healthBody = await health.json();
    check(
      'GET /health names the manufacturer surface',
      health.status === 200 && healthBody.surface === 'manufacturer',
    );

    const gallery = await fetch(`${base}/design-system`);
    check('the design system renders without a session', gallery.status === 200);

    const guarded = await fetch(`${base}/dashboard`, { redirect: 'manual' });
    const location = guarded.headers.get('location') ?? '';
    check(
      'GET /dashboard without a session redirects to sign-in',
      [302, 303, 307].includes(guarded.status) && location.includes('/auth/sign-in'),
      `status ${guarded.status} → ${location}`,
    );

    // The review environment can turn on a passwordless way in. This harness
    // never sets REVIEW_DIRECT_SIGN_IN, so the route it enables must not
    // exist here — if it ever answers anything but 404 without the flag, the
    // panel has an open door.
    const passwordless = await fetch(`${base}/auth/enter`, { redirect: 'manual' });
    check(
      'the passwordless review route does not exist without its flag',
      passwordless.status === 404,
      `status ${passwordless.status}`,
    );

    for (const buyerPath of ['/manufacturing', '/favorites', '/products/seed_product_drone']) {
      const response = await fetch(`${base}${buyerPath}`, { redirect: 'manual' });
      const body = response.status === 200 ? await response.text() : '';
      check(
        `a buyer path is not served here: ${buyerPath}`,
        response.status !== 200 || body.includes('not part of the manufacturer panel'),
        `status ${response.status}`,
      );
    }

    // ----------------------------------------------------------- Playwright
    process.stdout.write('driving chromium…\n');
    const browser = await chromium.launch();
    const consoleErrors = [];
    const networkFailures = [];

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(String(error)));
    page.on('response', (response) => {
      if (response.status() >= 400) {
        networkFailures.push(`${response.status()} ${response.url()}`);
      }
    });

    // ------------------------------------------------- M01: sign in and shell
    await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    check(
      'an anonymous visit lands on the sign-in page',
      page.url().includes('/auth/sign-in'),
      page.url(),
    );
    check(
      'sign-in says which panel this is',
      await visible(page.getByText('Manufacturer')),
    );

    await signIn(page, base, MEMBER_EMAIL);
    check(
      'a manufacturer member signs in and lands on the dashboard',
      page.url().includes('/dashboard'),
      page.url(),
    );
    check(
      'the shell names the shop the member is acting for',
      (await visible(page.getByRole('navigation', { name: 'Main' }))) &&
        (await visible(page.getByText(SHOP_NAME).first())),
    );

    const navItems = [
      'Dashboard',
      'Request Quote',
      'Quotes',
      'My Orders',
      'Inventory',
      'Payouts & Earnings',
      'Messages',
      'Blog',
    ];
    const navMissing = [];
    for (const item of navItems) {
      const found = await visible(
        page.getByRole('navigation', { name: 'Main' }).getByText(item, { exact: true }),
        4_000,
      );
      if (!found) navMissing.push(item);
    }
    check(
      'the rail carries every manufacturer destination',
      navMissing.length === 0,
      navMissing.join(', '),
    );

    // A destination whose screen is not built yet is a disabled row with the
    // reason on it, so nothing in the rail can be clicked into a 404.
    const railLinks = await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
    const broken = [];
    for (const href of railLinks) {
      if (href === null) continue;
      const response = await page.request.get(`${base}${href}`, { maxRedirects: 0 });
      if (response.status() >= 400) broken.push(`${response.status()} ${href}`);
    }
    check('every link in the rail resolves', broken.length === 0, broken.join(', '));

    check(
      'nothing from the buyer domain is in the rail',
      (await page
        .getByRole('navigation', { name: 'Main' })
        .getByRole('link', { name: /Favorites|Manufacturing|Draft/ })
        .count()) === 0,
    );

    // ------------------------------------------------- M01: the headline tiles
    check(
      'the dashboard shows the six numbers a shop plans on',
      (await visible(page.getByText('Open RFQs'))) &&
        (await visible(page.getByText('Quotes awaiting a decision'))) &&
        (await visible(page.getByText('Delayed orders'))) &&
        (await visible(page.getByText('On-time delivery'))) &&
        (await visible(page.getByText('Low stock items'))) &&
        (await visible(page.getByText('Pending payouts'))),
    );
    check(
      'the dashboard states what is the shop’s to move and what is not',
      await visible(page.getByText('How work reaches you')),
    );

    // ------------------------------------------------ M02: where the work is
    check(
      'the dashboard shows where every order has got to',
      (await visible(page.getByText('Production status'))) &&
        (await page.locator('ul[aria-label="Production status"] > li').count()) === 6 &&
        (await visible(page.getByText('In production').first())),
      (await page.locator('ul[aria-label="Production status"]').textContent()) ?? '',
    );
    check(
      'a request waiting on an answer offers the way straight to the quote',
      (await visible(page.getByText('Requests needing an answer'))) &&
        (await page
          .locator('ul[aria-label="Requests needing an answer"] > li')
          .count()) >= 1 &&
        (await visible(
          page
            .locator('ul[aria-label="Requests needing an answer"]')
            .getByRole('link', { name: 'Send quote' })
            .first(),
        )),
    );
    check(
      'the stock panel reads what is free to promise, not the shelf count',
      (await visible(page.getByText('Inventory health'))) &&
        (await visible(page.getByRole('table', { name: 'Inventory health' }))),
    );
    check(
      'the money panel separates what is held from what was released',
      (await visible(page.getByText('Recent payouts'))) &&
        (await visible(page.getByText('Held', { exact: true }).first())) &&
        (await visible(page.getByText('Released', { exact: true }).first())),
    );
    check(
      'the activity feed says what happened in words, from the event log',
      (await visible(page.getByText('Recent activity'))) &&
        (await page.locator('ol[aria-label="Recent activity"] > li').count()) >= 1,
      (await page.locator('ol[aria-label="Recent activity"] > li').first().textContent()) ??
        '',
    );
    await page.screenshot({
      path: join(shotDir, 'dashboard.png'),
      fullPage: false,
    });

    // ------------------------------------------- M03: the inbox and a request
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Request Quote' })
      .click();
    await page.waitForURL(/\/rfqs/, { timeout: 15_000 });
    check(
      'the rail reaches the request inbox',
      await visible(page.getByRole('heading', { name: 'Request Quotes' })),
      page.url(),
    );
    check(
      'the inbox counts what is waiting, sent and closed',
      (await visible(page.getByText('Requests received'))) &&
        (await visible(page.getByText('Waiting on you'))) &&
        (await visible(page.getByText('Quotes sent'))) &&
        (await visible(page.getByText('Closed without a quote'))),
    );
    check(
      'both unanswered requests are in the inbox',
      (await visible(page.getByRole('link', { name: 'Rover Motor Driver v3' }))) &&
        (await visible(page.getByRole('link', { name: 'Gimbal Housing v2' }))),
    );
    check(
      'an unopened request reads as a new RFQ, in the shop own words',
      (await page.getByText('New RFQ').count()) >= 2,
    );
    await page.screenshot({ path: join(shotDir, 'rfq-inbox.png'), fullPage: false });

    // Filtering by kind of work is a real query, not a client-side hide.
    await page.goto(`${base}/rfqs?kind=module_3d`, { waitUntil: 'networkidle' });
    check(
      'the work-type filter narrows the inbox',
      (await visible(page.getByRole('link', { name: 'Gimbal Housing v2' }))) &&
        (await page.getByRole('link', { name: 'Rover Motor Driver v3' }).count()) === 0,
    );
    await page.goto(`${base}/rfqs?q=rover`, { waitUntil: 'networkidle' });
    check(
      'search finds a request by product name',
      (await visible(page.getByRole('link', { name: 'Rover Motor Driver v3' }))) &&
        (await page.getByRole('link', { name: 'Gimbal Housing v2' }).count()) === 0,
    );
    await page.goto(`${base}/rfqs?status=quoted`, { waitUntil: 'networkidle' });
    const quotedChips = await page.getByText('Quote sent').count();
    const quotedRows = await page.getByRole('row').count();
    check(
      'the status filter shows what has already been answered',
      quotedChips >= 1 && quotedRows >= 2,
      `${quotedRows} rows, ${quotedChips} chips`,
    );

    // ------------------------------------------------------ M03: the brief
    await page.goto(`${base}/rfqs`, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: 'Rover Motor Driver v3' }).click();
    await page.waitForURL(/\/rfqs\/mfrfix_rfq_driver/, { timeout: 15_000 });
    check(
      'the brief opens with the decision on the right',
      (await visible(page.getByRole('heading', { name: 'Rover Motor Driver v3' }))) &&
        (await visible(page.getByText('Submit Quote'))) &&
        (await visible(page.getByRole('button', { name: 'Decline' }))),
    );
    check(
      'the brief says what is being asked for',
      (await visible(page.getByText('Production requirement').first())) &&
        (await visible(page.getByText('General information'))) &&
        (await visible(page.getByText('400 units').first())),
    );
    check(
      'the buyer target price is labelled as theirs, not as a price',
      await visible(page.getByText(/target/i).first()),
    );
    check(
      'the client panel carries the buyer record, not invented skills',
      (await visible(page.getByText('About the client'))) &&
        (await visible(page.getByText('Requests sent on IDEEZA'))) &&
        (await visible(page.getByText('Member since'))),
    );
    await page.screenshot({ path: join(shotDir, 'rfq-brief.png'), fullPage: true });

    // Opening it is what tells the buyer it is being looked at.
    await page.goto(`${base}/rfqs`, { waitUntil: 'networkidle' });
    check(
      'opening a request records it as opened',
      await visible(
        page.getByRole('row', { name: /Rover Motor Driver v3/ }).getByText('Opened'),
      ),
    );

    // ---------------------------------------------- M03: files, spec and BOM
    await page.goto(`${base}/rfqs/mfrfix_rfq_driver/files`, {
      waitUntil: 'networkidle',
    });
    check(
      'the production files are listed with their revisions and kinds',
      (await visible(page.getByText('rover-motor-driver-v3-gerber.zip'))) &&
        (await visible(page.getByText('rover-motor-driver-assembly-notes.pdf'))) &&
        (await visible(page.getByText('Board data').first())),
    );
    check(
      'no download button pretends to serve bytes this build does not hold',
      (await page.getByRole('button', { name: /download/i }).count()) === 0 &&
        (await visible(
          page.getByText('File contents are not served in this environment'),
        )),
    );

    await page.goto(`${base}/rfqs/mfrfix_rfq_driver/specification`, {
      waitUntil: 'networkidle',
    });
    check(
      'the specification is read in words, never in stored tokens',
      (await visible(page.getByText('ENIG').first())) &&
        (await visible(page.getByText('IPC-A-600 Class 3').first())) &&
        (await page.getByText('ipc_class_3').count()) === 0 &&
        (await page.getByText('antistatic_bubble').count()) === 0,
    );
    check(
      'the board specification is on the same screen as the requirement',
      await visible(page.getByText('board specification')),
    );
    await page.screenshot({
      path: join(shotDir, 'rfq-specification.png'),
      fullPage: true,
    });

    await page.goto(`${base}/rfqs/mfrfix_rfq_driver/bom`, { waitUntil: 'networkidle' });
    const bomRows = await page
      .getByRole('table')
      .getByRole('row')
      .evaluateAll((rows) => rows.length);
    check(
      'every bill-of-materials line is listed with its part number',
      bomRows === 5 && (await visible(page.getByText('DRV8353RSRGZR'))),
      `${bomRows} rows`,
    );
    check(
      'the BOM says what the whole batch needs, not only one unit',
      await visible(page.getByText('2400 pcs')),
    );

    // ------------------------------- M04: inventory against the bill of materials
    check(
      'the stock column says what this shop can cover',
      (await visible(page.getByText('In stock').first())) &&
        (await visible(page.getByText('Short').first())) &&
        (await visible(page.getByText('Not stocked').first())),
    );
    check(
      'a shortage is stated before quoting, not after the order',
      (await visible(page.getByText('Inventory check required before quoting'))) &&
        (await visible(
          page.getByText('need a substitute suggestion', { exact: false }),
        )),
    );
    await page.screenshot({ path: join(shotDir, 'rfq-bom.png'), fullPage: true });

    await page.getByRole('button', { name: 'Manage substitute' }).click();
    const shortage = page.getByRole('dialog', { name: 'Missing parts' });
    check(
      'the shortage opens as a list of what is missing',
      (await visible(shortage)) &&
        (await visible(shortage.getByText('DRV8353 gate driver'))),
    );

    // The shop's own declared alternative is what it is offered first.
    const driverOptions = await shortage
      .getByLabel('Substitute for DRV8353 gate driver')
      .locator('option')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ''));
    check(
      'the shop’s own declared substitute is offered first',
      (driverOptions[1] ?? '').includes('DRV-8323RS'),
      driverOptions.join(' | ').slice(0, 140),
    );

    // A substitute with no reason the buyer could judge is refused.
    await shortage
      .getByLabel('Substitute for DRV8353 gate driver')
      .selectOption({ index: 1 });
    await shortage.getByRole('button', { name: /Save (all )?substitutes/ }).click();
    check(
      'a substitute with no reason is refused',
      await visible(shortage.getByText('say why this part can stand in', { exact: false })),
    );

    // With a reason on every line it saves, and the buyer will read it.
    const shortageNotes = [
      [
        'DRV8353 gate driver',
        'Same gate driver family, three phase, identical footprint and pinout.',
      ],
      [
        'N-channel MOSFET 60V 100A',
        'Same package and voltage class; the 80A rating covers this design.',
      ],
      [
        'Bulk capacitor 470uF 63V',
        'Same 470uF capacitance at a higher 100V rating, identical can size.',
      ],
    ];
    for (const [part, note] of shortageNotes) {
      const row = shortage.getByRole('row').filter({ hasText: part });
      const select = row.getByRole('combobox');
      if ((await select.locator('option').count()) > 1) {
        await select.selectOption({ index: 1 });
      }
      await row.getByRole('button', { name: /Add note|View note/ }).click();
      await shortage.getByLabel(`Note for ${part}`).fill(note);
    }

    await shortage.getByRole('button', { name: /Save (all )?substitutes/ }).click();
    check(
      'the substitutes are saved as suggestions for the buyer to decide',
      await visible(page.getByText('Substitute suggestions saved')),
    );

    await page.goto(`${base}/rfqs/mfrfix_rfq_driver/bom`, { waitUntil: 'networkidle' });
    check(
      'every shortage now carries a suggestion, and says so',
      (await visible(page.getByText('Substitute suggested').first())) &&
        (await visible(
          page.getByText('All of them have a suggestion', { exact: false }),
        )),
    );
    check(
      'the impact on price and lead time is stated, not left to be typed twice',
      (await page.getByText(/adds USD|saves USD|no price change on record/).count()) >= 1,
    );
    await page.screenshot({ path: join(shotDir, 'rfq-substitutes.png'), fullPage: true });

    // ----------------------------------------------------------- M05: quoting
    await page.goto(`${base}/rfqs/mfrfix_rfq_driver`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Submit Quote' }).click();
    const quoteModal = page.getByRole('dialog', { name: 'Submit quote' });
    check(
      'the quote form opens with the buyer’s ask beside it',
      (await visible(quoteModal)) &&
        (await visible(quoteModal.getByText('Request overview'))) &&
        (await visible(quoteModal.getByText('Buyer’s target'))),
    );
    check(
      'the quantity is the request’s and cannot be typed over',
      await quoteModal.getByLabel('Quantity').isDisabled(),
    );
    check(
      'a shortage answered by a substitute is not warned about again',
      (await quoteModal
        .getByText('Some parts are not covered by your stock')
        .count()) === 0,
    );

    // Terms the domain refuses, then terms it accepts.
    await quoteModal.getByLabel('Unit price (USD)').fill('12.40');
    await quoteModal.getByLabel('Lead time (days)').fill('0');
    await quoteModal.getByLabel('Materials and process').fill('FR4');
    await quoteModal.getByLabel('Payment and delivery terms').fill('50/50');
    await quoteModal.getByRole('button', { name: 'Submit' }).click();
    check(
      'a lead time of zero days is refused',
      await visible(quoteModal.getByText('at least one day', { exact: false })),
    );

    await quoteModal.getByLabel('Lead time (days)').fill('24');
    await quoteModal
      .getByLabel('Materials and process')
      .fill('FR-4 TG150, ENIG finish, SMT on the top side, AOI on 100% of boards.');
    await quoteModal
      .getByLabel('Payment and delivery terms')
      .fill('50% on confirmation, 50% before shipping. Ex-works Dhaka.');
    await quoteModal.getByLabel('Shipping estimate (USD)').fill('84.00');
    await quoteModal.getByLabel('Tooling and setup (USD)').fill('120.00');
    await quoteModal.getByLabel('Warranty').fill('12 months against manufacturing defects.');
    check(
      'the request’s other volumes are there to be priced',
      await visible(quoteModal.getByLabel('Unit price at 1000 units')),
    );
    await quoteModal.getByLabel('Unit price at 1000 units').fill('11.20');
    await quoteModal.getByLabel('Lead time at 1000 units').fill('30');
    check(
      'the total is computed from the unit price and the quantity',
      await visible(quoteModal.getByText('USD 4,960.00').first()),
    );

    await quoteModal.getByRole('button', { name: 'Submit' }).click();
    await page.waitForURL(/\/quotes\/[a-z0-9_]+$/, { timeout: 20_000 });
    check(
      'sending the quote lands on the quote itself',
      (await visible(page.getByRole('heading', { name: 'Rover Motor Driver v3' }))) &&
        (await visible(page.getByText('General information'))),
      page.url(),
    );
    check(
      'the quote states what the buyer pays and what is not the shop’s to quote',
      (await visible(page.getByText('Pricing breakdown'))) &&
        (await visible(page.getByText('USD 5,164.00').first())) &&
        (await visible(page.getByText('not yours to quote', { exact: false }))),
    );
    check(
      'the other volume it priced is on the quote',
      (await visible(page.getByText('The other volumes you priced'))) &&
        (await visible(page.getByText('1000 units').first())) &&
        (await visible(page.getByText('USD 11,200.00').first())),
    );
    await page.screenshot({ path: join(shotDir, 'quote-details.png'), fullPage: true });

    const quoteUrl = page.url();

    check(
      'the substitutes it carries are on their own tab, with the buyer’s decision',
      (await page.goto(`${quoteUrl}/substitutions`, { waitUntil: 'networkidle' })) !==
        null &&
        (await visible(page.getByText('Substitutes this quote suggests'))) &&
        (await visible(page.getByText('Waiting on the buyer').first())),
    );
    check(
      'the request it answers is beside it, read the same way',
      (await page.goto(`${quoteUrl}/rfq`, { waitUntil: 'networkidle' })) !== null &&
        (await visible(page.getByText('Production requirement').first())) &&
        (await visible(page.getByText('Substitutions with the buyer’s approval'))),
    );
    check(
      'the activity of the quote is the event log, not a summary',
      (await page.goto(`${quoteUrl}/activity`, { waitUntil: 'networkidle' })) !== null &&
        (await visible(page.getByText('sent this quote'))) &&
        (await visible(page.getByText('suggested a replacement part').first())),
    );

    // ------------------------------------------------------- M05: the revision
    await page.goto(quoteUrl, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Revise Quote' }).click();
    const reviseModal = page.getByRole('dialog', { name: 'Revise quote' });
    check(
      'revising opens with what the quote says now',
      (await visible(reviseModal)) &&
        (await reviseModal.getByLabel('Unit price (USD)').inputValue()) === '12.40',
    );
    await reviseModal.getByLabel('Unit price (USD)').fill('11.90');
    await reviseModal.getByRole('button', { name: 'Send the revision' }).click();
    await page.waitForTimeout(2_000);
    await page.goto(quoteUrl, { waitUntil: 'networkidle' });
    check(
      'the revision replaces the terms and keeps what they were',
      (await visible(page.getByText('What this quote said before'))) &&
        (await visible(page.getByText('USD 12.40 per unit', { exact: false }))),
    );

    // ------------------------------------------------------ M05: the quote list
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Quotes' })
      .click();
    await page.waitForURL(/\/quotes(\?|$)/, { timeout: 15_000 });
    check(
      'the rail reaches the quotes this shop has sent',
      (await visible(page.getByRole('heading', { name: 'Quotes' }))) &&
        (await visible(page.getByText('Quotes sent').first())) &&
        (await visible(page.getByText('With the buyer').first())),
    );
    check(
      'the quote is in the list with its price and its state',
      (await visible(page.getByRole('link', { name: 'Rover Motor Driver v3' }))) &&
        (await visible(page.getByText('USD 11.90').first())),
    );
    await page.screenshot({ path: join(shotDir, 'quotes-list.png'), fullPage: false });

    await page.goto(`${base}/quotes?status=accepted`, { waitUntil: 'networkidle' });
    check(
      'the status filter narrows the list',
      (await page.getByRole('link', { name: 'Rover Motor Driver v3' }).count()) === 0,
    );

    // A draft is not a quote anybody has answered, so it is not in the list.
    await page.goto(`${base}/quotes`, { waitUntil: 'networkidle' });
    check(
      'a draft quote is not in the list of what was sent',
      (await page.getByText('Draft', { exact: true }).count()) === 0,
    );

    // ----------------------------------------------------- M05: no second quote
    await page.goto(`${base}/rfqs/mfrfix_rfq_driver`, { waitUntil: 'networkidle' });
    check(
      'a request that has been quoted shows the quote instead of the form',
      (await visible(page.getByText('You quoted USD', { exact: false }))) &&
        (await page.getByRole('button', { name: 'Submit Quote' }).count()) === 0,
    );

    // ------------------------------------------------- M06: inventory management
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Inventory' })
      .click();
    await page.waitForURL(/\/inventory(\?|$)/, { timeout: 15_000 });
    check(
      'the rail reaches the inventory, and it counts what matters',
      (await visible(page.getByRole('heading', { name: 'Inventory management' }))) &&
        (await visible(page.getByText('Parts held'))) &&
        (await visible(page.getByText('Low stock').first())) &&
        (await visible(page.getByText('Parts reserved'))),
    );
    check(
      'availability is what is free to promise, beside what is on the shelf',
      (await visible(page.getByText('on the shelf').first())) &&
        (await visible(page.getByRole('link', { name: 'DRV8353 gate driver' }))),
    );
    await page.screenshot({ path: join(shotDir, 'inventory.png'), fullPage: false });

    // Filtering is a real query over two columns.
    await page.goto(`${base}/inventory?level=out_of_stock`, { waitUntil: 'networkidle' });
    const outOfStockRows = await page.getByRole('row').count();
    await page.goto(`${base}/inventory?q=DRV`, { waitUntil: 'networkidle' });
    check(
      'the filters narrow the parts table',
      (await visible(page.getByRole('link', { name: 'DRV8353 gate driver' }))) &&
        (await page.getByRole('link', { name: 'STM32G431 MCU' }).count()) === 0,
      `${outOfStockRows} rows out of stock`,
    );

    // ------------------------------------------------------- M06: adding a part
    await page.goto(`${base}/inventory`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '+ Add New part' }).click();
    const partDrawer = page.getByRole('dialog', { name: 'Add new part' });
    check(
      'adding a part asks for what the platform actually needs',
      (await visible(partDrawer)) &&
        (await visible(partDrawer.getByLabel('Part name'))) &&
        (await visible(partDrawer.getByLabel('Lead time (days)'))) &&
        (await visible(partDrawer.getByText('deliberately does not do'))),
    );

    await partDrawer.getByLabel('Part name').fill('Shunt resistor 1mR');
    await partDrawer.getByLabel('SKU / part code').fill('RES-1MR-2W');
    await partDrawer.getByLabel('Category').selectOption('Passives');
    await partDrawer.getByLabel('Stock quantity').fill('1200');
    await partDrawer.getByLabel('Price per unit (USD)').fill('0.42');
    await partDrawer.getByLabel('Low stock threshold').fill('300');
    await partDrawer.getByLabel('Lead time (days)').fill('0');
    await partDrawer.getByRole('button', { name: 'Add new part' }).click();
    check(
      'a part with no lead time is refused, because a substitute is dated from it',
      await visible(partDrawer.getByText('at least one day', { exact: false })),
    );

    await partDrawer.getByLabel('Lead time (days)').fill('5');
    await partDrawer.getByLabel('Storage location').fill('D2-01');
    await partDrawer.getByRole('button', { name: 'Add new part' }).click();
    await page.waitForURL(/\/inventory\/[a-z0-9_]+$/, { timeout: 20_000 });
    check(
      'the new part opens on its own screen, with its opening count recorded',
      (await visible(page.getByRole('heading', { name: 'Shunt resistor 1mR' }))) &&
        (await visible(page.getByText('Movement history'))) &&
        (await visible(page.getByText('Opening stock when the part was added'))),
      page.url(),
    );
    const partUrl = page.url();

    // ----------------------------------------------------- M06: moving the stock
    await page.getByRole('button', { name: 'Update stock' }).click();
    const stockModal = page.getByRole('dialog', { name: 'Update stock' });
    await stockModal.getByLabel('What happened').selectOption('stock_out');
    await stockModal.getByLabel('Quantity').fill('9000');
    await stockModal.getByRole('button', { name: 'Record the movement' }).click();
    check(
      'taking out more than the shop holds is refused',
      await visible(stockModal.getByText('are free to take out', { exact: false })),
    );

    await stockModal.getByLabel('What happened').selectOption('stock_in');
    await stockModal.getByLabel('Quantity').fill('300');
    await stockModal.getByLabel('Note').fill('Delivery 4471');
    await stockModal.getByRole('button', { name: 'Record the movement' }).click();
    await page.waitForTimeout(2_000);
    await page.goto(partUrl, { waitUntil: 'networkidle' });
    check(
      'the movement is on the history with what it left behind',
      (await visible(page.getByText('Stock in +300 pcs'))) &&
        (await visible(page.getByText('Delivery 4471'))) &&
        (await visible(page.getByText('1500 pcs').first())),
    );

    await page.getByRole('button', { name: 'Update price' }).click();
    const priceModal = page.getByRole('dialog', { name: 'Update price' });
    await priceModal.getByLabel('Price per unit (USD)').fill('0.48');
    await priceModal.getByLabel('Note').fill('Supplier increase');
    await priceModal.getByRole('button', { name: 'Save the new price' }).click();
    await page.waitForTimeout(2_000);
    await page.goto(partUrl, { waitUntil: 'networkidle' });
    check(
      'the price change is recorded and the old price stays on the history',
      (await visible(page.getByText('Price changed to USD 0.48'))) &&
        (await visible(page.getByText('Supplier increase'))),
    );
    await page.screenshot({ path: join(shotDir, 'inventory-part.png'), fullPage: true });

    // ------------------------------------------- M06: what cannot be deleted
    await page.goto(`${base}/inventory`, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: 'DRV8353 gate driver' }).click();
    await page.waitForURL(/\/inventory\/[a-z0-9_]+$/, { timeout: 15_000 });
    await page.getByRole('button', { name: 'Delete' }).click();
    check(
      'a part that has been suggested to a buyer cannot be deleted',
      (await visible(page.getByRole('dialog', { name: 'This part cannot be deleted' }))) &&
        (await visible(
          page.getByText('switch it off for matching', { exact: false }).first(),
        )),
    );
    await page.getByRole('button', { name: 'Close', exact: true }).last().click();

    // -------------------------------------------- M08: orders and production
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'My Orders' })
      .click();
    await page.waitForURL(/\/orders(\?|$)/, { timeout: 15_000 });
    check(
      'the rail reaches the orders, and they count what a shop plans on',
      (await visible(page.getByRole('heading', { name: 'My orders' }))) &&
        (await visible(page.getByText('In flight'))) &&
        (await visible(page.getByText('Past the quoted date').first())) &&
        (await visible(page.getByText('Needing attention'))),
    );
    check(
      'each order says where it has got to, against the canonical stages',
      (await visible(page.getByRole('link', { name: 'Beacon Light Board' }))) &&
        (await visible(page.getByText(/\d\/10/).first())),
    );
    await page.screenshot({ path: join(shotDir, 'orders.png'), fullPage: false });

    // ------------------------------------------ M08: what the platform owns
    await page.goto(`${base}/orders/mfrfix_order_beacon`, { waitUntil: 'networkidle' });
    check(
      'the order opens on its production stages, all ten of them',
      (await visible(page.getByText('Production tracking'))) &&
        (await visible(page.getByText('In Production').first())) &&
        (await page.locator('ol[aria-label="Production stages"] > li').count()) === 10,
      page.url(),
    );
    check(
      'a stage the platform owns is not offered to the shop, and says so',
      (await visible(page.getByText('The platform moves this one').first())) &&
        (await page.getByText(/Waiting for In Production to finish/).count()) >= 1,
      (await page.locator('ol[aria-label="Production stages"] > li').nth(5).textContent()) ?? '',
    );
    check(
      'the money is held, and the screen says what releases it',
      (await visible(page.getByText('Held by IDEEZA'))) &&
        (await visible(page.getByText('documented event', { exact: false }).first())),
    );
    await page.screenshot({ path: join(shotDir, 'order-production.png'), fullPage: true });

    // --------------------------------------------- M08: attaching a record
    const productionRow = page
      .getByRole('listitem')
      .filter({ hasText: 'In Production' })
      .first();
    await productionRow.getByRole('button', { name: /Move In Production/ }).click();
    await page.getByRole('menuitem', { name: 'Attach a record' }).click();
    const recordModal = page.getByRole('dialog', { name: /Attach a record/ });
    await recordModal.getByLabel('Title').fill('AOI report, batch 1 of 2');
    await recordModal.getByLabel('What it says').fill('No defects on 250 boards.');
    await recordModal.getByRole('button', { name: 'Attach' }).click();
    await page.waitForTimeout(2_000);
    await page.goto(`${base}/orders/mfrfix_order_beacon`, { waitUntil: 'networkidle' });
    check(
      'the record is on the order for both sides to read',
      (await visible(page.getByText('Records on this order'))) &&
        (await visible(page.getByText('AOI report, batch 1 of 2'))),
    );

    // ------------------------------------------------- M08: moving the line
    await productionRow.getByRole('button', { name: /Move In Production/ }).click();
    await page.getByRole('menuitem', { name: 'Complete' }).click();
    await page.waitForTimeout(2_500);
    await page.goto(`${base}/orders/mfrfix_order_beacon`, { waitUntil: 'networkidle' });
    check(
      'completing a stage completes the tasks under it',
      (await page
        .getByRole('listitem')
        .filter({ hasText: 'In Production' })
        .first()
        .getByText('Completed')
        .count()) >= 1,
    );

    // ------------------------------------------- M08: shipping and delivery
    for (const label of ['Quality Check', 'Ready to Ship']) {
      const row = page.getByRole('listitem').filter({ hasText: label }).first();
      await row.getByRole('button', { name: new RegExp(`Move ${label}`) }).click();
      await page.getByRole('menuitem', { name: 'Complete' }).click();
      await page.waitForTimeout(2_500);
      await page.goto(`${base}/orders/mfrfix_order_beacon`, { waitUntil: 'networkidle' });
    }
    check(
      'the shop can record the shipment once the order is ready',
      await visible(page.getByRole('button', { name: 'Record the shipment' })),
    );

    await page.getByRole('button', { name: 'Record the shipment' }).click();
    const shipModal = page.getByRole('dialog', { name: 'Record the shipment' });
    await shipModal.getByLabel('Courier').fill('DHL Express');
    await shipModal.getByLabel('Tracking reference').fill('1Z999AA10123456784');
    check(
      'recording a shipment says plainly that it does not release the money',
      await visible(shipModal.getByText('does not release your money', { exact: false })),
    );
    await shipModal.getByRole('button', { name: 'Record it' }).click();
    await page.waitForTimeout(2_500);
    await page.goto(`${base}/orders/mfrfix_order_beacon`, { waitUntil: 'networkidle' });
    check(
      'the shipment is recorded as a record the buyer can read',
      await visible(page.getByText('1Z999AA10123456784', { exact: false }).first()),
    );

    await page.getByRole('button', { name: 'Record delivery' }).click();
    const deliverModal = page.getByRole('dialog', { name: 'Record delivery' });
    check(
      'recording delivery says only the buyer can confirm it',
      await visible(
        deliverModal.getByText('Only the buyer can confirm delivery', { exact: false }),
      ),
    );
    await deliverModal.getByLabel('What the courier reported').fill('Signed by R. Khan');
    await deliverModal.getByRole('button', { name: 'Record it' }).click();
    await page.waitForTimeout(2_500);
    await page.goto(`${base}/orders/mfrfix_order_beacon`, { waitUntil: 'networkidle' });
    check(
      'the order reads as delivered, with the review window on it',
      (await visible(page.getByText('Review window ends'))) &&
        (await visible(page.getByText('Delivered').first())),
    );

    // ------------------------------------------------- M08: the other tabs
    await page.goto(`${base}/orders/mfrfix_order_beacon/quote`, {
      waitUntil: 'networkidle',
    });
    check(
      'the terms it was opened against are the frozen snapshot, with its checksum',
      (await visible(page.getByText('The terms this order was opened against'))) &&
        (await visible(page.getByText('Snapshot checksum', { exact: false }))),
    );
    await page.goto(`${base}/orders/mfrfix_order_beacon/files`, {
      waitUntil: 'networkidle',
    });
    check(
      'the production files are the request’s own files',
      await visible(page.getByText('beacon-light-board-gerber.zip')),
    );
    await page.goto(`${base}/orders/mfrfix_order_beacon/specification`, {
      waitUntil: 'networkidle',
    });
    check(
      'the specification is the same document, read the same way',
      (await visible(page.getByText('Production requirement').first())) &&
        (await visible(page.getByText('HASL (lead free)').first())),
    );

    // ------------------------------------------- M08: a shortage stops the line
    await page.goto(`${base}/orders/seed_order_1`, { waitUntil: 'networkidle' });
    check(
      'an unanswered shortage stops production, and says so',
      (await visible(page.getByText('Production is held for a shortage'))) &&
        (await visible(page.getByText('Part shortages on this order'))),
    );

    await page.getByRole('button', { name: 'Raise a part shortage' }).click();
    const shortageModal = page.getByRole('dialog', { name: 'Raise a part shortage' });
    await shortageModal.getByLabel('Reference').fill('U3');
    await shortageModal.getByLabel('Part name').fill('SiK telemetry radio 915MHz');
    await shortageModal.getByLabel('How many short').fill('120');
    await shortageModal.getByLabel('What happened').fill('short');
    await shortageModal.getByRole('button', { name: 'Raise it' }).click();
    check(
      'a shortage with no reason the buyer could decide on is refused',
      await visible(shortageModal.getByText('needs the reason', { exact: false })),
    );
    await shortageModal
      .getByLabel('What happened')
      .fill('Our supplier cancelled the allocation and nothing arrives for six weeks.');
    await shortageModal.getByRole('button', { name: 'Raise it' }).click();
    await page.waitForTimeout(2_500);
    await page.goto(`${base}/orders/seed_order_1`, { waitUntil: 'networkidle' });
    check(
      'the shortage is raised for the buyer to answer, with the three answers named',
      (await page.getByText('SiK telemetry radio 915MHz').count()) >= 1 &&
        (await visible(page.getByText('Waiting on the buyer').first())),
    );

    // --------------------------------------------- M08: asking to cancel
    await page.getByRole('button', { name: 'Ask IDEEZA to cancel' }).click();
    const cancelModal = page.getByRole('dialog', { name: /Ask IDEEZA to cancel/ });
    check(
      'cancelling a funded order is a request, and the screen says whose decision it is',
      await visible(cancelModal.getByText('Operations decides', { exact: false })),
    );
    await cancelModal.getByRole('button', { name: 'Keep building' }).click();


    // ------------------------------------- M09: a refund claim, and the case
    // The shop's side of refunds and disputes had no browser coverage at all,
    // which is why the wording and the case reference could drift from the
    // buyer's. This walks it: the claim, the two answers the design offers, the
    // amount a shop may accept, and the case that comes out of a challenge.
    await page.goto(`${base}/orders/verify_order_delivered`, { waitUntil: 'networkidle' });
    const claimBody = ((await page.locator('main').innerText()) ?? '').replace(/\s+/g, ' ');
    check(
      'a refund claim reaches the shop with the two answers the design offers',
      (await visible(page.getByText('has claimed a refund of', { exact: false }))) &&
        (await visible(page.getByRole('button', { name: 'Approve' }))) &&
        (await visible(page.getByRole('button', { name: 'Dispute' }))),
      claimBody.slice(0, 130),
    );
    check(
      'the claim is quoted by the shared reference, in shared words',
      /CLAIM-[0-9A-Z]{8}/.test(claimBody) &&
        /Failed the quality check/.test(claimBody) &&
        !/failed_quality_check/.test(claimBody),
      (claimBody.match(/CLAIM-[0-9A-Z]{8}[^.]*/) ?? ['(no reference)'])[0].slice(0, 110),
    );
    check(
      'the claim says what silence costs, with a date on it',
      /Answer by /.test(claimBody),
    );

    // The design lets a shop accept in full or accept an amount of its own.
    await page.getByRole('button', { name: 'Approve' }).click();
    const approveModal = page.getByRole('dialog', { name: /Answer this refund claim/ });
    check(
      'accepting offers the full claim or an amount of the shop’s own',
      (await visible(approveModal.getByText('How much of the claim do you accept?'))) &&
        (await visible(approveModal.getByRole('radio', { name: /The full/ }))) &&
        (await visible(approveModal.getByRole('radio', { name: /An amount of your own/ }))),
    );
    await approveModal.getByRole('radio', { name: /An amount of your own/ }).check();
    check(
      'choosing an amount asks for it, bounded by what was claimed',
      await visible(approveModal.getByLabel(/Amount you accept/)),
    );
    await approveModal.getByLabel(/Amount you accept/).fill('999999');
    await approveModal.getByRole('button', { name: 'Offer this amount' }).click();
    await page.waitForTimeout(2_000);
    check(
      'more than the claim is refused rather than recorded',
      await visible(page.getByText('cannot accept more than the buyer claimed', { exact: false })),
    );
    await approveModal.getByLabel(/Amount you accept/).fill('120.00');
    await approveModal.getByRole('button', { name: 'Offer this amount' }).click();
    await page.waitForTimeout(2_500);
    await page.goto(`${base}/orders/verify_order_delivered`, { waitUntil: 'networkidle' });
    const answered = ((await page.locator('main').innerText()) ?? '').replace(/\s+/g, ' ');
    check(
      'the answer is recorded on the claim, and the shop cannot answer twice',
      /You have answered/.test(answered) &&
        (await page.getByRole('button', { name: 'Approve' }).count()) === 0,
      answered.slice(0, 120),
    );

    // ------------------------------------------------ M03: another shop row
    // A request that was never routed to this shop must show nothing of itself.
    // The status stays 200 because the shell streams behind its loading state
    // before the page can decide, and Next cannot change a status mid-stream —
    // so what is asserted is what the visitor is shown and not shown.
    const notMine = await page.goto(`${base}/rfqs/verify_rfq_draft`, {
      waitUntil: 'networkidle',
    });
    const notMineBody = (await page.content()).replace(/\s+/g, ' ');
    const missingScreen = await page.request.get(
      `${base}/rfqs/verify_rfq_draft/decline`,
      { maxRedirects: 0 },
    );
    check(
      'a request that was never routed here is not readable',
      notMineBody.includes('Page not found') &&
        !notMineBody.includes('Thermal Camera Bracket'),
      `page ${notMine?.status() ?? 0}, a route with a rule but no screen ${missingScreen.status()}`,
    );

    // ------------------------------------------------------- M03: declining
    await page.goto(`${base}/rfqs/mfrfix_rfq_housing`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Decline' }).click();
    check(
      'declining asks for the reason the buyer will read',
      await visible(page.getByRole('dialog', { name: 'Decline this request?' })),
    );
    await page
      .getByRole('dialog')
      .getByLabel('Reason')
      .selectOption('capacity_unavailable');
    await page
      .getByRole('dialog')
      .getByLabel('Note for the buyer')
      .fill('Our SLS line is fully booked until the end of next month.');
    await page.getByRole('button', { name: 'Decline request' }).click();
    await page.waitForURL(/\/rfqs(\?|$)/, { timeout: 20_000 });
    check(
      'a declined request leaves the inbox with its reason recorded',
      await visible(
        page.getByRole('row', { name: /Gimbal Housing v2/ }).getByText('Declined'),
      ),
      page.url(),
    );
    await page.goto(`${base}/rfqs/mfrfix_rfq_housing`, { waitUntil: 'networkidle' });
    check(
      'the request itself says it was declined and why',
      (await visible(page.getByText('You declined this request'))) &&
        (await visible(page.getByText('No capacity in the window asked for'))),
    );
    check(
      'a declined request offers no decline button',
      (await page.getByRole('button', { name: 'Decline' }).count()) === 0,
    );

    // ------------------------------------------------- M01: the guard holds
    const forbidden = await page.goto(`${base}/manufacturing`, {
      waitUntil: 'networkidle',
    });
    check(
      'a buyer route is refused in the browser too',
      (forbidden?.status() ?? 0) !== 200 ||
        (await visible(page.getByText('not part of the manufacturer panel'))),
      String(forbidden?.status() ?? 0),
    );

    // A buyer account cannot use this panel at all. It gets its own browser
    // context rather than signing the member out: two sessions, no interference.
    const buyerContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const buyerPage = await buyerContext.newPage();
    await signIn(buyerPage, base, BUYER_EMAIL);
    check(
      'a buyer account is refused this panel',
      buyerPage.url().includes('/forbidden') ||
        (await visible(buyerPage.getByText('cannot use the manufacturer panel'))),
      buyerPage.url(),
    );
    await buyerContext.close();

    // ------------------------------------------- M11: what the bell counts
    await page.goto(`${base}/notifications`, { waitUntil: 'networkidle' });
    check(
      'the bell has a screen behind it, with what the platform said',
      (await visible(page.getByRole('heading', { name: 'Notifications' }))) &&
        (await page.locator('ul[aria-label="Notifications"] > li').count()) === 3 &&
        (await visible(page.getByText('A request reached your shop'))),
      page.url(),
    );
    check(
      'the unread filter is its own linkable list',
      await visible(page.getByRole('link', { name: /Unread/ })),
    );
    await page.getByRole('link', { name: /Unread/ }).click();
    await page.waitForURL(/filter=unread/, { timeout: 15_000 }).catch(() => undefined);
    await page.waitForLoadState('networkidle');
    check(
      'only the unread ones are listed, and the read one is not deleted',
      (await page.locator('ul[aria-label="Notifications"] > li').count()) === 2,
      page.url(),
    );
    await page.getByRole('button', { name: 'Mark all as read' }).click();
    await page.waitForTimeout(2_000);
    await page.reload({ waitUntil: 'networkidle' });
    check(
      'marking everything read empties the unread list without deleting anything',
      await visible(page.getByText('Nothing unread')),
    );
    // -------------------------------------- M15: the row menus actually go
    // A menu item that renders but navigates nowhere passed every check here
    // for months, because the checks opened screens by address. These open the
    // menu and press it.
    for (const list of [
      { path: '/rfqs', item: 'View details', lands: /\/rfqs\/[^/]+$/ },
      { path: '/quotes', item: 'Quote details', lands: /\/quotes\/[^/]+$/ },
      { path: '/orders', item: 'Production stages', lands: /\/orders\/[^/]+$/ },
      { path: '/inventory', item: 'View details and history', lands: /\/inventory\/[^/]+$/ },
    ]) {
      let target = null;
      let isLink = false;
      // The wait is armed before the press, because a soft navigation can finish
      // inside the same tick and a wait started afterwards would miss it. Three
      // presses, because the answer being looked for here is "does this menu go
      // anywhere at all" — a press dropped while the list is still settling is
      // not that answer.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await page.goto(`${base}${list.path}`, { waitUntil: 'networkidle' });
        await page.locator('tbody tr button', { hasText: '⋮' }).first().click();
        const entry = page.getByRole('menuitem', { name: list.item }).first();
        if (attempt === 0) {
          isLink = await entry.evaluate((node) => node.tagName === 'A').catch(() => false);
          target = await entry.getAttribute('href').catch(() => null);
        }
        await Promise.all([
          page.waitForURL(list.lands, { timeout: 15_000 }).catch(() => undefined),
          entry.click(),
        ]);
        if (list.lands.test(new URL(page.url()).pathname)) break;
      }
      check(
        `the ${list.path} row menu offers "${list.item}" as a link`,
        isLink,
        list.path,
      );
      check(
        `pressing it arrives somewhere`,
        list.lands.test(new URL(page.url()).pathname),
        `href ${target} → ${page.url()}`,
      );
    }

    // ----------------------------------------------------- the tutorial, read
    //
    // The rail's first "for you" row used to be unavailable. It is a screen
    // now, so the walk is the one a reader takes: the index, a card, the lesson
    // it opens, and a second lesson from the chapter tree. What is asserted at
    // each step is that the words arrived, not that a route resolved.
    await page.goto(`${base}/tutorial`, { waitUntil: 'networkidle' });
    check(
      'the tutorial index lists its categories',
      await visible(page.getByRole('heading', { name: 'Tutorial categories' })),
    );
    const writtenCard = page.getByRole('link', { name: /Code \(Tech\)/ });
    check('a written category is a link', (await writtenCard.count()) > 0);

    // A category with nothing in it must not pretend otherwise.
    check(
      'a category with nothing written says so',
      await visible(page.getByText('Not written yet — nothing to read here.').first()),
    );

    if ((await writtenCard.count()) > 0) {
      // Two facts, asserted separately rather than through one click: the card
      // points at its category, and that address opens the first lesson. A
      // category has no page of its own — it redirects — and pinning both ends
      // is steadier than racing a client navigation that has to resolve a
      // redirect before the heading it is waited on can exist.
      check(
        'the card points at its category',
        (await writtenCard.first().getAttribute('href')) === '/tutorial/code-tech',
        String(await writtenCard.first().getAttribute('href')),
      );

      await page.goto(`${base}/tutorial/code-tech`, { waitUntil: 'networkidle' });
      check(
        'the lesson is on the page',
        await visible(page.getByRole('heading', { name: 'Introduction', level: 1 })),
      );
      check(
        'a category opens on its first lesson',
        /\/tutorial\/code-tech\//.test(page.url()),
        page.url(),
      );
      check(
        'its headings are there for the contents list to point at',
        await visible(page.getByRole('heading', { name: 'IDEEZA AI Model' })),
      );

      // The reward is shown and cannot be taken, because nothing could pay it.
      const claim = page.getByRole('button', { name: /Claim / }).first();
      check('the token reward is offered', (await claim.count()) > 0);
      check('and it is honestly inert', await claim.isDisabled().catch(() => false));

      // The chapter tree, pinned at both ends rather than through the click.
      //
      // The click itself is not a steady thing to assert here: on a loaded
      // machine the client navigation sometimes does not happen at all, and
      // sometimes happens on the second press — measured over several runs of
      // this harness, both with and without a wait for React to attach. That is
      // worth chasing on its own, and it is written down in
      // docs/MANUFACTURER-SIDE-PLAN.md rather than left as a check that fails
      // for a reason nobody remembers.
      //
      // What can be pinned, and is what the tree is for: the link points at the
      // next lesson, and that address is a page with that lesson on it. The
      // category card three checks above is asserted the same way, for the same
      // reason.
      const other = page.getByRole('link', { name: 'Intro to collaboration' });
      check('the chapter tree lists the next lesson', (await other.count()) > 0);
      if ((await other.count()) > 0) {
        check(
          'and points at it',
          (await other.first().getAttribute('href')) ===
            '/tutorial/code-tech/intro-to-collaboration',
          String(await other.first().getAttribute('href')),
        );

        await page.goto(`${base}/tutorial/code-tech/intro-to-collaboration`, {
          waitUntil: 'networkidle',
        });
        check(
          'and that address is the lesson it named',
          await visible(page.getByRole('heading', { name: 'Sharing and permissions' })),
        );
      }
    }

    // ------------------------------- the machine floor list, add, edit, remove
    //
    // The tab was a count and a name per machine, which is not what the design
    // shows a buyer: a machine card carries the process, its sub-processes, the
    // tolerance it holds and its turnaround. What is worth checking here is not
    // the shape — a screenshot shows that — but that the three buttons do what
    // they say, because the complaint that rebuilt this tab was one where
    // nothing behind them worked.
    await page.goto(`${base}/profile`, { waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: /Machine/ }).first().click();
    await page.waitForTimeout(400);

    const machineCards = page.locator('main ul > li');
    const seeded = await machineCards.count();
    check('the machine tab lists the shop’s floor', seeded > 0, `${seeded} cards`);
    check(
      'each card carries what the design shows',
      /Process/.test(await machineCards.first().innerText()) &&
        /Tolerance/.test(await machineCards.first().innerText()) &&
        /TAT/.test(await machineCards.first().innerText()),
    );

    await page.getByRole('button', { name: 'Add New' }).click();
    const machineForm = page.getByRole('dialog', { name: 'Add Manufacturing Capability' });
    check('Add New opens the capability form', await visible(machineForm));

    if (await visible(machineForm)) {
      await machineForm.getByLabel('Machine').selectOption('Laser Cutter');
      await machineForm.getByLabel('Select Process').selectOption('Sheet Metal Fabrication');
      // Sub-processes belong to the chosen process; a second choice adds a
      // second chip rather than replacing the first.
      await machineForm.getByLabel('Select Sub-Process').selectOption('Laser cutting');
      await machineForm.getByLabel('Select Sub-Process').selectOption('Bending');
      await machineForm.getByLabel('Tolerance').selectOption('plus or minus 0.1 mm');
      await machineForm.getByLabel('Turnaround time').fill('4-6 Days');
      await machineForm.getByRole('button', { name: 'Add', exact: true }).click();
      await machineForm.waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});

      // Four to a page, so a fifth machine is on page two — the pager working.
      const pager = page.getByRole('navigation', { name: 'Pagination' });
      const paged = await visible(pager, 20_000);
      check('a fifth machine pages the grid', paged);
      if (paged) {
        await pager.getByRole('button').nth(-2).click();
        await page.waitForTimeout(400);
      }

      const added = page.locator('main ul > li').filter({ hasText: 'Laser Cutter' }).first();
      const arrived = await visible(added, 20_000);
      check('the machine is added', arrived);

      if (arrived) {
        const text = (await added.innerText()).replace(/\s+/g, ' ');
        check(
          'the card carries every field the form took',
          /Sheet Metal Fabrication/.test(text) &&
            /Laser cutting/.test(text) &&
            /Bending/.test(text) &&
            /plus or minus 0.1 mm/.test(text) &&
            /4-6 Days/.test(text),
          text.slice(0, 120),
        );

        await clearToasts(page);
        await added.getByRole('button', { name: /Actions for/ }).click();
        await page.getByRole('menuitem', { name: 'Edit' }).click();
        const editForm = page.getByRole('dialog', { name: 'Edit Manufacturing Capability' });
        const editing = await visible(editForm);
        check('the kebab’s Edit opens the form already filled', editing);

        if (editing) {
          check(
            'and it is filled with the machine, not blank',
            (await editForm.getByLabel('Turnaround time').inputValue()) === '4-6 Days',
          );
          await editForm.getByLabel('Turnaround time').fill('2-3 Days');
          await editForm.getByRole('button', { name: 'Save', exact: true }).click();
          await editForm.waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});

          const changed = page.locator('main ul > li').filter({ hasText: 'Laser Cutter' }).first();
          await visible(changed, 20_000);
          let landed = false;
          for (let attempt = 0; attempt < 30 && !landed; attempt += 1) {
            await page.waitForTimeout(500);
            landed = (await changed.count()) > 0 && (await changed.innerText()).includes('2-3 Days');
          }
          check('the edit lands on the card', landed);

          check(
            'and the kebab’s Delete takes it off the floor',
            await removeCard(page, page.locator('main ul > li'), 'Laser Cutter'),
          );
        }
      }
    }

    // ------------------------ the capability sheets: publish, rewrite, take down
    //
    // The tab used to be one card of matching rules and a list nobody could
    // change. The design's tab is a sheet per kind of work — the answers a
    // buyer reads after a request has reached the shop — with a form that asks
    // a different set of questions for each kind. Three things are worth
    // checking: the form follows the kind, publishing lands on the card, and
    // rewriting a verified sheet stops it claiming to be verified.
    await page.goto(`${base}/profile`, { waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: 'Capabilities' }).first().click();
    await page.waitForTimeout(400);

    const sheetCards = page.locator('main ul > li');
    check(
      'the capability tab lists a sheet per kind of work',
      (await sheetCards.count()) > 0,
      `${await sheetCards.count()} sheets`,
    );
    const firstSheet = (await sheetCards.first().innerText()).replace(/\s+/g, ' ');
    check(
      'each sheet shows its parameters and whether IDEEZA has read it',
      /Parameters/.test(firstSheet) && /Verification Status/.test(firstSheet),
      firstSheet.slice(0, 90),
    );

    await page.getByRole('button', { name: 'Add New' }).click();
    const sheetForm = page.getByRole('dialog', { name: 'Add New Capability' });
    check('Add New opens the capability form', await visible(sheetForm));

    if (await visible(sheetForm)) {
      // Add Now stays out of reach until the required answers are there — the
      // design draws it grey, and a form that accepts a half-answered sheet
      // publishes a card with holes in it.
      check(
        'Add Now waits for the required answers',
        await sheetForm.getByRole('button', { name: 'Add Now' }).isDisabled(),
      );

      await sheetForm.getByLabel('Select Capability type').selectOption('cnc_machining');
      await page.waitForTimeout(300);
      // The questions follow the kind: CNC asks about axes, not layer counts.
      const asked = (await sheetForm.innerText()).replace(/\s+/g, ' ');
      check(
        'the questions follow the kind of work',
        /Axis Support/.test(asked) && !/Supported Layers/.test(asked),
        asked.slice(0, 90),
      );

      await sheetForm.getByRole('button', { name: '3-Axis' }).click();
      await sheetForm.getByRole('button', { name: '5-Axis' }).click();
      await sheetForm.getByLabel('Tolerance').selectOption('plus or minus 0.05mm');
      await sheetForm.getByLabel('Max work Area').selectOption('800 x 500 x 400 mm');
      await sheetForm.getByLabel('Build Time').fill('7-10 business days');

      check(
        'and Add Now is reachable once they are answered',
        !(await sheetForm.getByRole('button', { name: 'Add Now' }).isDisabled()),
      );
      await sheetForm.getByRole('button', { name: 'Add Now' }).click();
      await sheetForm.waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});

      const published = page.locator('main ul > li').filter({ hasText: 'CNC Machining' }).first();
      const arrived = await visible(published, 20_000);
      check('the sheet is published', arrived);

      if (arrived) {
        const card = (await published.innerText()).replace(/\s+/g, ' ');
        check(
          'the card carries every answer, and only the answered ones',
          /3-Axis/.test(card) &&
            /5-Axis/.test(card) &&
            /plus or minus 0.05mm/.test(card) &&
            /7-10 business days/.test(card) &&
            !/Finish/.test(card),
          card.slice(0, 130),
        );
        // Nobody at IDEEZA has read it, and the card says so rather than
        // wearing a badge the platform cannot stand behind.
        check('a new sheet is pending, not verified', /Pending/.test(card));

        // Rewriting a verified sheet must take its badge off.
        const verified = page
          .locator('main ul > li')
          .filter({ hasText: 'PCB Manufacturing' })
          .first();
        if ((await verified.count()) > 0) {
          check(
            'the seeded sheet starts verified',
            /Verified/.test(await verified.innerText()),
          );
          await clearToasts(page);
          await verified.getByRole('button', { name: /Actions for/ }).click();
          await page.getByRole('menuitem', { name: 'Edit' }).click();
          const editForm = page.getByRole('dialog', { name: 'Edit Capability' });
          const editing = await visible(editForm);
          check('Edit opens the sheet already answered', editing);
          if (editing) {
            check(
              'and its kind is fixed, because a sheet cannot change what it is for',
              await editForm.getByLabel('Select Capability type').isDisabled(),
            );
            await editForm.getByLabel('Build Time').fill('12-24 Hours');
            await editForm.getByRole('button', { name: 'Save changes' }).click();
            await editForm.waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});

            let pendingNow = false;
            for (let attempt = 0; attempt < 30 && !pendingNow; attempt += 1) {
              await page.waitForTimeout(500);
              const again = page
                .locator('main ul > li')
                .filter({ hasText: 'PCB Manufacturing' })
                .first();
              pendingNow =
                (await again.count()) > 0 &&
                (await again.innerText()).includes('12-24 Hours') &&
                (await again.innerText()).includes('Pending');
            }
            check('rewriting it lands, and stops it claiming to be verified', pendingNow);
          }
        }

        check(
          'and Delete takes the sheet down',
          await removeCard(page, page.locator('main ul > li'), 'CNC Machining'),
        );
      }
    }

    // What actually decides whether a request reaches this shop moved to the
    // tab its neighbours are on. It is load-bearing, so its absence would be a
    // regression rather than a tidy-up.
    await page.getByRole('tab', { name: 'Service & certification' }).first().click();
    await page.waitForTimeout(400);
    check(
      'the matching record is still reachable, beside the certifications',
      await visible(page.getByText('What buyers are matched on')),
    );

    // ------------------- service, certification, review, blog and the shop's people
    //
    // The four remaining profile tabs. Each one used to be a placeholder or a
    // list nobody could change; each one now reads a table. What is checked is
    // the same thing every time: the tab shows what the design shows, and the
    // controls on it write something.
    await page.goto(`${base}/profile`, { waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: 'Service & certification' }).first().click();
    await page.waitForTimeout(400);

    const serviceTab = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    check(
      'the certificates carry their issuer, what they cover, and whose word they are',
      /ISO 9001/.test(serviceTab) &&
        /ISO Organization/.test(serviceTab) &&
        /Quality Management/.test(serviceTab) &&
        /Verified/.test(serviceTab) &&
        /Pending/.test(serviceTab),
      serviceTab.slice(serviceTab.indexOf('Certifications'), serviceTab.indexOf('Certifications') + 110),
    );
    check(
      'the equipment count and the services are both on the tab',
      /Equipment/.test(serviceTab) && /SMT Lines/.test(serviceTab) && /Service/.test(serviceTab),
    );

    // Adding a certificate: the name fills the rest in, and it lands pending.
    await page.getByRole('button', { name: /Add New/ }).first().click();
    const certForm = page.getByRole('dialog', { name: 'Add new certification' });
    check('Add New opens the certification form', await visible(certForm));
    if (await visible(certForm)) {
      await certForm.getByLabel('Certification name').selectOption('AS9100D');
      await page.waitForTimeout(200);
      check(
        'choosing the name fills in what it covers and who issues it',
        (await certForm.getByLabel('Category').inputValue()) === 'Aerospace Quality' &&
          (await certForm.getByLabel('Issuing Authority').inputValue()) === 'IAQG',
      );
      await certForm.getByRole('button', { name: 'Add', exact: true }).click();
      await certForm.waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});

      const added = page.locator('main li').filter({ hasText: 'AS9100D' }).first();
      const arrived = await visible(added, 20_000);
      check('the certificate is added', arrived);
      if (arrived) {
        // A shop's own claim is Pending until IDEEZA has seen the certificate.
        check('and it is pending, because nobody has seen it', /Pending/.test(await added.innerText()));
        check(
          'and Delete takes it off the profile',
          await removeCard(page, page.locator('main li'), 'AS9100D'),
        );
      }
    }

    // The equipment count is a different question from what a machine can do.
    const equipmentAdd = page.getByRole('button', { name: /Add New/ }).nth(1);
    await equipmentAdd.click();
    const equipForm = page.getByRole('dialog', { name: 'Add New Equipment' });
    check('Equipment has its own form', await visible(equipForm));
    if (await visible(equipForm)) {
      await equipForm.getByLabel('Equipment Name').fill('Selective Solder');
      await equipForm.getByLabel('Quantity').fill('2');
      await equipForm.getByRole('button', { name: 'Add', exact: true }).click();
      await equipForm.waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});
      const counted = page.locator('main li').filter({ hasText: 'Selective Solder' }).first();
      const there = await visible(counted, 20_000);
      check('the count is added, padded as the design pads it', there);
      if (there) {
        check('and it reads as a count', /02/.test(await counted.innerText()));
        check(
          'and it can be taken off again',
          await removeCard(page, page.locator('main li'), 'Selective Solder'),
        );
      }
    }

    // What actually decides whether a request reaches this shop is still here,
    // and still editable, from the tab its neighbours are on.
    check(
      'the matching record is still reachable, beside the certifications',
      await visible(page.getByText('What buyers are matched on')),
    );

    // ------------------------------------------------------------------ review
    await page.getByRole('tab', { name: 'Review' }).first().click();
    await page.waitForTimeout(400);
    const reviewTab = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    check(
      'the review tab counts, averages and spreads them',
      /Total Reviews/.test(reviewTab) &&
        /Average Rating/.test(reviewTab) &&
        (await page.getByRole('list', { name: 'Ratings breakdown' }).count()) === 1,
    );
    check(
      'and each review carries what it cost and how long it took',
      /Total price/.test(reviewTab) && /Project duration/.test(reviewTab),
      reviewTab.slice(reviewTab.indexOf('Total price'), reviewTab.indexOf('Total price') + 60),
    );

    // -------------------------------------------------------------------- blog
    await page.getByRole('tab', { name: 'Blog' }).first().click();
    await page.waitForTimeout(400);
    const blogTab = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    check(
      'the blog tab reads as articles rather than as a status table',
      /Why we ask about your test plan/.test(blogTab) && /A board that cannot be tested/.test(blogTab),
      blogTab.slice(0, 90),
    );
    // A rejection still owes its reason, or a shop is told no and left to guess.
    check('and a rejected article still carries the reason', /Reads as advertising/.test(blogTab));

    // ------------------------------------------------------------------- agent
    await page.getByRole('tab', { name: 'Agent' }).first().click();
    await page.waitForTimeout(400);
    check(
      'the agent tab is the shop’s own people',
      await visible(page.getByText('Director of Engineering')),
    );
    // Inviting somebody needs an account this build cannot create, and the
    // control says so rather than opening a form that goes nowhere.
    check(
      'and Add New admits it cannot invite anyone yet',
      await page.getByRole('button', { name: 'Add New' }).first().isDisabled(),
    );

    const person = page.locator('main ul > li').first();
    await clearToasts(page);
    await person.getByRole('button', { name: /Actions for/ }).click();
    await page.getByRole('menuitem', { name: 'Edit role' }).click();
    const roleForm = page.getByRole('dialog', { name: 'Edit role' });
    if (await visible(roleForm)) {
      await roleForm.getByLabel('Role').fill('Head of Quality');
      await roleForm.getByRole('button', { name: 'Save' }).click();
      await roleForm.waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});
      let renamed = false;
      for (let attempt = 0; attempt < 30 && !renamed; attempt += 1) {
        await page.waitForTimeout(500);
        renamed = (await page.locator('main').innerText()).includes('Head of Quality');
      }
      check('a role can be set, and it lands on the card', renamed);
    }

    // ------------------------------------ the blog: written here, kept, and read
    //
    // The screen used to hold articles in React state and say so on the page,
    // which meant the profile's Blog tab — reading the table — showed a shop
    // nothing it had ever written. So the walk is: write one, send it, reload,
    // and find it on the profile. A reload is the whole point of the check.
    await page.goto(`${base}/blog`, { waitUntil: 'networkidle' });
    check(
      'the blog screen lists this shop’s own articles',
      await visible(page.getByRole('button', { name: 'Write an article' }).first()),
    );

    const title = 'How we read a stack-up before quoting';
    await page.getByRole('button', { name: 'Write an article' }).first().click();
    const editor = page.getByRole('dialog', { name: /Write an article|Edit the article/ });
    check('and opens an editor', await visible(editor));

    if (await visible(editor)) {
      await editor.getByLabel('Title').fill(title);
      await editor.getByLabel('Category').selectOption('PCB design');
      await editor.getByLabel('Tags').fill('stack-up, impedance');

      // Too short is refused here rather than left for a reviewer to bounce.
      await editor.getByLabel('The article').fill('Too short.');
      await editor.getByRole('button', { name: 'Send for review' }).click();
      await page.waitForTimeout(1_200);
      check(
        'an article nobody could learn from is refused',
        await visible(page.getByText('A few sentences at least', { exact: false })),
      );

      await editor
        .getByLabel('The article')
        .fill(
          'A four layer board quoted from a gerber alone is a guess. We open the stack-up first, because the copper weights and the dielectric decide the impedance, and the impedance decides whether the board works at all.',
        );
      await editor.getByRole('button', { name: 'Send for review' }).click();
      await editor.waitFor({ state: 'detached', timeout: 30_000 }).catch(() => {});
      await clearToasts(page);

      // The reload is the assertion: state in a component would not survive it.
      await page.reload({ waitUntil: 'networkidle' });
      const kept = page.locator('main').filter({ hasText: title });
      check('what was written survives a reload', await visible(kept, 20_000));
      check(
        'and it is with IDEEZA, because a shop cannot publish itself',
        (await page.locator('main').innerText()).includes('With IDEEZA'),
      );

      // And the profile tab is the same table, read the other way round.
      await page.goto(`${base}/profile`, { waitUntil: 'networkidle' });
      await page.getByRole('tab', { name: 'Blog' }).first().click();
      await page.waitForTimeout(600);
      check(
        'the profile’s Blog tab shows it too — one table, two views',
        (await page.locator('main').innerText()).includes(title),
      );

      // Put the shop back as it was.
      await page.goto(`${base}/blog`, { waitUntil: 'networkidle' });
      const card = page.locator('main').getByRole('button', { name: 'Delete' });
      if ((await card.count()) > 0) {
        await clearToasts(page);
        await card.first().click();
        let left = 1;
        for (let poll = 0; poll < 40 && left > 0; poll += 1) {
          await page.waitForTimeout(500);
          left = await page.locator('main').filter({ hasText: title }).count();
        }
        check('and it can be deleted again', left === 0);
      }
    }

    // ------------------------------------------ reporting a problem, end to end
    //
    // The rail's last row used to read "Help and Feedback — n/a". It opens the
    // Figma dialog now, and the only claim worth checking is that a filled-in
    // report actually leaves: the form clears, the toast appears, and the row
    // the data layer wrote is the one the reporter typed. The row itself is
    // asserted in apps/manufacturer/test/problem-report.db.test.ts; here the
    // question is whether a person can get from the rail to a sent report.
    await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    const reportRow = page.getByRole('button', { name: 'Report a problem' });
    check('the rail offers a way to report a problem', (await reportRow.count()) > 0);

    if ((await reportRow.count()) > 0) {
      await reportRow.first().click();
      const dialog = page.getByRole('dialog', { name: 'Report a Problem' });
      check('it opens the dialog', await visible(dialog));

      // Submitting nothing must not send: the form says what is missing.
      await dialog.getByRole('button', { name: 'Submit' }).click();
      await page.waitForTimeout(300);
      check(
        'an empty report is refused with the fields named',
        await visible(dialog.getByText('A title says what the problem is.')),
      );

      await dialog.getByLabel('Title').fill('The payout total disagreed with the rows');
      await dialog
        .getByLabel('What type of issue are you experiencing?')
        .selectOption('technical_bug');
      await dialog.getByLabel('How frustrated are you with this issue?').selectOption('annoying');
      await dialog
        .getByLabel('Describe the problem in detail')
        .fill('The header said one figure and the six listed rows said another.');

      // Nothing from the page may paint over the dialog. This is not
      // hypothetical: the dialog first lived inside the rail, the rail sits in
      // a `sticky` wrapper, and a sticky element is a stacking context — so a
      // table cell on the dashboard painted straight over the Submit button and
      // the click landed on the page behind. The check asks the browser what is
      // actually on top of the button.
      const covered = await page.evaluate(() => {
        const submit = [...document.querySelectorAll('button')].find(
          (element) => element.textContent?.trim() === 'Submit',
        );
        if (submit === undefined) return 'no submit button';
        const box = submit.getBoundingClientRect();
        const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return top === submit || submit.contains(top) ? null : (top?.tagName ?? 'nothing');
      });
      check('nothing on the page covers the dialog', covered === null, String(covered));

      // The page field is filled from the route, not typed.
      check(
        'the page it happened on is filled in already',
        (await dialog.getByLabel('Page name').inputValue()) === '/dashboard',
      );

      await dialog.getByRole('button', { name: 'Submit' }).click();
      const sent = await page
        .getByText('Thank you — the report was sent.')
        .waitFor({ state: 'visible', timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      check('a filled-in report is sent, and says so', sent);
      check('the dialog closes once it is sent', (await dialog.count()) === 0);
    }

    // ------------------------------------------------- M01: the phone layout
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const phonePage = await phone.newPage();
    await signIn(phonePage, base, MEMBER_EMAIL);
    //
    // Asked as a swipe rather than as a measurement. `scrollWidth` answers a
    // different question and answers it wrongly here: it counts boxes that are
    // clipped out of sight, so it reports trouble on pages that have none, and
    // it stayed quiet on the pages that did. What the reader feels is whether
    // the page moves, so the page is told to move and asked where it went.
    //
    // One screen was never enough either. The dashboard has no wide table on
    // it; every list does, and every list was sliding.
    const slide = async (target) => {
      await phonePage.goto(`${base}${target}`, { waitUntil: 'networkidle' });
      return phonePage.evaluate(() => {
        window.scrollTo(9999, 0);
        const x = window.scrollX;
        window.scrollTo(0, 0);
        return x;
      });
    };

    for (const target of [
      '/dashboard',
      '/rfqs',
      '/quotes',
      '/orders',
      '/inventory',
      '/payouts',
      '/notifications',
    ]) {
      const slipped = await slide(target);
      check(`${target} does not scroll sideways on a phone`, slipped <= 1, `${slipped}px`);
    }
    await phonePage.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    await phonePage.getByRole('button', { name: 'Open navigation' }).click();
    check(
      'the rail becomes a drawer on a phone',
      await visible(phonePage.getByRole('dialog', { name: 'Navigation' })),
    );
    await phonePage.screenshot({ path: join(shotDir, 'dashboard-390.png') });
    await phone.close();

    check(
      'no console errors in the browser',
      consoleErrors.length === 0,
      consoleErrors.slice(0, 2).join(' | '),
    );
    const unexpectedFailures = networkFailures.filter(
      (failure) => !failure.includes('/decline'),
    );
    check(
      'no failed network requests',
      unexpectedFailures.length === 0,
      unexpectedFailures.slice(0, 2).join(' | '),
    );

    await browser.close();

    const serverErrors = appLog
      .join('')
      .split('\n')
      .filter((line) => /\berror\b|unhandled|uncaught/i.test(line))
      .filter((line) => !/prisma:info|Compiled|ready in/i.test(line));
    check(
      'the server log contains no errors',
      serverErrors.length === 0,
      serverErrors.slice(0, 2).join(' | '),
    );
  } finally {
    appProcess?.kill();
    await postgres.stop().catch(() => undefined);
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      process.stdout.write('could not remove the temporary database directory\n');
    }
  }

  process.stdout.write(`\n${results.length - failures}/${results.length} checks passed\n`);
  process.stdout.write(`screenshots in ${shotDir}\n`);
  if (failures > 0) process.exitCode = 1;
};

main().catch((error) => {
  process.stderr.write(`${String(error?.stack ?? error)}\n`);
  process.exitCode = 1;
});
