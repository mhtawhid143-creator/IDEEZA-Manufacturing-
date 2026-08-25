import { PrismaClient } from '@prisma/client';

export type { PrismaClient } from '@prisma/client';
export { Prisma } from '@prisma/client';

export interface DatabaseClientOptions {
  /** Overrides DATABASE_URL, which is how the test harness targets its own database. */
  readonly url?: string | undefined;
  readonly log?: boolean | undefined;
}

/**
 * Builds a client. Connection details always come from the environment; no
 * credential is ever written into the codebase.
 */
export const createDatabaseClient = (
  options: DatabaseClientOptions = {},
): PrismaClient => {
  const url = options.url ?? process.env['DATABASE_URL'];
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_URL is not set. Copy packages/db/.env.example to packages/db/.env and point it at a local PostgreSQL database.',
    );
  }
  return new PrismaClient({
    datasources: { db: { url } },
    ...(options.log === true ? { log: ['query', 'warn', 'error'] } : {}),
  });
};

let shared: PrismaClient | undefined;

/** Process-wide client for application code. */
export const databaseClient = (): PrismaClient => {
  shared ??= createDatabaseClient();
  return shared;
};
