/**
 * Prepares a hosted database for a client review deployment.
 *
 * Applies the committed migrations, seeds the reference scenario, provisions a
 * credential for the seeded accounts and lays down both fixture sets — the same
 * data the review environment uses locally, so a reviewer sees requests, quotes,
 * orders in production, payouts and cases rather than empty screens.
 *
 *   DATABASE_URL="postgresql://…" node tools/prepare-demo-database.mjs
 *
 * The connection string is read from the environment and never written to a file
 * in this repository. It is only ever passed to the child processes below.
 *
 * Safe to run again: the seed is idempotent and the fixtures are keyed on their
 * own identifiers. It refuses to touch a database that is not empty of its own
 * accounting — see the note on --force below.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dbPackage = join(root, 'packages', 'db');
const prismaCli = createRequire(join(dbPackage, 'package.json')).resolve(
  'prisma/build/index.js',
);

const databaseUrl = process.env['DATABASE_URL'];
if (databaseUrl === undefined || databaseUrl === '') {
  process.stdout.write(
    'DATABASE_URL is not set. Pass the hosted database connection string in the\n' +
      'environment; this script never reads or writes a credential file.\n',
  );
  process.exit(1);
}

/**
 * The demo accounts need a password even though the review link does not ask for
 * one: the seed provisions credentials, and a deployment that skips them would
 * have accounts nobody could ever sign into if review mode were turned off.
 */
const password = process.env['DEMO_PASSWORD'] ?? `Demo-${Math.random().toString(36).slice(2, 14)}`;

const step = (label, args, extraEnv = {}) => {
  process.stdout.write(`${label}…\n`);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl, ...extraEnv },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stdout.write((result.stdout ?? '').trim().slice(-2_000) + '\n');
    process.stdout.write((result.stderr ?? '').trim().slice(-2_000) + '\n');
    process.stdout.write(`\n${label} failed.\n`);
    process.exit(1);
  }
};

step('applying the migrations', [prismaCli, 'migrate', 'deploy']);
step(
  'seeding the reference scenario and provisioning credentials',
  ['--import', 'tsx', join(root, 'tools', 'seed-and-provision.ts')],
  { VERIFY_PASSWORD: password },
);
step('buyer-side fixtures', [
  '--import',
  'tsx',
  join(root, 'tools', 'verify-fixtures.ts'),
]);
step('manufacturer-side fixtures', [
  '--import',
  'tsx',
  join(root, 'tools', 'verify-fixtures-manufacturer.ts'),
]);

process.stdout.write(
  '\nThe database is ready for a review deployment.\n' +
    'The panels sign a reviewer in without a password while REVIEW_DIRECT_SIGN_IN=1.\n',
);
if (process.env['DEMO_PASSWORD'] === undefined) {
  process.stdout.write(
    'A throwaway password was generated for the seeded accounts and deliberately\n' +
      'not printed. Set DEMO_PASSWORD yourself if you ever need to sign in with one.\n',
  );
}
