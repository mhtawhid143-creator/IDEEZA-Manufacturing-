import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  parsePasswordHash,
  passwordNeedsRehash,
  verifyPassword,
} from '../src/password.js';

// A low cost keeps the suite fast; production uses the configured default.
const COST = 12;

describe('password hashing', () => {
  it('produces a self describing scrypt hash', async () => {
    const stored = await hashPassword('correct horse battery staple', COST);
    const parts = stored.split('$');

    expect(parts[0]).toBe('scrypt');
    expect(Number(parts[1])).toBe(COST);
    expect(parsePasswordHash(stored)?.key.length).toBe(64);
  });

  it('never stores the password itself', async () => {
    const password = 'correct horse battery staple';
    const stored = await hashPassword(password, COST);
    expect(stored).not.toContain(password);
  });

  it('salts every hash, so the same password stores differently', async () => {
    const first = await hashPassword('correct horse battery staple', COST);
    const second = await hashPassword('correct horse battery staple', COST);
    expect(first).not.toBe(second);
    expect(await verifyPassword('correct horse battery staple', first)).toBe(true);
    expect(await verifyPassword('correct horse battery staple', second)).toBe(true);
  });

  it('accepts the right password and refuses a wrong one', async () => {
    const stored = await hashPassword('correct horse battery staple', COST);
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
    expect(await verifyPassword('correct horse battery stapler', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('treats a tampered or malformed hash as a mismatch rather than an error', async () => {
    const stored = await hashPassword('correct horse battery staple', COST);
    const tampered = `${stored.slice(0, -4)}AAAA`;

    expect(await verifyPassword('correct horse battery staple', tampered)).toBe(false);
    expect(await verifyPassword('correct horse battery staple', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('correct horse battery staple', 'scrypt$9$8$1$AA$AA')).toBe(
      false,
    );
  });

  it('refuses to hash a password that is too short to be worth hashing', async () => {
    await expect(hashPassword('short', COST)).rejects.toThrow(/at least 12/);
  });

  it('knows when a stored hash is weaker than the current cost', async () => {
    const weak = await hashPassword('correct horse battery staple', 12);
    expect(passwordNeedsRehash(weak, 15)).toBe(true);
    expect(passwordNeedsRehash(weak, 12)).toBe(false);
    expect(passwordNeedsRehash('not-a-hash', 12)).toBe(true);
  });
});
