/**
 * `prisma migrate deploy`, but patient about the lock.
 *
 * Both apps run migrations in their build command, and a push produces two
 * builds at once — the one asked for and the one Vercel's git hook starts. They
 * reach for the same postgres advisory lock, and Prisma gives up on it after
 * ten seconds with P1002, which fails the whole deploy. Observed three times in
 * one afternoon; the deploy that failed had nothing wrong with it.
 *
 * Waiting is the right answer rather than skipping: the other build is applying
 * the same migrations from the same commit, so by the time the lock frees there
 * is either nothing left to do or exactly the work this build wanted. Anything
 * that is not the lock fails immediately, because a broken migration must not
 * be retried into looking flaky.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');

const ATTEMPTS = 6;
const WAIT_MS = 15_000;

const heldElsewhere = (output) =>
  /P1002/.test(output) || /advisory lock/i.test(output);

const sleep = (ms) => {
  // A build has no event loop to wait on, so block: this runs alone.
  const until = Date.now() + ms;
  while (Date.now() < until) {
    /* wait */
  }
};

for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
  const run = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    encoding: 'utf8',
  });
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  process.stdout.write(output);

  if (run.status === 0) process.exit(0);

  if (!heldElsewhere(output) || attempt === ATTEMPTS) {
    process.stderr.write(
      heldElsewhere(output)
        ? `\nThe migration lock was still held after ${String(ATTEMPTS)} attempts.\n`
        : '\nThe migration failed for a reason that is not the lock; not retrying.\n',
    );
    process.exit(run.status ?? 1);
  }

  process.stdout.write(
    `\nAnother build holds the migration lock. Waiting ${String(WAIT_MS / 1000)}s and trying again (${String(attempt)}/${String(ATTEMPTS - 1)}).\n`,
  );
  sleep(WAIT_MS);
}
