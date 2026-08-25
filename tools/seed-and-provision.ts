/**
 * Prepares a verification database: the reference seed plus a password for the
 * accounts the checks sign in with.
 *
 * The password comes from the environment. Nothing here is a default that could
 * survive into a real environment.
 */
import { PrismaClient } from '@prisma/client';
import { createAuthServices } from '@ideeza/auth';
import { seedDatabase } from '../packages/db/prisma/seed.js';

const password = process.env['VERIFY_PASSWORD'];
if (password === undefined || password.length < 12) {
  process.stderr.write('VERIFY_PASSWORD must be set and at least 12 characters.\n');
  process.exit(1);
}

const prisma = new PrismaClient();

const main = async (): Promise<void> => {
  await seedDatabase(prisma);
  const services = createAuthServices(prisma);
  for (const userId of [
    'seed_user_buyer',
    'seed_user_ops',
    'seed_user_member_a',
    'seed_user_member_b',
  ]) {
    await services.authentication.setPassword(userId, password);
  }
  process.stdout.write('seeded and provisioned\n');
};

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    await prisma.$disconnect();
    process.exit(1);
  });
