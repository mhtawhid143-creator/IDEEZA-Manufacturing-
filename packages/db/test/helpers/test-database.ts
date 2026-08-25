import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const dbPackageRoot = resolve(here, '..', '..');

const prismaCli = createRequire(join(dbPackageRoot, 'package.json')).resolve(
  'prisma/build/index.js',
);

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

export interface TestDatabase {
  readonly prisma: PrismaClient;
  readonly url: string;
  readonly migrationOutput: string;
  /** Creates another empty database on the same cluster and returns its url. */
  readonly createDatabase: (name: string) => Promise<string>;
  /** Runs the prisma CLI against this cluster. Returns the exit code. */
  readonly runPrisma: (args: readonly string[], databaseUrl?: string) => number;
  readonly stop: () => Promise<void>;
}

/**
 * Boots a throwaway PostgreSQL cluster, applies the committed migrations to the
 * empty database and returns a client for it.
 *
 * A real server is used rather than a stub so that check constraints, unique
 * indexes and the append-only triggers are exercised exactly as they will be in
 * production.
 */
export const startTestDatabase = async (
  databaseName = 'ideeza_manufacturing_test',
): Promise<TestDatabase> => {
  const databaseDir = mkdtempSync(join(tmpdir(), 'ideeza-pg-'));
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
  await server.createDatabase(databaseName);

  const url = `postgresql://postgres:postgres@127.0.0.1:${port}/${databaseName}?schema=public`;

  const migrationOutput = execFileSync(
    process.execPath,
    [prismaCli, 'migrate', 'deploy'],
    {
      cwd: dbPackageRoot,
      env: { ...process.env, DATABASE_URL: url },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  const urlFor = (name: string): string =>
    `postgresql://postgres:postgres@127.0.0.1:${port}/${name}?schema=public`;

  return {
    prisma,
    url,
    migrationOutput,
    createDatabase: async (name: string) => {
      await server.createDatabase(name);
      return urlFor(name);
    },
    runPrisma: (args, databaseUrl) => {
      const result = spawnSync(process.execPath, [prismaCli, ...args], {
        cwd: dbPackageRoot,
        env: { ...process.env, DATABASE_URL: databaseUrl ?? url },
        encoding: 'utf8',
      });
      return result.status ?? 1;
    },
    stop: async () => {
      await prisma.$disconnect();
      await server.stop();
      rmSync(databaseDir, { recursive: true, force: true });
    },
  };
};
