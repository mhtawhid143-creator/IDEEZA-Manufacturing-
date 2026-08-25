import { createDatabaseClient, type PrismaClient } from '@ideeza/db';

/**
 * One client per process. Created lazily so that a build, which has no database
 * url, never tries to connect.
 */
const globalForDatabase = globalThis as typeof globalThis & {
  ideezaPrisma?: PrismaClient;
};

export const database = (): PrismaClient => {
  globalForDatabase.ideezaPrisma ??= createDatabaseClient();
  return globalForDatabase.ideezaPrisma;
};
