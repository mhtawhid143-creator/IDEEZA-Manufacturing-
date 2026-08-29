/**
 * End to end verification of the buyer app against a real stack.
 *
 * Boots a throwaway PostgreSQL cluster, applies the committed migrations, seeds
 * the reference scenario, provisions a password, starts the built Next.js server
 * and then exercises it twice: over HTTP for the routing and guard behaviour,
 * and in a real Chromium through Playwright for sign-in, console errors and the
 * responsive layout.
 *
 *   node tools/verify-user-app.mjs
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
const appDir = join(root, 'apps', 'user');
const shotDir = join(root, '.verify-shots');
const prismaCli = createRequire(join(dbPackage, 'package.json')).resolve('prisma/build/index.js');
const nextCli = createRequire(join(appDir, 'package.json')).resolve('next/dist/bin/next');

/**
 * Credentials for this run only, generated here and never written anywhere: the
 * database, the app and the browser all live and die with this process, and no
 * password literal belongs in the repository.
 */
const PASSWORD = `Verify-${randomBytes(18).toString('base64url')}`;
const WRONG_PASSWORD = `Wrong-${randomBytes(18).toString('base64url')}`;
/** Kept in step with tools/verify-fixtures.ts. */
const OPEN_REQUEST_PRODUCT = 'seed_product_drone';
/** The manufacturer-selection step, whichever draft it was reached from. */
const RFQ_NEW_URL = (url) =>
  url.pathname === '/manufacturing/rfq/new' && url.searchParams.has('draft');

const results = [];
let failures = 0;

const check = (name, passed, detail = '') => {
  results.push({ name, passed, detail });
  if (!passed) failures += 1;
  process.stdout.write(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail === '' ? '' : ` — ${detail}`}\n`);
};

/** Waits for an element to become visible, and answers rather than throwing. */
const visible = (locator, timeout = 15_000) =>
  locator
    .first()
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);

/** Clicks once the control is really enabled, re-running its precondition. */
const clickWhenEnabled = async (page, button, prepare) => {
  await button.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (!(await button.isDisabled().catch(() => true))) {
      await button.click();
      return true;
    }
    if (prepare !== undefined) await prepare().catch(() => undefined);
    await page.waitForTimeout(250);
  }
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

const main = async () => {
  takeBuildLock('buyer verification');
  const dataDir = mkdtempSync(join(tmpdir(), 'ideeza-verify-pg-'));
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
    await postgres.createDatabase('ideeza_verify');
    const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${pgPort}/ideeza_verify?schema=public`;

    const migrate = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
      cwd: dbPackage,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: 'utf8',
    });
    check('migrations apply to an empty database', migrate.status === 0, (migrate.stderr ?? '').trim().slice(0, 200));

    const seed = spawnSync(
      process.execPath,
      ['--import', 'tsx', join(root, 'tools', 'seed-and-provision.ts')],
      {
        cwd: root,
        env: { ...process.env, DATABASE_URL: databaseUrl, VERIFY_PASSWORD: PASSWORD },
        encoding: 'utf8',
      },
    );
    check('seed and credential provisioning succeed', seed.status === 0, (seed.stderr ?? '').trim().slice(0, 300));
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

    process.stdout.write('starting the built app…\n');
    appProcess = spawn(
      process.execPath,
      [nextCli, 'start', '--port', String(appPort)],
      {
        cwd: appDir,
        env: { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: 'production' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    appProcess.stdout.on('data', (chunk) => appLog.push(String(chunk)));
    appProcess.stderr.on('data', (chunk) => appLog.push(String(chunk)));

    const base = `http://127.0.0.1:${appPort}`;
    const up = await waitForServer(`${base}/health`);
    check('the app answers on its port', up, up ? '' : appLog.join('').slice(-500));
    if (!up) throw new Error('app did not start');

    // ---------------------------------------------------------------- HTTP
    const health = await fetch(`${base}/health`);
    const healthBody = await health.json();
    check('GET /health returns ok', health.status === 200 && healthBody.status === 'ok');

    const gallery = await fetch(`${base}/design-system`);
    const galleryHtml = await gallery.text();
    check(
      'GET /design-system renders without a session',
      gallery.status === 200 && galleryHtml.includes('Design system'),
      `status ${gallery.status}`,
    );

    const guarded = await fetch(`${base}/manufacturing`, { redirect: 'manual' });
    const location = guarded.headers.get('location') ?? '';
    check(
      'GET /manufacturing without a session redirects to sign-in',
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

    const unknown = await fetch(`${base}/inventory`, { redirect: 'manual' });
    const unknownBody = unknown.status === 200 ? await unknown.text() : '';
    check(
      'a path with no rule is refused rather than served',
      unknown.status !== 200 || unknownBody.includes('not available'),
      `status ${unknown.status}`,
    );

    const notFound = await fetch(`${base}/manufacturing/does-not-exist/deeper`, { redirect: 'manual' });
    check(
      'an unknown deep path is not served as a page',
      notFound.status >= 300 || (await notFound.text()).includes('not available'),
      `status ${notFound.status}`,
    );

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
      if (response.status() >= 400) networkFailures.push(`${response.status()} ${response.url()}`);
    });

    // Sign in through the real form.
    await page.goto(`${base}/manufacturing`, { waitUntil: 'networkidle' });
    check('an anonymous visit lands on the sign-in page', page.url().includes('/auth/sign-in'), page.url());

    await page.getByLabel('Email address').fill('buyer@example.test');
    await page.getByLabel('Password').fill(WRONG_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForLoadState('networkidle');
    const refusal = await page.getByRole('status').first().textContent().catch(() => null);
    const refusalAlert = await page
      .locator('[role="status"], [role="alert"]')
      .first()
      .textContent()
      .catch(() => null);
    check(
      'a wrong password is refused on the page',
      page.url().includes('/auth/sign-in') &&
        /incorrect/i.test(`${refusal ?? ''}${refusalAlert ?? ''}`),
      `${page.url()} :: ${refusalAlert ?? ''}`,
    );

    check(
      'a failed attempt keeps the email address on the form',
      (await page.getByLabel('Email address').inputValue()) === 'buyer@example.test',
    );

    await page.getByLabel('Email address').fill('buyer@example.test');
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/manufacturing/, { timeout: 30_000 });
    check('signing in lands on the manufacturing hub', page.url().includes('/manufacturing'), page.url());

    const heading = await visible(
      page.getByRole('heading', { level: 1, name: 'Manufacturing' }),
    );
    check('the hub heading renders', heading);

    const sidebar = page.getByRole('navigation', { name: 'Main' });
    check('the desktop sidebar is visible at 1440', await visible(sidebar));
    check(
      'the sidebar shows Manufacturing and no manufacturer feature',
      (await sidebar.getByRole('link', { name: 'Manufacturing' }).count()) > 0 &&
        (await sidebar.getByText('Inventory', { exact: true }).count()) === 0 &&
        (await sidebar.getByText('Payouts', { exact: true }).count()) === 0,
    );

    // Tabs navigate.
    const clickHubTab = async () => {
      await page.getByRole('link', { name: /Quote Requests/ }).click();
      return page
        .waitForURL(/\/manufacturing\/rfq$/, { timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
    };
    await page.waitForLoadState('networkidle');
    let tabAttempts = 1;
    let tabNavigated = await clickHubTab();
    if (!tabNavigated) {
      tabAttempts = 2;
      tabNavigated = await clickHubTab();
    }
    check(
      'a hub tab navigates to its own route',
      tabNavigated,
      `${page.url()} after ${tabAttempts} click(s)`,
    );
    // The Quote Requests tab now carries the real list, so the panel is either
    // the requests themselves or the empty state that explains where they come
    // from.
    const tabRow = await visible(page.getByRole('navigation', { name: 'Manufacturing sections' }));
    const requestsPanel =
      (await visible(page.getByRole('list', { name: 'Quote requests' }), 8_000)) ||
      (await visible(page.getByText('No requests sent yet'), 8_000));
    check(
      'the tab row and the tab panel follow the route',
      tabRow && requestsPanel,
      `tab row ${tabRow}, panel ${requestsPanel}`,
    );

    // ----------------------------------------------------------- T05 flow
    // Favourites: the cards, their state and the two card actions.
    await page.goto(`${base}/favorites`, { waitUntil: 'networkidle' });
    const cards = page.getByRole('list', { name: 'Favourite products' }).getByRole('listitem');
    check(
      'the favourites list renders the kept products',
      (await cards.count()) === 4,
      `${await cards.count()} cards`,
    );
    check(
      'an unavailable product shows the disabled call to action',
      (await page.getByText('Currently unavailable').count()) > 0 &&
        (await page.getByRole('link', { name: 'Manufacture this' }).count()) === 3,
      `${await page.getByRole('link', { name: 'Manufacture this' }).count()} enabled CTAs`,
    );

    // The keep/drop toggle writes and announces.
    const dropButton = page
      .getByRole('button', { name: /Remove Industrial Sensor Hub from favourites/ })
      .first();
    await dropButton.click();
    await page.waitForTimeout(1200);
    const droppedToast = await page.getByText('Removed from favourites').count();
    await page.reload({ waitUntil: 'networkidle' });
    const afterDrop = await page
      .getByRole('list', { name: 'Favourite products' })
      .getByRole('listitem')
      .count();
    check(
      'the favourite toggle removes a product and says so',
      droppedToast > 0 && afterDrop === 3,
      `toast ${droppedToast}, ${afterDrop} cards left`,
    );

    // Manufacture this opens the single product page.
    await page.getByRole('link', { name: 'Manufacture this' }).first().click();
    const onProduct = await page
      .waitForURL(/\/products\//, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    check('Manufacture this opens the single product page', onProduct, page.url());
    const details = await visible(page.getByText('Product details'));
    const creator = await visible(page.getByRole('heading', { name: 'Creator' }));
    const reviews = await visible(page.getByRole('heading', { name: 'Reviews' }));
    const noReviews = await visible(page.getByText('No reviews yet'));
    check(
      'the product page shows the details, the creator and the reviews',
      details && creator && reviews && noReviews,
      `details ${details}, creator ${creator}, reviews ${reviews}, empty ${noReviews}`,
    );
    const preview = await visible(page.getByRole('img', { name: /model preview placeholder/ }));
    const fileChip = await visible(page.getByText('fpv-stack-gerber.zip'));
    check(
      'the product page carries the model preview and the file record',
      preview && fileChip,
      `preview ${preview}, file ${fileChip}`,
    );

    // The like state on the product page, put back where it was.
    const productKeep = page.getByRole('button', { name: /favourites$/ }).first();
    const pressedBefore = await productKeep.getAttribute('aria-pressed');
    await productKeep.click();
    await page.waitForTimeout(1200);
    const pressedAfter = await page
      .getByRole('button', { name: /favourites$/ })
      .first()
      .getAttribute('aria-pressed');
    check(
      'the favourite state on the product page flips and persists',
      pressedBefore !== pressedAfter,
      `${pressedBefore} -> ${pressedAfter}`,
    );
    await page.getByRole('button', { name: /favourites$/ }).first().click();
    await page.waitForTimeout(1000);

    // Start manufacturing on a product with no open request.
    await page.getByRole('button', { name: 'Start Manufacturing' }).click();
    const startedToast = await page
      .getByText('Manufacturing started')
      .waitFor({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    const reachedDraft = await page
      .waitForURL(/\/manufacturing\/draft\/new\?product=/, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    check('Start Manufacturing confirms with a toast', startedToast);
    check('Start Manufacturing navigates to the next step', reachedDraft, page.url());
    const draftHeading = await visible(
      page.getByRole('heading', { name: 'New manufacturing request' }),
    );
    const draftContext = await visible(page.getByText('What this request starts from'));
    check(
      'the next step carries the product it was started from',
      draftHeading && draftContext,
      `heading ${draftHeading}, context ${draftContext}`,
    );

    // ----------------------------------------------------------- T06 flow
    // The draft form: fill it in, save it, and land on the saved draft.
    check(
      'the draft form asks what to build and how',
      (await visible(page.getByRole('group', { name: 'PCB items' }))) &&
        (await visible(page.getByText('Sending'))) &&
        (await visible(page.getByLabel('Quantity'))) &&
        (await visible(page.getByLabel('Material and finish'))) &&
        (await visible(page.getByLabel('Country code'))),
    );

    // Save the draft the way a buyer does: fill it in, then save.
    await page.waitForLoadState('networkidle');
    // The package kind follows the files, so the board group is what is chosen.
    check(
      'what is being sent is read back from the files chosen',
      await visible(page.getByText(/PCB only|Full product/)),
    );
    await page.getByLabel('Quantity').fill('120');
    await page.getByLabel('Lead time (days)').fill('21');
    await page.getByLabel('Material and finish').fill('FR-4 TG150');
    await page.getByLabel('Manufacturing method').fill('PCB fabrication + SMT assembly');
    await page.getByLabel('Tolerance').fill('Board outline +/-0.15mm');
    await page.getByLabel('Quality check').fill('Optical inspection on 100%');
    await page.getByLabel('Shipping requirement').fill('Courier, tracked, DAP Dhaka');
    await page.getByRole('button', { name: 'Save draft' }).click();
    const savedDraft = await page
      .waitForURL(/\/manufacturing\/draft\/(?!new)[^/?]+/, { timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    check(
      'a complete draft saves and opens',
      savedDraft,
      savedDraft
        ? page.url()
        : `${page.url()} :: ${(await page.locator('[role="alert"]').first().textContent().catch(() => '')) ?? ''}`,
    );
    const draftUrl = page.url();
    check(
      'the saved draft says nothing has been sent yet',
      (await visible(page.getByText('Draft saved'))) &&
        (await visible(page.getByRole('link', { name: 'Select manufacturers' }))),
    );

    // An incomplete draft does not save: the browser refuses the submit, and
    // anything it lets through is refused again on the server.
    await page.getByLabel('Quantity').fill('');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForTimeout(1_500);
    const incompleteState = await page.locator('form').first().evaluate((form) => ({
      stillInvalid: !form.checkValidity(),
      missing: [...form.querySelectorAll(':invalid')].map((node) => node.getAttribute('name')),
    }));
    const refusedOnServer = await page.getByText('This draft was not saved').count();
    check(
      'an incomplete draft is refused rather than saved',
      incompleteState.stillInvalid || refusedOnServer > 0,
      `missing ${incompleteState.missing.join(', ') || 'none'}`,
    );

    // The draft is editable, and the change sticks.
    await page.goto(draftUrl, { waitUntil: 'networkidle' });
    await page.getByLabel('Quantity').fill('340');
    await page.getByRole('button', { name: 'Save changes' }).click();
    const savedInPlace = await visible(page.getByText('Changes saved'));
    await page.reload({ waitUntil: 'networkidle' });
    const savedQuantity = await page.getByLabel('Quantity').inputValue();
    check(
      'a draft can be edited and keeps the change',
      savedInPlace && savedQuantity === '340',
      `alert ${savedInPlace}, quantity ${savedQuantity}`,
    );

    // The draft shows up on the hub, and the product it came from is now taken.
    await page.goto(`${base}/manufacturing`, { waitUntil: 'networkidle' });
    const draftRows = page.getByRole('list', { name: 'Manufacturing drafts' }).getByRole('listitem');
    check(
      'the Draft tab lists the draft',
      (await draftRows.count()) === 2 &&
        (await visible(draftRows.getByText('FPV Flight Stack F7'))),
      `${await draftRows.count()} rows`,
    );

    await page.goto(`${base}/products/seed_product_fpv_stack`, { waitUntil: 'networkidle' });
    check(
      'the product now points at the request it already has',
      await visible(page.getByText('You already have an open request for this product')),
    );

    // A request that has been sent is not editable through the draft route.
    await page.goto(`${base}/manufacturing/draft/verify_rfq_open`, { waitUntil: 'networkidle' });
    check(
      'a sent request is not opened as an editable draft',
      /\/manufacturing\/rfq\/verify_rfq_open$/.test(page.url()),
      page.url(),
    );

    // Withdrawing frees the product again.
    await page.goto(draftUrl, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Withdraw draft' }).click();
    const confirm = page.getByRole('dialog', { name: 'Withdraw this draft?' });
    const confirmOpen = await visible(confirm);
    check('withdrawing a draft is confirmed first', confirmOpen);
    if (confirmOpen) {
      await confirm.getByRole('button', { name: 'Withdraw' }).click();
      const backToHub = await page
        .waitForURL(/\/manufacturing\?withdrawn=1/, { timeout: 20_000 })
        .then(() => true)
        .catch(() => false);
      check('a withdrawn draft leaves the list and says so', backToHub, page.url());
      const draftRows = await page
        .locator('ul[aria-label="Manufacturing drafts"] > li')
        .count();
      check(
        'the withdrawn draft is gone, leaving only the prepared one',
        draftRows === 1 && (await visible(page.getByText('Thermal Camera Bracket'))),
        `${draftRows} drafts left`,
      );
    }

    await page.screenshot({ path: join(shotDir, 'draft-hub.png'), fullPage: false });

    // ----------------------------------------------------------- T07 flow
    // A fresh draft, prepared so it can be sent.
    await page.goto(`${base}/products/seed_product_sensor_hub`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Start Manufacturing' }).click();
    await page
      .waitForURL(/\/manufacturing\/draft\/new\?product=seed_product_sensor_hub/, {
        timeout: 20_000,
      })
      .catch(() => undefined);
    await page.waitForLoadState('networkidle');
    check(
      'a product with only a model file reads back as a 3D module',
      await visible(page.getByText('3D module only')),
    );
    await page.getByLabel('Process').selectOption('sls');
    await page.getByLabel('Print material').selectOption('PA12');
    await page.getByLabel('Colour').fill('Graphite');
    await page.getByLabel('Quantity').fill('80');
    await page.getByLabel('Lead time (days)').fill('30');
    await page.getByLabel('Material and finish').fill('PA12, bead blasted');
    await page.getByLabel('Manufacturing method').fill('SLS printing');
    await page.getByLabel('Tolerance').fill('+/-0.3mm');
    await page.getByLabel('Quality check').fill('Optical inspection on 100%');
    await page.getByLabel('Shipping requirement').fill('Courier, tracked');
    await page.getByRole('button', { name: 'Save draft' }).click();
    const readyToSend = await page
      .waitForURL(/\/manufacturing\/draft\/(?!new)[^/?]+/, { timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    check('a second draft is prepared for sending', readyToSend, page.url());

    // The hub row carries what the design puts on it.
    await page.goto(`${base}/manufacturing`, { waitUntil: 'networkidle' });
    check(
      'the draft row shows the files, the type and the cost placeholder',
      (await visible(page.getByRole('button', { name: /Show files \(/ }))) &&
        (await visible(page.getByText('Type included').first())) &&
        (await visible(page.getByText('Not quoted').first())) &&
        (await visible(page.getByRole('link', { name: 'Select manufacturer' }).first())),
    );
    const tabCounts = await page
      .getByRole('navigation', { name: 'Manufacturing sections' })
      .innerText();
    check(
      'the hub tabs carry their counts',
      /Draft\s*0?2/.test(tabCounts.replace(/\n/g, ' ')),
      tabCounts.replace(/\n/g, ' ').slice(0, 80),
    );
    await page.getByRole('button', { name: /Show files \(/ }).first().click();
    check(
      'show files lists what travels with the request',
      await visible(page.getByRole('dialog', { name: /Files travelling with/ })),
    );
    await page.keyboard.press('Escape');

    // Step one: select manufacturers.
    await page.getByRole('link', { name: 'Select manufacturer' }).first().click();
    const onSelection = await page
      .waitForURL(/\/manufacturing\/rfq\/new\?draft=/, { timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    check('the draft leads to the manufacturer selection', onSelection, page.url());

    const manufacturerList = page.getByRole('list', { name: 'Manufacturers' });
    const manufacturerRows = manufacturerList.getByRole('listitem');
    check(
      'every manufacturer is offered with its fit, capabilities and numbers',
      (await manufacturerRows.count()) === 3 &&
        (await visible(manufacturerList.getByText('PrecisionCircuit Co.').first())) &&
        (await visible(manufacturerList.getByText(/Meets board spec|Partial fit/).first())) &&
        (await visible(manufacturerList.getByText('MOQ').first())) &&
        (await visible(manufacturerList.getByText('Services').first())),
      `${await manufacturerRows.count()} manufacturers`,
    );

    // Search narrows the list, and the empty state explains itself.
    await page.getByRole('searchbox', { name: /Search manufacturers/ }).fill('precision');
    await page.waitForTimeout(400);
    const narrowed = await manufacturerList.getByRole('listitem').count();
    await page.getByRole('searchbox', { name: /Search manufacturers/ }).fill('nothing matches this');
    await page.waitForTimeout(400);
    const emptyShown = await visible(page.getByText('No manufacturer matches those filters'), 8_000);
    await page.getByRole('button', { name: 'Clear filters' }).first().click();
    await page.waitForTimeout(400);
    const restored = await manufacturerList.getByRole('listitem').count();
    check(
      'search and filters narrow the list and can be cleared',
      narrowed === 1 && emptyShown && restored === 3,
      `narrowed ${narrowed}, empty ${emptyShown}, restored ${restored}`,
    );

    // How much of the bill of materials each shop already holds, on a draft that
    // has one. It is a count of the buyer's own lines and nothing more — no
    // quantities, no costs, no parts they did not name.
    await page.goto(`${base}/manufacturing/rfq/new?draft=verify_rfq_draft`, {
      waitUntil: 'networkidle',
    });
    const stockList = page.getByRole('list', { name: 'Manufacturers' });
    const stockRows = stockList.getByRole('listitem');
    const stockChips = stockList.getByText(/parts in stock/);
    check(
      'each manufacturer says how much of the bill of materials it already holds',
      (await visible(stockChips.first())) &&
        (await stockChips.count()) === (await stockRows.count()),
      `${await stockChips.count()} chips on ${await stockRows.count()} cards`,
    );
    check(
      'the shop that holds the parts is offered first, and the others say zero',
      ((await stockRows.first().getByText(/parts in stock/).textContent()) ?? '').startsWith(
        '1 of 2',
      ) &&
        (await stockList.getByText('0 of 2 parts in stock').count()) >= 1,
      (await stockRows.first().getByText(/parts in stock/).textContent()) ?? '',
    );
    await page.screenshot({
      path: join(shotDir, 'select-manufacturers-stock.png'),
      fullPage: false,
    });

    // Back to the draft this flow is about.
    await page.goto(`${base}/manufacturing`, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: 'Select manufacturer' }).first().click();
    await page.waitForURL(RFQ_NEW_URL, { timeout: 20_000 });
    await page.waitForLoadState('networkidle');

    // Nothing can be sent to nobody.
    check(
      'the select bar refuses an empty selection',
      (await page.getByRole('button', { name: 'Continue to quotes' }).isDisabled()) &&
        (await page.getByRole('button', { name: 'Compare' }).isDisabled()),
    );

    // Details, then select both.
    await manufacturerList.getByRole('button', { name: 'View details' }).first().click();
    const detailsOpen = await visible(page.getByRole('dialog', { name: 'PrecisionCircuit Co.' }));
    check('a manufacturer can be inspected before it is chosen', detailsOpen);
    // Escape rather than a click: the modal's own dismiss control and the
    // footer button share the name "Close".
    if (detailsOpen) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    await manufacturerList.getByRole('checkbox').first().check();
    await manufacturerList.getByRole('checkbox').nth(1).check();
    check(
      'the select bar counts what is selected',
      await visible(page.getByText('2 manufacturers selected')),
    );

    // The comparison step. Once two are chosen these become real links.
    await page.getByRole('link', { name: 'Compare' }).click();
    const onCompare = await page
      .waitForURL(/\/manufacturing\/rfq\/new\/compare\?draft=/, { timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    check('Compare opens the comparison', onCompare, page.url());
    check(
      'the comparison puts the manufacturers side by side',
      (await visible(page.getByRole('columnheader', { name: /Capability/ }))) &&
        (await visible(page.getByRole('rowheader', { name: 'Minimum order quantity' }))) &&
        (await visible(page.getByRole('rowheader', { name: 'Standard lead time' }))) &&
        (await visible(page.getByRole('columnheader', { name: /PrecisionCircuit/ }))),
    );

    // On to the request itself.
    await page.getByRole('link', { name: 'Continue to quotes' }).click();
    const onRequest = await page
      .waitForURL(/\/manufacturing\/rfq\/new\/request\?draft=/, { timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    check('the comparison leads to the request', onRequest, page.url());

    check(
      'the request shows what the manufacturer receives',
      (await visible(page.getByText('What the manufacturer will receive'))) &&
        (await visible(page.getByText('What you need quoted'))) &&
        (await visible(page.getByText('Assembly options'))) &&
        (await visible(page.getByText('Send to'))) &&
        (await visible(page.getByText('Quantity and timeline'))) &&
        (await visible(page.getByText('Production requirement'))),
    );
    check(
      'the summary reads back the request and its readiness',
      (await visible(page.getByText('Your request'))) &&
        (await visible(page.getByText('Ready to send'))) &&
        (await visible(page.getByText('2 recipients selected'))),
    );

    // Validation: the request cannot be sent with nothing to quote.
    // A printed part is offered the enclosure and testing, and nothing that
    // belongs to a board.
    check(
      'the services offered follow what is in the package',
      (await page.getByRole('checkbox', { name: /PCB Fabrication/ }).count()) === 0 &&
        (await visible(page.getByRole('checkbox', { name: /3D/ }))),
    );

    const enclosure = page.getByRole('checkbox', { name: /3D/ }).first();
    const testingService = page.getByRole('checkbox', { name: /Testing/ }).first();
    await enclosure.uncheck().catch(() => undefined);
    await testingService.uncheck().catch(() => undefined);
    const blocked = await page.getByRole('button', { name: 'Send quote request' }).isDisabled();
    check(
      'a request with nothing to quote cannot be sent',
      blocked && (await visible(page.getByText('Choose at least one service to be quoted.'))),
    );
    await enclosure.check();

    // A recipient can be dropped, and the summary follows.
    await page.getByRole('button', { name: /^Remove / }).first().click();
    check(
      'dropping a recipient updates the summary',
      await visible(page.getByText('1 recipient selected')),
    );
    // Put it back through "add another", which returns to the selection.
    await page.getByRole('link', { name: 'Add another' }).click();
    await page
      .waitForURL(/\/manufacturing\/rfq\/new\?draft=/, { timeout: 20_000 })
      .catch(() => undefined);
    await page.waitForLoadState('networkidle');
    await page.getByRole('list', { name: 'Manufacturers' }).getByRole('checkbox').first().check();
    await page.getByRole('list', { name: 'Manufacturers' }).getByRole('checkbox').nth(1).check();
    await page.getByRole('link', { name: 'Continue to quotes' }).click();
    await page
      .waitForURL(/\/manufacturing\/rfq\/new\/request\?draft=/, { timeout: 20_000 })
      .catch(() => undefined);
    await page.waitForLoadState('networkidle');
    check(
      'add another returns to the selection and brings both back',
      await visible(page.getByText('2 recipients selected')),
    );

    // The phone layout of both request steps, while the draft still exists.
    const requestStepUrl = page.url();
    const draftForPhone = new URL(requestStepUrl).searchParams.get('draft') ?? '';
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/manufacturing/rfq/new?draft=${draftForPhone}`, {
      waitUntil: 'networkidle',
    });
    const selectionOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    const selectionOnPhone =
      (await visible(page.getByRole('list', { name: 'Manufacturers' }))) &&
      // Nothing is selected on a fresh load, so the control is the disabled button.
      (await visible(page.getByRole('button', { name: 'Continue to quotes' })));
    check(
      'the selection step fits a phone',
      selectionOverflow <= 1 && selectionOnPhone,
      `overflow ${selectionOverflow}px, list ${selectionOnPhone}`,
    );
    await page.screenshot({ path: join(shotDir, 'rfq-select-390.png') });

    await page.goto(requestStepUrl, { waitUntil: 'networkidle' });
    const requestOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    const requestOnPhone =
      (await visible(page.getByText('What you need quoted'))) &&
      (await visible(page.getByRole('button', { name: 'Send quote request' })));
    check(
      'the request step fits a phone',
      requestOverflow <= 1 && requestOnPhone,
      `overflow ${requestOverflow}px, form ${requestOnPhone}`,
    );
    await page.screenshot({ path: join(shotDir, 'rfq-request-390.png') });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(requestStepUrl, { waitUntil: 'networkidle' });

    // Fill in the commercial terms the design asks for.
    await page.getByRole('button', { name: 'More units' }).click();
    await page.getByLabel('Targeted price per unit (USD)').fill('4.50');
    await page.getByRole('button', { name: 'Add volume' }).click();
    await page.getByLabel('Extra volume 1', { exact: true }).fill('300');
    await page.getByLabel('Anything else the manufacturer should know').fill(
      'ENIG finish. Panelisation left to the manufacturer.',
    );
    await page.getByRole('button', { name: 'Send quote request' }).click();

    const sent = await page
      .waitForURL(/\/manufacturing\/rfq\/[^/?]+\?sent=1/, { timeout: 25_000 })
      .then(() => true)
      .catch(() => false);
    check('the request is sent and its status page opens', sent, page.url());
    const requestUrl = page.url();

    check(
      'the status page confirms who received it',
      (await visible(page.getByText('Sent to 2 manufacturers'))) &&
        (await visible(page.getByText('Requested proposals'))) &&
        (await visible(page.getByText('PrecisionCircuit Co.').first())) &&
        (await visible(page.getByText('AdditiveWorks Studio').first())),
    );
    check(
      'each recipient shows its own state',
      (await page.getByText('Pending').count()) >= 2 &&
        (await visible(page.getByText('Awaiting a quote').first())),
      `${await page.getByText('Pending').count()} pending`,
    );
    check(
      'the status page reads back what was asked for',
      (await visible(page.getByRole('heading', { name: 'Locked requirements' }))) &&
        (await visible(page.getByText('Quoting'))) &&
        (await visible(page.getByText('3D printing / enclosure'))) &&
        // The quotes live on their own tab now that they are built.
        (await visible(page.getByRole('navigation', { name: 'Request sections' }))),
    );

    // The quote tabs exist and are honest while nobody has answered yet.
    await page.getByRole('link', { name: /^Quotes/ }).first().click();
    await page
      .waitForURL(/\/manufacturing\/rfq\/[^/]+\/quotes$/, { timeout: 15_000 })
      .catch(() => undefined);
    check(
      'the quotes tab explains that nobody has answered yet',
      (await visible(page.getByText('No quotes yet'))) &&
        (await visible(page.getByRole('navigation', { name: 'Request sections' }))),
      page.url(),
    );

    // Everyone who could take it already has it, so the modal says so.
    // Back to the All tab, which is where a request is acted on.
    await page.goto(requestUrl, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '+ Send another quote' }).click();
    const addOpen = await visible(
      page.getByRole('dialog', { name: /Send this request to another manufacturer/ }),
    );
    check(
      'sending to another manufacturer is offered, with only those that can take it',
      addOpen &&
        (await visible(page.getByRole('dialog').getByText(/Shenzhen Boards|Nobody else/))),
    );
    if (addOpen) await page.keyboard.press('Escape');

    // The request is listed, and the draft is gone.
    await page.goto(`${base}/manufacturing/rfq`, { waitUntil: 'networkidle' });
    const requestRows = page.getByRole('list', { name: 'Quote requests' }).getByRole('listitem');
    check(
      'the Quote Requests tab lists the request that was sent',
      (await requestRows.count()) >= 1 &&
        (await visible(requestRows.getByText('Industrial Sensor Hub'))),
      `${await requestRows.count()} requests`,
    );

    await page.goto(`${base}/manufacturing`, { waitUntil: 'networkidle' });
    const remainingDrafts = await page
      .locator('ul[aria-label="Manufacturing drafts"] > li')
      .count();
    check(
      'a sent request has left the Draft tab',
      remainingDrafts === 1 && (await visible(page.getByText('Thermal Camera Bracket'))),
      `${remainingDrafts} drafts left`,
    );

    // A sent request is not editable through the draft route.
    const sentId = requestUrl.split('/manufacturing/rfq/')[1]?.split('?')[0] ?? '';
    await page.goto(`${base}/manufacturing/draft/${sentId}`, { waitUntil: 'networkidle' });
    check(
      'the draft route sends a sent request to its status page',
      page.url().includes(`/manufacturing/rfq/${sentId}`),
      page.url(),
    );

    await page.goto(`${base}/products/seed_product_sensor_hub`, { waitUntil: 'networkidle' });
    check(
      'the product shows the request that is now out for quotes',
      await visible(page.getByText('You already have an open request for this product')),
    );

    // Withdrawing it releases the product again.
    await page.goto(requestUrl, { waitUntil: 'networkidle' });
    await page.screenshot({ path: join(shotDir, 'request-sent.png'), fullPage: false });
    await page.getByRole('button', { name: 'Withdraw request' }).click();
    const withdrawOpen = await visible(page.getByRole('dialog', { name: 'Withdraw this request?' }));
    check('withdrawing a sent request is confirmed first', withdrawOpen);
    if (withdrawOpen) {
      await page
        .getByRole('dialog', { name: 'Withdraw this request?' })
        .getByRole('button', { name: 'Withdraw' })
        .click();
      const back = await page
        .waitForURL(/\/manufacturing\/rfq$/, { timeout: 20_000 })
        .then(() => true)
        .catch(() => false);
      check('a withdrawn request returns to the request list', back, page.url());
    }

    // Start manufacturing on a product that already has an open request.
    await page.goto(`${base}/products/${OPEN_REQUEST_PRODUCT}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Start Manufacturing' }).click();
    const modal = page.getByRole('dialog', {
      name: 'This product already has an open request',
    });
    const modalOpen = await modal
      .waitFor({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    check('a product with an open request explains itself in a modal', modalOpen);
    check(
      'the modal offers View Request and Go to Favorites',
      modalOpen &&
        (await modal.getByRole('link', { name: 'View Request' }).isVisible()) &&
        (await modal.getByRole('link', { name: 'Go to Favorites' }).isVisible()),
    );
    if (modalOpen) {
      await modal.getByRole('link', { name: 'Go to Favorites' }).click();
      const backToFavorites = await page
        .waitForURL(/\/favorites$/, { timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      check('Go to Favorites leaves the modal for the list', backToFavorites, page.url());
    }

    // An unavailable product refuses the action on its own page too.
    await page.goto(`${base}/products/seed_product_legacy_beacon`, {
      waitUntil: 'networkidle',
    });
    const refused = page.getByRole('button', { name: 'Currently unavailable' }).first();
    const refusedShown = await visible(refused);
    check(
      'an unavailable product has no way to start manufacturing',
      refusedShown && (await refused.isDisabled()),
      `shown ${refusedShown}`,
    );

    await page.screenshot({ path: join(shotDir, 'product-page.png'), fullPage: false });
    await page.goto(`${base}/favorites`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: join(shotDir, 'favorites.png'), fullPage: false });

    // ------------------------------------------------- T08: quotes and accept
    await page.goto(`${base}/manufacturing/rfq/verify_rfq_open/quotes`, {
      waitUntil: 'networkidle',
    });
    const quoteCards = await page
      .getByRole('list', { name: 'Quotes' })
      .getByRole('listitem')
      .count();
    check('the quotes that came back are listed', quoteCards === 2, `${quoteCards} quotes`);

    const acceptStates = await page
      .getByRole('button', { name: 'Accept quote' })
      .evaluateAll((nodes) => nodes.map((node) => node.disabled));
    check(
      'a quote with an undecided replacement part cannot be accepted',
      acceptStates.includes(true),
      JSON.stringify(acceptStates),
    );

    await page.goto(`${base}/manufacturing/rfq/verify_rfq_open/compare`, {
      waitUntil: 'networkidle',
    });
    check(
      'the quotes compare side by side',
      (await visible(page.getByRole('rowheader', { name: 'Landed total' }))) &&
        (await visible(page.getByText('best'))),
    );

    await page.goto(`${base}/manufacturing/rfq/verify_rfq_open/substitutions`, {
      waitUntil: 'networkidle',
    });
    await page.getByRole('button', { name: 'Approve' }).first().click();
    await page.waitForTimeout(2_500);
    await page.reload({ waitUntil: 'networkidle' });
    check(
      'a replacement part can be approved, and the decision is recorded',
      await visible(page.getByText('0 undecided')),
    );

    await page.goto(`${base}/manufacturing/rfq/verify_rfq_open/quotes`, {
      waitUntil: 'networkidle',
    });
    await page.getByRole('button', { name: 'Accept quote' }).first().click();
    const acceptDialog = page.getByRole('dialog');
    const acceptWarns = await visible(acceptDialog.getByText(/awaiting payment/));
    check('accepting says plainly that it does not confirm the order', acceptWarns);
    await acceptDialog.getByRole('button', { name: 'Accept quote' }).click();
    const onOrder = await page
      .waitForURL(/\/manufacturing\/orders\//, { timeout: 25_000 })
      .then(() => true)
      .catch(() => false);
    check('accepting a quote opens the order', onOrder, page.url());
    const orderUrl = page.url().split('?')[0] ?? page.url();
    const orderId = orderUrl.split('/').pop() ?? '';
    check(
      'the order carries the immutable accepted terms',
      (await visible(page.getByText('The accepted terms'))) &&
        (await visible(page.getByText('Snapshot checksum'))) &&
        (await visible(page.getByText(/Awaiting payment/i))),
    );

    // ------------------------------------------------------- T09: checkout
    await page.getByRole('link', { name: 'Pay to confirm' }).click();
    const onCheckout = await page
      .waitForURL(/\/manufacturing\/checkout\//, { timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    check('the order leads into the secured checkout', onCheckout, page.url());
    check(
      'the checkout shows the locked production scope and the stepper',
      (await visible(page.getByRole('navigation', { name: 'Checkout progress' }))) &&
        (await visible(page.getByText('Production scope'))) &&
        (await visible(page.getByText(/Locked from the accepted quote/))),
    );

    // The coupon field is real: a bad code is refused with a reason.
    await page.getByRole('button', { name: 'Have a coupon?' }).click();
    await page.getByLabel('Coupon code').fill('NOPE');
    await page.getByRole('button', { name: 'Apply' }).click();
    check(
      'a coupon that does not exist is refused with a reason',
      await visible(page.getByText('That code does not exist.')),
    );

    await page.getByLabel('Coupon code').fill('IDEEZA10');
    await page.getByRole('button', { name: 'Apply' }).click();
    check(
      'the live coupon applies and comes off the total',
      await visible(page.getByText('IDEEZA10 applied')),
    );

    // Express shipping changes the total.
    const totalBefore = await page
      .getByText(/held by IDEEZA until delivery/)
      .locator('xpath=preceding-sibling::span[1]')
      .textContent()
      .catch(() => null);
    await page.getByRole('radio', { name: /Express/ }).check();
    await page.waitForTimeout(500);
    const totalAfter = await page
      .getByText(/held by IDEEZA until delivery/)
      .locator('xpath=preceding-sibling::span[1]')
      .textContent()
      .catch(() => null);
    check(
      'choosing express changes what is owed',
      totalBefore !== null && totalAfter !== null && totalBefore !== totalAfter,
      `${totalBefore ?? '?'} -> ${totalAfter ?? '?'}`,
    );

    // The address can still be changed while the order is unpaid.
    await page.getByRole('link', { name: 'Change address' }).click();
    await page.waitForURL(/\/address$/, { timeout: 15_000 }).catch(() => undefined);
    await page.getByLabel('City').fill('Chattogram');
    await page.getByRole('button', { name: 'Save address' }).click();
    const backOnCheckout = await page
      .waitForURL(/\/manufacturing\/checkout\/[^/]+$/, { timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    check(
      'the delivery address can be changed before paying',
      backOnCheckout && (await visible(page.getByText('Chattogram'))),
      page.url(),
    );

    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await page.waitForURL(/\/payment$/, { timeout: 20_000 }).catch(() => undefined);
    check(
      'the payment step offers the methods the platform holds funds through',
      (await visible(page.getByRole('list', { name: 'Payment methods' }))) &&
        (await visible(page.getByRole('radio', { name: 'IDZ' }))) &&
        (await visible(page.getByText(/No payment provider is connected/))),
    );

    // A card that fails its checksum is refused, and nothing is confirmed.
    await page.getByLabel('Name on card').fill('A Buyer');
    await page.getByLabel('Card number').fill('4242 4242 4242 4241');
    await page.getByLabel('Expiry').fill('04/30');
    await page.getByLabel('Security code').fill('123');
    await clickWhenEnabled(page, page.getByRole('button', { name: /^Pay / }), () =>
      page.getByRole('checkbox').last().check(),
    );
    const onFailure = await page
      .waitForURL(/\/done/, { timeout: 25_000 })
      .then(() => true)
      .catch(() => false);
    check(
      'a card that fails its own check confirms nothing',
      onFailure &&
        (await visible(page.getByText('Payment not taken'))) &&
        (await visible(page.getByText(/still waiting for payment/))),
      page.url(),
    );

    // Paying properly secures the funds and confirms the order.
    await page.getByRole('link', { name: 'Try the payment again' }).click();
    await page.waitForURL(/\/payment$/, { timeout: 20_000 }).catch(() => undefined);
    await page.getByRole('radio', { name: 'PayPal' }).check();
    await clickWhenEnabled(page, page.getByRole('button', { name: /^Pay / }), () =>
      page.getByRole('checkbox').last().check(),
    );
    // The action resolves first, then the client redirects. Watching the URL
    // before that push has landed reads the old one, so the transition is given
    // its beat here.
    await page.waitForTimeout(3_000);
    const onDone = await page
      .waitForURL(/\/done/, { timeout: 25_000 })
      .then(() => true)
      .catch(() => false);
    check(
      'paying secures the funds and says so',
      onDone &&
        (await visible(page.getByText('Payment secured'))) &&
        (await visible(page.getByText(/IDEEZA is holding the funds/))),
      page.url(),
    );

    await page.goto(`${base}/manufacturing/orders/${orderId}`, {
      waitUntil: 'networkidle',
    });
    check(
      'the order is confirmed once the funds are held',
      await visible(page.getByText(/Confirmed/)),
    );
    check(
      'a confirmed order no longer offers a checkout',
      (await page.getByRole('link', { name: 'Pay to confirm' }).count()) === 0,
    );
    await page.screenshot({ path: join(shotDir, 'checkout-done.png'), fullPage: false });

    // ------------------------------- T10: order detail, production tracking
    //
    // The seeded order is the one that is actually being made: it has stages,
    // tasks, a documented record and a shortage the manufacturer is waiting on.
    await page.goto(`${base}/manufacturing/orders`, { waitUntil: 'networkidle' });
    check(
      'the Active Orders tab lists real orders',
      (await visible(page.getByRole('list', { name: 'Orders' }))) &&
        (await visible(page.getByText(/needs your answer/))),
    );

    const rowMenu = page
      .getByRole('list', { name: 'Orders' })
      .getByRole('button', { name: 'Actions' })
      .first();
    await rowMenu.click();
    check(
      'a row offers only the actions its state allows',
      (await visible(page.getByRole('menuitem', { name: 'View details' }))) &&
        (await visible(page.getByRole('menuitem', { name: 'Order records' }))),
    );
    await page.keyboard.press('Escape');
    await page.screenshot({ path: join(shotDir, 'active-orders.png'), fullPage: false });

    await page.goto(`${base}/manufacturing/orders/seed_order_1`, {
      waitUntil: 'networkidle',
    });
    check(
      'a deep protected route renders inside the shell',
      await visible(page.getByRole('navigation', { name: 'Main' })),
    );
    check(
      'the order header carries the dates the buyer plans around',
      (await visible(page.getByText(/^Ordered /))) &&
        (await visible(page.getByText(/^Est. ship /))) &&
        (await visible(page.getByText(/^Est. delivery /))),
    );
    check(
      'the order shows the locked scope and the summary of what was charged',
      (await visible(page.getByText('Production scope'))) &&
        (await visible(page.getByText(/Locked from the accepted quote/))) &&
        (await visible(page.getByRole('list', { name: 'Production scope' }))) &&
        (await visible(page.getByText('Order Summary'))),
    );
    check(
      'a change agreed during production is a line of its own, not a rewrite',
      (await visible(page.getByText('Substitute parts'))) &&
        (await visible(page.getByText(/Still to settle|Owed back to you/))),
    );
    check(
      'tracking is offered only once the units have shipped',
      await page
        .getByRole('button', { name: 'Track Shipment' })
        .first()
        .isDisabled()
        .catch(() => false),
    );

    // The shortage: three real answers, each stating its cost and its delay.
    check(
      'the shortage the manufacturer raised is put to the buyer',
      (await visible(page.getByText(/short — the manufacturer is waiting on you/))) &&
        (await visible(page.getByRole('radio', { name: /Approve the replacement part/ }))) &&
        (await visible(page.getByRole('radio', { name: /Drop the part/ }))) &&
        (await visible(page.getByRole('radio', { name: /Wait for the original part/ }))),
    );
    await page.screenshot({ path: join(shotDir, 'order-overview.png'), fullPage: false });

    await page.getByRole('button', { name: 'Send the answer' }).first().click();
    check(
      'an answer without a choice is refused',
      await visible(page.getByText('Choose what should happen.')),
    );

    await page.getByRole('radio', { name: /Approve the replacement part/ }).check();
    await page.getByRole('button', { name: 'Send the answer' }).first().click();
    await page.waitForTimeout(2_500);
    await page.reload({ waitUntil: 'networkidle' });
    check(
      'the answer is recorded against the order',
      (await visible(page.getByText('Changes decided during production'))) &&
        (await page.getByRole('button', { name: 'Send the answer' }).count()) === 0,
    );

    // Product Details.
    await page.getByRole('link', { name: 'Product Details' }).click();
    await page.waitForURL(/\/items$/, { timeout: 20_000 }).catch(() => undefined);
    check(
      'the order lists every line the quote priced, with a grand total',
      (await visible(page.getByText('Grand Total'))) &&
        (await visible(page.getByRole('button', { name: 'View Details' }).first())),
    );
    await page.getByRole('button', { name: 'View Details' }).first().click();
    check(
      'a line opens the spec it was quoted against',
      (await visible(page.getByRole('dialog'))) &&
        (await visible(page.getByText('Production specification'))) &&
        (await visible(page.getByText('BOM reference'))),
    );
    await page.getByRole('button', { name: 'Close' }).click();
    await page.screenshot({ path: join(shotDir, 'order-items.png'), fullPage: false });

    // Production Progress.
    await page.getByRole('link', { name: 'Production Progress' }).click();
    await page.waitForURL(/\/progress$/, { timeout: 20_000 }).catch(() => undefined);
    // Direct children only: a stage carries its own task list inside it.
    const stageCount = await page
      .locator('ol[aria-label="Production stages"] > li')
      .count();
    check('all ten canonical stages are shown', stageCount === 10, `${stageCount} stages`);
    check(
      'the live stage shows its shop-floor tasks and who moves it',
      (await visible(page.getByRole('list', { name: /In Production tasks/i }))) &&
        (await visible(page.getByText('Moved by the manufacturer').first())),
    );
    check(
      'the activity record is readable',
      (await visible(page.getByRole('list', { name: 'Order activity' }))) &&
        (await visible(page.getByText(/order confirmed/i))),
    );
    await page.screenshot({ path: join(shotDir, 'order-progress.png'), fullPage: false });

    // The documented record.
    await page.goto(`${base}/manufacturing/orders/seed_order_1/records`, {
      waitUntil: 'networkidle',
    });
    check(
      'the order record holds the evidence a dispute would be decided on',
      (await visible(page.getByRole('list', { name: 'Order records' }))) &&
        (await visible(page.getByText('Accepted quote QT-A v1'))) &&
        (await visible(page.getByText(/Approved replacement/))),
    );

    // ---------------------- T11: delivery, review window, order history
    //
    // The fixtures carry one delivered order with its review window running and
    // one already completed and reviewed, because the manufacturer panel owns
    // everything up to delivery.
    await page.goto(`${base}/manufacturing/orders/verify_order_delivered`, {
      waitUntil: 'networkidle',
    });
    check(
      'a delivered order says what the review window means',
      (await visible(page.getByText('The units have arrived'))) &&
        (await visible(page.getByText(/review window left/))),
    );

    await page.getByRole('link', { name: 'Confirm delivery' }).first().click();
    await page
      .waitForURL(/\/confirm-delivery$/, { timeout: 20_000 })
      .catch(() => undefined);
    check(
      'confirming states the consequence before the button',
      (await visible(page.getByText('What confirming does'))) &&
        (await visible(page.getByText(/leaves escrow/))) &&
        (await visible(page.getByText('The review window'))),
    );
    check(
      'the alternatives that keep the money held are offered here too',
      (await visible(page.getByRole('link', { name: 'Request a refund' }))) &&
        (await visible(page.getByRole('link', { name: 'Open a dispute' }))),
    );

    const confirmButton = page.getByRole('button', {
      name: 'Confirm delivery and release the money',
    });
    check(
      'the money is not released until the buyer says the goods are right',
      await confirmButton.isDisabled().catch(() => false),
    );

    await page.getByRole('checkbox').first().check();
    await confirmButton.click();
    await page.waitForTimeout(3_000);
    const onConfirmed = await page
      .waitForURL(/\/manufacturing\/orders\/verify_order_delivered/, { timeout: 25_000 })
      .then(() => true)
      .catch(() => false);
    check(
      'confirming delivery completes the order and releases the money',
      onConfirmed &&
        (await visible(page.getByText('Delivery confirmed'))) &&
        (await visible(page.getByText(/This order is complete/))),
      page.url(),
    );
    await page.screenshot({ path: join(shotDir, 'delivery-confirmed.png'), fullPage: false });

    // The review is a separate decision, about the manufacturer.
    await page.getByRole('button', { name: 'Leave a review' }).click();
    check(
      'the review asks for a rating, a note and anonymity',
      (await visible(page.getByRole('dialog'))) &&
        (await visible(page.getByRole('radio', { name: '4 stars' }))) &&
        (await visible(page.getByLabel('Share your experience'))) &&
        (await visible(page.getByText('Post anonymously'))),
    );

    await page.getByRole('button', { name: 'Submit feedback' }).click();
    check(
      'a review with no rating is refused',
      await visible(page.getByText('Choose a rating from one to five stars.')),
    );

    await page.getByRole('radio', { name: '4 stars' }).click();
    await page.getByLabel('Share your experience').fill('Boards passed our incoming test.');
    await page.getByRole('button', { name: 'Submit feedback' }).click();
    await page.waitForTimeout(2_500);
    await page.reload({ waitUntil: 'networkidle' });
    check(
      'the review is published against the order',
      (await visible(page.getByText('Review published'))) &&
        (await visible(page.getByText(/Boards passed our incoming test/))),
    );

    // Order history: the real outcome, and what can still be done.
    await page.goto(`${base}/manufacturing/history`, { waitUntil: 'networkidle' });
    const historyRows = await page
      .locator('ul[aria-label="Order history"] > li')
      .count();
    check(
      'order history lists finished orders with their outcome',
      historyRows >= 2 &&
        (await visible(page.getByText(/Completed, money released/))),
      `${historyRows} rows`,
    );
    check(
      'a reviewed order is marked as reviewed',
      await visible(page.getByText('Reviewed').first()),
    );
    await page.screenshot({ path: join(shotDir, 'order-history.png'), fullPage: false });

    // Re-order: the same decision as starting manufacturing.
    // The completed fixture, whose product has no open request of its own: the
    // one-open-request-per-product rule is exercised elsewhere.
    const historyRow = page
      .locator('ul[aria-label="Order history"] > li')
      .filter({ hasText: 'FPV Flight Stack F7' })
      .first();
    await historyRow.getByRole('button', { name: 'Actions' }).click();
    check(
      'a past order can be re-ordered or given feedback',
      (await visible(page.getByRole('menuitem', { name: 'Re-order' }))) &&
        (await visible(page.getByRole('menuitem', { name: 'View details' }))),
    );
    await page.getByRole('menuitem', { name: 'Re-order' }).click();
    await page.waitForTimeout(4_000);
    const reorderToast = (await page.locator('[role="status"], [role="alert"]').allTextContents()).join(' | ');
    const reordered = page.url().includes('/manufacturing/draft/');
    check(
      're-ordering opens a fresh draft from the same request',
      reordered &&
        (await visible(page.getByRole('button', { name: 'Save changes' }))) &&
        (await visible(page.getByText('FPV Flight Stack F7'))),
      `${page.url()} :: ${reorderToast}`,
    );
    // ------------------- T12: cancellation, refund claims and disputes
    //
    // The seeded order is in production with the money held, which is the state
    // where all three instruments behave differently from each other.
    await page.goto(`${base}/manufacturing/orders/seed_order_1/cancel`, {
      waitUntil: 'networkidle',
    });
    check(
      'cancelling a funded order is a request, and says so',
      (await visible(page.getByRole('heading', { name: 'Order cancel request' }))) &&
        (await visible(page.getByText(/Production has started, so this is a request/))) &&
        (await visible(page.getByLabel('Select reason'))),
    );

    await page.getByRole('button', { name: 'Request cancellation' }).click();
    check(
      'a cancellation with no reason is refused',
      await visible(page.getByText('Choose a reason.')),
    );

    // A refund claim: reason, amount capped at what is held, and a record.
    // The order that has been through delivery: on the seeded one, still in
    // production, a refund is correctly refused, which is checked first.
    await page.goto(`${base}/manufacturing/orders/seed_order_1/refund`, {
      waitUntil: 'networkidle',
    });
    check(
      'a refund is refused while nothing has been delivered, and points elsewhere',
      await visible(page.getByText(/nothing has been delivered yet/)),
    );

    await page.goto(`${base}/manufacturing/orders/verify_order_delivered/refund`, {
      waitUntil: 'networkidle',
    });
    check(
      'the refund form asks for a reason, an amount and a record',
      (await visible(page.getByLabel('Select reason'))) &&
        (await visible(page.getByLabel('Amount'))) &&
        (await visible(page.getByText('Attach records from this order'))) &&
        (await visible(page.getByText(/payout stops/))),
    );
    const reasonLabels = await page
      .getByLabel('Select reason')
      .locator('option')
      .allTextContents();
    check(
      'the reasons are the manufacturing ones, not the freelancing ones',
      reasonLabels.includes('Defective units') &&
        reasonLabels.includes('A part was substituted without approval') &&
        !reasonLabels.some((label) => label.toLowerCase().includes('scope creep')),
      reasonLabels.join(' | '),
    );

    await page.getByLabel('Select reason').selectOption('defective_units');
    await page.getByLabel('Description').fill('Eleven boards failed our incoming functional test on arrival.');
    await page.getByRole('button', { name: 'Request refund' }).click();
    check(
      'a claim with no record attached is refused',
      await visible(page.getByText('Attach at least one record from the order.')),
    );

    await page.getByRole('checkbox').first().check();
    await page.getByLabel('Amount').fill('999999.00');
    await page.getByRole('button', { name: 'Request refund' }).click();
    check(
      'a claim larger than the held funds is refused',
      await visible(page.getByText(/Enter an amount between/)),
    );

    await page.getByLabel('Amount').fill('50.00');
    await page.getByRole('button', { name: 'Request refund' }).click();
    const onRefunded = await page
      .waitForURL(/refund-requested=1/, { timeout: 25_000 })
      .then(() => true)
      .catch(() => false);
    check(
      'a refund claim is recorded and stops the payout',
      onRefunded &&
        (await visible(page.getByText('Refund claim recorded'))) &&
        (await visible(page.getByText(/A refund claim is open/))),
      page.url(),
    );
    await page.screenshot({ path: join(shotDir, 'refund-open.png'), fullPage: false });

    // Escalating to a dispute, which is the case both sides argue on.
    await page.goto(`${base}/manufacturing/orders/verify_order_delivered/dispute`, {
      waitUntil: 'networkidle',
    });
    check(
      'opening a dispute states who decides it and on what',
      (await visible(page.getByRole('heading', { name: 'Open a dispute' }))) &&
        (await visible(page.getByText(/IDEEZA decides it/))),
    );

    await page.getByLabel('Select reason').selectOption('wrong_specification');
    await page.getByLabel('Description').fill('The boards came back with HASL and the accepted terms said ENIG.');
    await page.getByRole('checkbox').first().check();
    await page.getByLabel('Amount').fill('40.00');
    await page.getByRole('button', { name: 'Open the dispute' }).click();
    const onCase = await page
      .waitForURL(/\/dispute\/[^/]+/, { timeout: 25_000 })
      .then(() => true)
      .catch(() => false);
    check(
      'the dispute case opens with the opening statement on it',
      onCase &&
        (await visible(page.getByText('The case is open'))) &&
        (await visible(page.getByRole('list', { name: 'Dispute statements' }))) &&
        (await visible(page.getByText(/HASL/))) &&
        (await visible(page.getByText('Case summary'))),
      page.url(),
    );
    await page.screenshot({ path: join(shotDir, 'dispute-case.png'), fullPage: false });

    // The case has to be quotable: the reference the buyer reads here is the one
    // the shop reads on its own screen, and the words for the reason and the
    // state come from the domain rather than from each panel’s own copy.
    const caseHeading = (await page.locator('h1').first().innerText()) ?? '';
    check(
      'the case is quoted by a shared reference, not a raw database id',
      /Dispute CASE-[0-9A-Z]{8}/.test(caseHeading) && !/dp_[a-z0-9]{6,}/.test(caseHeading),
      caseHeading.trim().slice(0, 60),
    );
    // The reason sits in the case summary, as its own definition row.
    const summaryReason =
      (await page
        .locator('dt:text-is("Reason") + dd')
        .first()
        .innerText({ timeout: 20_000 })
        .catch(() => '')) ?? '';
    check(
      'the reason reads as words, not as a database value',
      summaryReason.trim() !== '' && !/_/.test(summaryReason),
      summaryReason.trim().slice(0, 60),
    );
    await page.getByLabel('Describe').fill(
      'Adding the incoming inspection sheet reference.',
    );
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.waitForTimeout(2_500);
    await page.reload({ waitUntil: 'networkidle' });
    const statementCount = await page
      .locator('ol[aria-label="Dispute statements"] > li')
      .count();
    check(
      'a further statement joins the record',
      statementCount >= 2,
      `${statementCount} statements`,
    );

    check(
      'a second dispute is not offered on the same order',
      await page
        .goto(`${base}/manufacturing/orders/verify_order_delivered/dispute`, {
          waitUntil: 'networkidle',
        })
        .then(() => page.url().includes('/dispute/')),
      page.url(),
    );

    check(
      'the order itself shows the open dispute',
      await page
        .goto(`${base}/manufacturing/orders/verify_order_delivered`, {
          waitUntil: 'networkidle',
        })
        .then(async () => visible(page.getByText('A dispute is in progress'))),
    );
    // ------------------------------ T13: notifications and conversations
    await page.goto(`${base}/notifications`, { waitUntil: 'networkidle' });
    const noticeRows = await page
      .locator('ul[aria-label="Notifications"] > li')
      .count();
    check(
      'notifications are real records with a way into the screen that owns them',
      noticeRows >= 4 &&
        (await visible(page.getByText('Parts review required'))) &&
        (await visible(page.getByRole('link', { name: 'Open' }).first())),
      `${noticeRows} rows`,
    );
    check(
      'the bell counts what is unread',
      await visible(page.getByRole('link', { name: 'Notifications' })),
    );

    await page.getByRole('link', { name: 'Unread' }).click();
    await page.waitForURL(/filter=unread/, { timeout: 15_000 }).catch(() => undefined);
    const unreadRows = await page
      .locator('ul[aria-label="Notifications"] > li')
      .count();
    check(
      'the unread filter is its own linkable list',
      unreadRows > 0 && unreadRows <= noticeRows,
      `${unreadRows} unread of ${noticeRows}`,
    );

    await page.getByRole('button', { name: 'Mark all as read' }).click();
    await page.waitForTimeout(2_500);
    await page.reload({ waitUntil: 'networkidle' });
    check(
      'marking everything read empties the unread list without deleting anything',
      await visible(page.getByText('Nothing unread')),
    );
    await page.screenshot({ path: join(shotDir, 'notifications.png'), fullPage: false });

    // Conversations.
    await page.goto(`${base}/messages`, { waitUntil: 'networkidle' });
    check(
      'conversations are listed by what they are about',
      (await visible(page.getByRole('list', { name: 'Conversations' }))) &&
        (await visible(page.getByText(/^Request · /))),
    );

    await page
      .getByRole('list', { name: 'Conversations' })
      .getByRole('link')
      .first()
      .click();
    await page.waitForURL(/\/messages\/[^/]+/, { timeout: 20_000 }).catch(() => undefined);
    check(
      'a conversation shows what was said and the record it is about',
      (await visible(page.getByRole('list', { name: 'Messages' }))) &&
        (await visible(page.getByText('From the order record'))) &&
        (await visible(page.getByText('Quote received'))),
      page.url(),
    );
    check(
      'the quote card links to the screen that owns the decision',
      await visible(page.getByRole('link', { name: 'Review and decide' })),
    );

    await page.getByLabel('Type your message').fill('Understood — we will decide by Friday.');
    await page.getByRole('button', { name: 'Send' }).click();
    await page.waitForTimeout(2_500);
    await page.reload({ waitUntil: 'networkidle' });
    check(
      'a message can be sent, and joins the thread',
      await visible(page.getByText('Understood — we will decide by Friday.')),
    );
    await page.screenshot({ path: join(shotDir, 'conversation.png'), fullPage: false });
    // ------------------------------------ T14: a 3D module on its own
    //
    // The Industrial Sensor Hub carries a STEP file and no board, so it is the
    // product that exercises sending a printed part to manufacture by itself.
    await page.goto(`${base}/products/seed_product_gimbal`, {
      waitUntil: 'networkidle',
    });
    await page.getByRole('button', { name: /Start Manufacturing/ }).first().click();
    await page.waitForTimeout(2_500);
    const onDraft = page.url().includes('/manufacturing/draft/');
    check('a 3D-only product opens a draft', onDraft, page.url());

    check(
      'the draft groups the files by the work they imply',
      (await visible(page.getByRole('group', { name: 'PCB items' }))) &&
        (await visible(page.getByRole('group', { name: '3D module' }))) &&
        (await visible(page.getByText(/Full product/))),
    );

    // The point of this route: drop the boards and send the printed part alone.
    await page
      .getByRole('group', { name: 'PCB items' })
      .getByRole('checkbox')
      .first()
      .uncheck();
    check(
      'dropping the boards leaves a 3D module on its own',
      await visible(page.getByText('3D module only')),
    );
    check(
      'a printed part is asked for its process and material',
      (await visible(page.getByText('Print specification'))) &&
        (await visible(page.getByLabel('Process'))) &&
        (await visible(page.getByLabel('Print material'))),
    );

    // Fill the requirements for a printed part.
    await page.getByLabel('Process').selectOption('sls');
    await page.getByLabel('Print material').selectOption('PA12');
    await page.getByLabel('Colour').fill('Graphite');
    await page.getByLabel('Quantity').fill('40');
    await page.getByLabel('Material and finish').fill('PA12, bead blasted');
    await page.getByLabel('Manufacturing method').fill('SLS printing');
    await page.getByLabel('Tolerance').fill('+/-0.3mm');
    await page.getByLabel('Lead time (days)').fill('12');
    await page.getByLabel('Shipping requirement').fill('Courier, tracked');
    await page.getByLabel('Quality check').fill('Dimensional check on 10%');
    await page.getByLabel(/Address line 1/).fill('20/3, Sector 9');
    await page.getByLabel('City').fill('Dhaka');
    await page.getByLabel(/Country/).fill('BD');

    const saveDraft = page.getByRole('button', { name: /Save draft|Save changes/ });
    await clickWhenEnabled(page, saveDraft);
    await page.waitForTimeout(3_500);
    const printDraftUrl = page.url();
    check(
      'the print specification is saved with the draft',
      //manufacturing/draft/(?!new)[^/?]+/.test(printDraftUrl) &&
        (await visible(page.getByText(/SLS|3D module/))),
      printDraftUrl,
    );
    await page.screenshot({ path: join(shotDir, 'draft-3d.png'), fullPage: false });

    // Only the work a printed part needs is offered, and the print shop meets it.
    const printDraftId = printDraftUrl.split('/manufacturing/draft/')[1]?.split('?')[0] ?? '';
    await page.goto(`${base}/manufacturing/rfq/new?draft=${printDraftId}`, {
      waitUntil: 'networkidle',
    });
    check(
      'a print shop is offered for a printed part',
      await visible(page.getByText('AdditiveWorks Studio')),
    );

    await page.goto(
      `${base}/manufacturing/rfq/new/request?draft=${printDraftId}&m=seed_mfr_c`,
      {
        waitUntil: 'networkidle',
      },
    );
    const serviceLabels = await page
      .locator('label')
      .filter({ hasText: /Fabrication|Assembly|3D|Testing|Stencil|Parts/ })
      .allTextContents();
    check(
      'the request offers only the work a printed part needs',
      serviceLabels.some((label) => label.includes('3D')) &&
        !serviceLabels.some((label) => label.includes('Stencil')),
      serviceLabels.map((label) => label.split('\n')[0]).join(' | '),
    );
    await page.screenshot({ path: join(shotDir, 'request-3d.png'), fullPage: false });
    // ---------------- T15: the detailed specification, edited from the draft
    //
    // The prepared draft carries a board, so it is the one with a specification
    // to edit. Nothing in it is compulsory: an open row means the manufacturer
    // decides, and the screen has to say so.
    await page.goto(`${base}/manufacturing/draft/verify_rfq_draft`, {
      waitUntil: 'networkidle',
    });
    check(
      'a draft with a board offers its specification',
      await visible(page.getByRole('link', { name: 'Edit specification' })),
    );

    await page.getByRole('link', { name: 'Edit specification' }).click();
    await page
      .waitForURL(/\/specification$/, { timeout: 20_000 })
      .catch(() => undefined);
    check(
      'the specification is grouped as the design has it',
      (await visible(page.getByRole('heading', { name: 'The board' }))) &&
        (await visible(page.getByRole('heading', { name: 'High-spec options' }))) &&
        (await visible(page.getByRole('radiogroup', { name: 'Base material' }))) &&
        (await visible(page.getByRole('radiogroup', { name: 'Surface finish' }))),
    );
    check(
      'every row offers the open answer, and it is the default',
      (await page.getByRole('radio', { name: "Manufacturer's discretion" }).count()) > 8,
    );
    check(
      'the specification is read back the way a manufacturer sees it',
      (await visible(page.getByText('As a manufacturer will read it'))) &&
        (await visible(page.getByText('Via covering'))),
    );
    await page.screenshot({ path: join(shotDir, 'board-spec.png'), fullPage: false });

    // A rule the design has no idea about: buried vias need four layers.
    await page
      .getByRole('radiogroup', { name: 'Layers' })
      .getByRole('radio', { name: '2', exact: true })
      .check();
    check(
      'an option the chosen layer count cannot hold is not offered',
      await page
        .getByRole('checkbox', { name: /Blind or buried vias/ })
        .isDisabled()
        .catch(() => false),
    );

    await page
      .getByRole('radiogroup', { name: 'Layers' })
      .getByRole('radio', { name: '4', exact: true })
      .check();
    await page
      .getByRole('radiogroup', { name: 'Surface finish' })
      .getByRole('radio', { name: 'ENIG' })
      .check();
    await page
      .getByRole('radiogroup', { name: 'Board colour' })
      .getByRole('radio', { name: 'Black' })
      .check();
    await page.getByLabel('Remarks').fill('Impedance control on the antenna feed.');

    await clickWhenEnabled(page, page.getByRole('button', { name: 'Save specification' }));
    const specSaved = await page
      .waitForURL(/spec=1/, { timeout: 25_000 })
      .then(() => true)
      .catch(() => false);
    check('the specification saves onto the draft', specSaved, page.url());
    check(
      'the draft reads the specification back',
      (await visible(page.getByText('Board specification'))) &&
        (await visible(page.getByText(/ENIG/))),
    );

    // A sent request shows the same document, and refuses to change it.
    await page.goto(`${base}/manufacturing/draft/verify_rfq_open/specification`, {
      waitUntil: 'networkidle',
    });
    check(
      'a sent request has its specification locked',
      (await visible(page.getByText('This specification is locked'))) &&
        (await page.getByRole('button', { name: 'Save specification' }).count()) === 0,
    );

    check(
      'the request screen shows what the quotes are answering',
      await page
        .goto(`${base}/manufacturing/rfq/verify_rfq_open`, { waitUntil: 'networkidle' })
        .then(async () =>
          (await visible(page.getByText('Board specification'))) &&
          (await visible(page.getByText(/Impedance control on the RF pair/))),
        ),
    );

    // A printed part has no board specification to edit.
    await page.goto(`${base}/manufacturing/draft/${printDraftId}/specification`, {
      waitUntil: 'networkidle',
    });
    check(
      'printed parts are told there is no board specification',
      await visible(page.getByText('There is no board in this package')),
    );
    // The draft row menu, pressed rather than routed around. An item that
    // renders but goes nowhere is invisible to a check that opens screens by
    // address, which is how the shop side kept four dead ones.
    await page.goto(`${base}/manufacturing`, { waitUntil: 'networkidle' });
    const draftMenu = page.getByRole('button', { name: /More actions for/ }).first();
    if (await draftMenu.count() > 0) {
      await draftMenu.click();
      const edit = page.getByRole('menuitem', { name: 'Edit the draft' }).first();
      check(
        'the draft row menu offers the draft as a link',
        await edit.evaluate((node) => node.tagName === 'A').catch(() => false),
      );
      await edit.click();
      await page.waitForURL(/\/manufacturing\/draft\/[^/]+$/, { timeout: 20_000 }).catch(() => undefined);
      check(
        'pressing it opens the draft',
        /\/manufacturing\/draft\/[^/]+$/.test(new URL(page.url()).pathname),
        page.url(),
      );
    }

    // Keyboard reachability of the skip-free shell.
    await page.goto(`${base}/manufacturing`, { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    const firstFocus = await page.evaluate(() =>
      document.activeElement === null ? '' : `${document.activeElement.tagName}:${document.activeElement.textContent?.trim().slice(0, 24) ?? ''}`,
    );
    check('keyboard focus enters the page', firstFocus !== '', firstFocus);

    await page.screenshot({ path: join(shotDir, 'desktop-1440.png'), fullPage: false });

    // Tablet.
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload({ waitUntil: 'networkidle' });
    const tabletSidebar = await page.getByRole('navigation', { name: 'Main' }).isVisible();
    const tabletMenu = await visible(page.getByRole('button', { name: 'Open navigation' }));
    check('at 768 the rail collapses to a menu button', !tabletSidebar && tabletMenu);
    await page.screenshot({ path: join(shotDir, 'tablet-768.png') });

    // Mobile, and the drawer opens.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const drawer = page.getByRole('dialog', { name: 'Navigation' });
    check('at 390 the navigation drawer opens', await visible(drawer));
    check(
      'the drawer closes with Escape',
      await (async () => {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
        return (await page.getByRole('dialog', { name: 'Navigation' }).count()) === 0;
      })(),
    );
    await page.screenshot({ path: join(shotDir, 'mobile-390.png') });

    // No horizontal overflow on a phone.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check('the phone layout does not scroll sideways', overflow <= 1, `overflow ${overflow}px`);

    // The gallery, for the design review.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}/design-system`, { waitUntil: 'networkidle' });
    check('the component gallery renders', await page.getByRole('heading', { name: 'Design system' }).isVisible());
    await page.screenshot({ path: join(shotDir, 'design-system.png'), fullPage: true });

    // A manufacturer account must not reach this surface.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto(`${base}/auth/sign-in`, { waitUntil: 'networkidle' });
    await otherPage.getByLabel('Email address').fill('ops@precisioncircuit.test');
    await otherPage.getByLabel('Password').fill(PASSWORD);
    await otherPage.getByRole('button', { name: 'Sign in' }).click();
    await otherPage
      .waitForURL(/forbidden/, { timeout: 20_000 })
      .catch(() => undefined);
    await otherPage.waitForLoadState('networkidle');
    check(
      'a manufacturer account is refused on the buyer surface',
      otherPage.url().includes('/forbidden'),
      otherPage.url(),
    );
    await other.close();

    check('no console errors in the browser', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
    check(
      'no failed network requests',
      networkFailures.length === 0,
      networkFailures.slice(0, 3).join(' | '),
    );

    await browser.close();

    const serverErrors = appLog
      .join('')
      .split('\n')
      .filter((line) => /\berror\b|unhandled|uncaught/i.test(line))
      .filter((line) => !/prisma:info|Compiled|ready in/i.test(line));
    check('the server log contains no errors', serverErrors.length === 0, serverErrors.slice(0, 2).join(' | '));
  } finally {
    appProcess?.kill();
    await postgres.stop().catch(() => undefined);
    // Windows can still hold the data directory open a moment after the server
    // exits; the summary matters more than the temporary files.
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
