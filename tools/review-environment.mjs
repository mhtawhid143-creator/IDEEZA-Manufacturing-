/**
 * A two-panel review environment: one database, both apps, real data.
 *
 * Boots a throwaway PostgreSQL cluster, applies the committed migrations, seeds
 * the reference scenario, provisions sign-in credentials for this run only and
 * then starts both built apps against that one database — the buyer panel on
 * 3100 and the manufacturer panel on 3200. Because both read the same rows, a
 * quote sent in one window appears in the other on a refresh, which is the whole
 * point of looking at them side by side.
 *
 * Both panels run with REVIEW_DIRECT_SIGN_IN=1, so there is no password to copy
 * into two windows: opening either one signs you in as a seeded account, and
 * /auth/sign-in?pick=1 switches account. That variable is set here and nowhere
 * else; without it both apps ask for a password as they always do.
 *
 * Nothing here is persisted: the cluster lives in a temporary directory and
 * everything is removed when the process stops. It is a review tool, not a
 * deployment.
 *
 *   node tools/review-environment.mjs
 *
 * Stop it with Ctrl+C.
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { takeBuildLock } from './build-lock.mjs';

const root = resolve(import.meta.dirname, '..');
const dbPackage = join(root, 'packages', 'db');
const prismaCli = createRequire(join(dbPackage, 'package.json')).resolve(
  'prisma/build/index.js',
);

const PANELS = [
  {
    name: 'Buyer panel',
    key: 'buyers',
    dir: join(root, 'apps', 'user'),
    preferredPort: 3100,
    landing: '/manufacturing',
  },
  {
    name: 'Manufacturer panel',
    key: 'shops',
    dir: join(root, 'apps', 'manufacturer'),
    preferredPort: 3200,
    landing: '/dashboard',
  },
];

/**
 * The seed insists on provisioning a credential, so one is generated for this
 * run and thrown away with it. Review mode never asks for it, and it is not
 * printed: a password on screen is a password somebody copies somewhere.
 */
const PASSWORD = `Review-${randomBytes(18).toString('base64url')}`;

const say = (line = '') => process.stdout.write(`${line}\n`);

const portFree = (port) =>
  new Promise((done) => {
    const probe = createServer();
    probe.once('error', () => done(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => done(true)));
  });

const anyPort = () =>
  new Promise((done, fail) => {
    const probe = createServer();
    probe.once('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });

const pickPort = async (preferred) =>
  (await portFree(preferred)) ? preferred : anyPort();

const waitForServer = async (url, attempts = 120) => {
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

const step = (label, command, args, env) => {
  say(`  ${label}…`);
  const result = spawnSync(process.execPath, [command, ...args], {
    cwd: env.cwd,
    env: { ...process.env, ...env.vars },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    say((result.stdout ?? '').trim().slice(-2_000));
    say((result.stderr ?? '').trim().slice(-2_000));
    throw new Error(`${label} failed`);
  }
};

const main = async () => {
  takeBuildLock('review environment');
  const dataDir = mkdtempSync(join(tmpdir(), 'ideeza-review-pg-'));
  const pgPort = await anyPort();
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

  const running = [];
  let stopping = false;

  const stop = async () => {
    if (stopping) return;
    stopping = true;
    say('\nstopping the review environment…');
    for (const child of running) {
      child.kill();
    }
    try {
      await postgres.stop();
    } catch {
      /* it may already be down */
    }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        rmSync(dataDir, { recursive: true, force: true });
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    say('stopped. Nothing was left behind.');
    process.exit(0);
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  say('booting a throwaway postgres…');
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase('ideeza_review');
  const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${pgPort}/ideeza_review?schema=public`;

  say('preparing the data:');
  step('migrations', prismaCli, ['migrate', 'deploy'], {
    cwd: dbPackage,
    vars: { DATABASE_URL: databaseUrl },
  });
  step(
    'seed and credentials',
    '--import',
    ['tsx', join(root, 'tools', 'seed-and-provision.ts')],
    { cwd: root, vars: { DATABASE_URL: databaseUrl, VERIFY_PASSWORD: PASSWORD } },
  );
  step('buyer-side fixtures', '--import', ['tsx', join(root, 'tools', 'verify-fixtures.ts')], {
    cwd: root,
    vars: { DATABASE_URL: databaseUrl },
  });
  step(
    'manufacturer-side fixtures',
    '--import',
    ['tsx', join(root, 'tools', 'verify-fixtures-manufacturer.ts')],
    { cwd: root, vars: { DATABASE_URL: databaseUrl } },
  );

  const accountsProbe = spawnSync(
    process.execPath,
    ['--import', 'tsx', join(root, 'tools', 'review-accounts.ts')],
    { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8' },
  );
  let accounts = { buyers: [], shops: [] };
  if (accountsProbe.status === 0) {
    accounts = JSON.parse(accountsProbe.stdout);
  } else {
    // Say it rather than printing an empty list: a panel with no accounts
    // beside it looks like a seeding failure, and this is not one.
    const why = (accountsProbe.stderr ?? '').trim().slice(-300);
    say(`  (could not read the account list: ${why})`);
  }

  say('starting both panels:');
  const started = [];
  for (const panel of PANELS) {
    const port = await pickPort(panel.preferredPort);
    const nextCli = createRequire(join(panel.dir, 'package.json')).resolve(
      'next/dist/bin/next',
    );
    const child = spawn(process.execPath, [nextCli, 'start', '--port', String(port)], {
      cwd: panel.dir,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        NODE_ENV: 'production',
        // No password to copy between windows: both panels let a seeded
        // account in on sight. Only this script sets it, and only for these
        // two child processes.
        REVIEW_DIRECT_SIGN_IN: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const log = [];
    child.stdout.on('data', (chunk) => log.push(String(chunk)));
    child.stderr.on('data', (chunk) => log.push(String(chunk)));
    running.push(child);

    const base = `http://127.0.0.1:${port}`;
    const up = await waitForServer(`${base}/health`);
    if (!up) {
      say(log.join('').slice(-1_500));
      throw new Error(`${panel.name} did not start. Has it been built? (pnpm run build)`);
    }
    say(`  ${panel.name} → ${base}${panel.landing}`);
    started.push({ ...panel, base });
  }

  say('');
  say('─'.repeat(72));
  say('  The review environment is up. Both panels read one database.');
  say('─'.repeat(72));
  for (const panel of started) {
    say('');
    say(`  ${panel.name}:  ${panel.base}${panel.landing}`);
    for (const account of accounts[panel.key] ?? []) {
      say(`     ${account.email}  — ${account.who}`);
    }
  }
  say('');
  say('  No password: both panels are in review mode and sign you straight in.');
  say('  To switch account, sign out or open /auth/sign-in?pick=1 on either one.');
  say('');
  say('  Try it two-sided: send a quote in the manufacturer window, then refresh');
  say('  the buyer window on the same request. One row, read twice.');
  say('');
  say('  Ctrl+C stops both panels and removes the database.');
  say('');
};

main().catch((error) => {
  say(`\nthe review environment could not start: ${String(error)}`);
  process.exit(1);
});
