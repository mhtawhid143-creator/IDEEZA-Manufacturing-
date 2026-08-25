/**
 * Generates the next migration without needing a PostgreSQL server on the
 * developer machine.
 *
 * Prisma needs a shadow database to work out the difference between the applied
 * migration history and the current schema. This script boots a throwaway
 * cluster for that purpose, writes the SQL into a new migration folder and shuts
 * the cluster down again.
 *
 *   pnpm --filter @ideeza/db run migration:new add_something
 *
 * Structural SQL only. Check constraints and triggers are written by hand in the
 * same folder or in a follow-up guard migration, because Prisma does not model
 * them.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const prismaCli = createRequire(join(packageRoot, 'package.json')).resolve(
  'prisma/build/index.js',
);

const migrationName = process.argv[2];
if (migrationName === undefined || !/^[a-z0-9_]+$/.test(migrationName)) {
  process.stderr.write(
    'usage: migration:new <snake_case_name>\n',
  );
  process.exit(1);
}

const freePort = async (): Promise<number> =>
  new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.once('error', rejectPort);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close();
        rejectPort(new Error('could not determine a free port'));
        return;
      }
      const { port } = address;
      server.close(() => resolvePort(port));
    });
  });

const timestamp = (): string => {
  const now = new Date();
  const pad = (value: number, width = 2): string => String(value).padStart(width, '0');
  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
  ].join('');
};

const main = async (): Promise<void> => {
  const databaseDir = mkdtempSync(join(tmpdir(), 'ideeza-shadow-'));
  const port = await freePort();
  const server = new EmbeddedPostgres({
    databaseDir,
    port,
    user: 'postgres',
    password: 'postgres',
    authMethod: 'password',
    persistent: false,
    onLog: () => undefined,
    onError: () => undefined,
  });

  await server.initialise();
  await server.start();
  await server.createDatabase('shadow');

  const shadowUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/shadow?schema=public`;

  const result = spawnSync(
    process.execPath,
    [
      prismaCli,
      'migrate',
      'diff',
      '--from-migrations',
      'prisma/migrations',
      '--to-schema-datamodel',
      'prisma/schema.prisma',
      '--shadow-database-url',
      shadowUrl,
      '--script',
    ],
    { cwd: packageRoot, encoding: 'utf8', env: { ...process.env, DATABASE_URL: shadowUrl } },
  );

  await server.stop();
  rmSync(databaseDir, { recursive: true, force: true });

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? 'migrate diff failed\n');
    process.exit(result.status ?? 1);
  }

  const sql = result.stdout.trim();
  if (sql === '' || sql.startsWith('-- This is an empty migration')) {
    process.stdout.write('schema and migration history already agree; nothing to write\n');
    return;
  }

  const folder = join(packageRoot, 'prisma', 'migrations', `${timestamp()}_${migrationName}`);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'migration.sql'), `${sql}\n`, 'utf8');
  process.stdout.write(`wrote ${folder}\n`);
};

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
