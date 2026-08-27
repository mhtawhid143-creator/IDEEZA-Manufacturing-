/**
 * One user of the built apps at a time.
 *
 * The harnesses and the review environment all run `next start` out of the same
 * `.next` directories. Two of them at once share that build's runtime cache, and
 * on Windows a locked cache file shows up as a route that quietly fails to
 * navigate — which reads exactly like a bug in the screen and is not one. It has
 * cost enough debugging to be worth a lock.
 *
 * The lock is a file holding a pid. A stale one — the process is gone — is taken
 * over rather than respected, so a crashed run never blocks the next one.
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const lockPath = join(resolve(import.meta.dirname, '..'), '.build-lock');

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/**
 * Takes the lock, or explains who has it and exits. Registers its own release on
 * the way out so a normal finish, a Ctrl+C and a crash all free it.
 */
export const takeBuildLock = (label) => {
  try {
    const held = JSON.parse(readFileSync(lockPath, 'utf8'));
    if (typeof held.pid === 'number' && held.pid !== process.pid && alive(held.pid)) {
      process.stdout.write(
        `\n${label} cannot start: "${held.label}" (pid ${held.pid}) is already using the built apps.\n` +
          'Stop it first — two servers on one build share its cache and produce failures that are not real.\n\n',
      );
      process.exit(2);
    }
  } catch {
    /* no lock, or an unreadable one: take it */
  }

  writeFileSync(lockPath, JSON.stringify({ pid: process.pid, label, at: new Date() }));

  const release = () => releaseBuildLock();
  process.on('exit', release);
  process.on('SIGINT', release);
  process.on('SIGTERM', release);
  process.on('uncaughtException', (error) => {
    release();
    throw error;
  });
};

/** Frees the lock if this process holds it. */
export const releaseBuildLock = () => {
  try {
    const held = JSON.parse(readFileSync(lockPath, 'utf8'));
    if (held.pid === process.pid) rmSync(lockPath, { force: true });
  } catch {
    /* already gone */
  }
};
