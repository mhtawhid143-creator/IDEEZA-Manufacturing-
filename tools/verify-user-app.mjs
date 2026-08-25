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
const results = [];
let failures = 0;

const check = (name, passed, detail = '') => {
  results.push({ name, passed, detail });
  if (!passed) failures += 1;
  process.stdout.write(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail === '' ? '' : ` — ${detail}`}\n`);
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

    const heading = await page.getByRole('heading', { level: 1, name: 'Manufacturing' }).isVisible();
    check('the hub heading renders', heading);

    const sidebar = page.getByRole('navigation', { name: 'Main' });
    check('the desktop sidebar is visible at 1440', await sidebar.isVisible());
    check(
      'the sidebar shows Manufacturing and no manufacturer feature',
      (await sidebar.getByRole('link', { name: 'Manufacturing' }).count()) > 0 &&
        (await sidebar.getByText('Inventory', { exact: true }).count()) === 0 &&
        (await sidebar.getByText('Payouts', { exact: true }).count()) === 0,
    );

    // Tabs navigate.
    await page.getByRole('link', { name: /Quote Requests/ }).click();
    const tabNavigated = await page
      .waitForURL(/\/manufacturing\/rfq$/, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    check('a hub tab navigates to its own route', tabNavigated, page.url());
    check(
      'the tab row and the tab panel follow the route',
      (await page.getByRole('navigation', { name: 'Manufacturing sections' }).isVisible()) &&
        (await page.getByText('Quote requests you have sent').isVisible()),
    );

    // Protected deep route.
    await page.goto(`${base}/manufacturing/orders/seed_order_1`, { waitUntil: 'networkidle' });
    check(
      'a deep protected route renders inside the shell',
      (await page.getByRole('navigation', { name: 'Main' }).isVisible()) &&
        (await page.getByText('Not implemented yet').isVisible()),
    );

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
    const tabletMenu = await page.getByRole('button', { name: 'Open navigation' }).isVisible();
    check('at 768 the rail collapses to a menu button', !tabletSidebar && tabletMenu);
    await page.screenshot({ path: join(shotDir, 'tablet-768.png') });

    // Mobile, and the drawer opens.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const drawer = page.getByRole('dialog', { name: 'Navigation' });
    check('at 390 the navigation drawer opens', await drawer.isVisible());
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
    rmSync(dataDir, { recursive: true, force: true });
  }

  process.stdout.write(`\n${results.length - failures}/${results.length} checks passed\n`);
  process.stdout.write(`screenshots in ${shotDir}\n`);
  if (failures > 0) process.exitCode = 1;
};

main().catch((error) => {
  process.stderr.write(`${String(error?.stack ?? error)}\n`);
  process.exitCode = 1;
});
