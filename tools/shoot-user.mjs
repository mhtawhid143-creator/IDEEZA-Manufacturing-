/**
 * Screenshots of the buyer panel, desktop and phone, in one pass.
 *
 * The twin of `shoot-manufacturer.mjs`: same boot as the verification harness —
 * migrations, seed, fixtures, the built server — and no assertions, because a
 * design pass wants every surface at both widths rather than the handful a
 * behavioural check happens to visit.
 *
 *   node tools/shoot-user.mjs
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
const shotDir = join(root, '.design-shots-user');
const prismaCli = createRequire(join(dbPackage, 'package.json')).resolve(
  'prisma/build/index.js',
);
const nextCli = createRequire(join(appDir, 'package.json')).resolve('next/dist/bin/next');

const PASSWORD = `Shoot-${randomBytes(18).toString('base64url')}`;
const BUYER_EMAIL = 'buyer@example.test';

/** Every surface a buyer works in, in the order they meet it. */
const SURFACES = [
  ['manufacturing', '/manufacturing'],
  ['requests', '/manufacturing/rfq'],
  ['active-orders', '/manufacturing/orders'],
  ['history', '/manufacturing/history'],
  ['draft', '/manufacturing/draft/verify_rfq_draft'],
  ['draft-spec', '/manufacturing/draft/verify_rfq_draft/specification'],
  ['request', '/manufacturing/rfq/verify_rfq_open'],
  ['request-quotes', '/manufacturing/rfq/verify_rfq_open/quotes'],
  ['request-compare', '/manufacturing/rfq/verify_rfq_open/compare'],
  ['request-substitutions', '/manufacturing/rfq/verify_rfq_open/substitutions'],
  ['request-activity', '/manufacturing/rfq/verify_rfq_open/activity'],
  ['order', '/manufacturing/orders/verify_order_delivered'],
  ['order-completed', '/manufacturing/orders/verify_order_completed'],
  ['favorites', '/favorites'],
  ['messages', '/messages'],
  ['notifications', '/notifications'],
];

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

const run = (label, file, env) => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', join(root, 'tools', file)], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed: ${(result.stderr ?? '').trim().slice(0, 300)}`);
  }
};

const main = async () => {
  takeBuildLock('buyer screenshots');
  const dataDir = mkdtempSync(join(tmpdir(), 'ideeza-shoot-user-pg-'));
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
  try {
    process.stdout.write('booting postgres…\n');
    await postgres.initialise();
    await postgres.start();
    await postgres.createDatabase('ideeza_shoot_user');
    const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${pgPort}/ideeza_shoot_user?schema=public`;

    const migrate = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
      cwd: dbPackage,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: 'utf8',
    });
    if (migrate.status !== 0) throw new Error('migrations failed');

    run('seed', 'seed-and-provision.ts', { DATABASE_URL: databaseUrl, VERIFY_PASSWORD: PASSWORD });
    run('fixtures', 'verify-fixtures.ts', { DATABASE_URL: databaseUrl });

    process.stdout.write('starting the built app…\n');
    appProcess = spawn(process.execPath, [nextCli, 'start', '--port', String(appPort)], {
      cwd: appDir,
      env: { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const base = `http://127.0.0.1:${appPort}`;
    if (!(await waitForServer(`${base}/health`))) throw new Error('app did not start');

    const browser = await chromium.launch();

    for (const [width, height, suffix] of [
      [1440, 900, ''],
      [390, 844, '-390'],
    ]) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      await signIn(page, base, BUYER_EMAIL);

      for (const [name, path] of SURFACES) {
        await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(900);
        await page.screenshot({
          path: join(shotDir, `${name}${suffix}.png`),
          fullPage: true,
        });
        process.stdout.write(`  ${name}${suffix}\n`);
      }

      await context.close();
    }

    await browser.close();
    process.stdout.write(`\nscreenshots in ${shotDir}\n`);
  } finally {
    appProcess?.kill();
    await postgres.stop().catch(() => undefined);
    rmSync(dataDir, { recursive: true, force: true });
  }
};

main().catch((error) => {
  process.stdout.write(`${String(error)}\n`);
  process.exitCode = 1;
});
