import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DEFAULT_AUTH_CONFIG } from './config.js';

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;

const encode = (buffer: Buffer): string => buffer.toString('base64url');

/**
 * Stored form: scrypt$<log2N>$<r>$<p>$<salt>$<key>
 *
 * Self describing on purpose: the cost parameters travel with the hash, so the
 * cost can be raised later without invalidating existing passwords.
 */
export interface PasswordHashParts {
  readonly costLog2: number;
  readonly blockSize: number;
  readonly parallelism: number;
  readonly salt: Buffer;
  readonly key: Buffer;
}

const memoryFor = (costLog2: number, blockSize: number): number =>
  Math.max(32 * 1024 * 1024, 256 * (1 << costLog2) * blockSize);

export const hashPassword = async (
  password: string,
  costLog2: number = DEFAULT_AUTH_CONFIG.scryptCostLog2,
): Promise<string> => {
  if (password.length < 12) {
    throw new Error('A password must be at least 12 characters long.');
  }
  const salt = randomBytes(SALT_LENGTH);
  const key = await scryptAsync(password.normalize('NFKC'), salt, KEY_LENGTH, {
    N: 1 << costLog2,
    r: BLOCK_SIZE,
    p: PARALLELISM,
    maxmem: memoryFor(costLog2, BLOCK_SIZE),
  });
  return ['scrypt', costLog2, BLOCK_SIZE, PARALLELISM, encode(salt), encode(key)].join('$');
};

export const parsePasswordHash = (stored: string): PasswordHashParts | undefined => {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return undefined;
  const costLog2 = Number.parseInt(parts[1] ?? '', 10);
  const blockSize = Number.parseInt(parts[2] ?? '', 10);
  const parallelism = Number.parseInt(parts[3] ?? '', 10);
  if (!Number.isFinite(costLog2) || !Number.isFinite(blockSize) || !Number.isFinite(parallelism)) {
    return undefined;
  }
  if (costLog2 < 10 || costLog2 > 22) return undefined;
  return {
    costLog2,
    blockSize,
    parallelism,
    salt: Buffer.from(parts[4] ?? '', 'base64url'),
    key: Buffer.from(parts[5] ?? '', 'base64url'),
  };
};

/**
 * Constant time comparison. A malformed stored hash is treated as a mismatch
 * rather than an exception, so a corrupt row cannot be used to distinguish
 * accounts by error behaviour.
 */
export const verifyPassword = async (
  password: string,
  stored: string,
): Promise<boolean> => {
  const parts = parsePasswordHash(stored);
  if (parts === undefined || parts.key.length === 0) return false;

  const candidate = await scryptAsync(password.normalize('NFKC'), parts.salt, parts.key.length, {
    N: 1 << parts.costLog2,
    r: parts.blockSize,
    p: parts.parallelism,
    maxmem: memoryFor(parts.costLog2, parts.blockSize),
  });

  if (candidate.length !== parts.key.length) return false;
  return timingSafeEqual(candidate, parts.key);
};

/** True when a stored hash was produced with a weaker cost than the current one. */
export const passwordNeedsRehash = (
  stored: string,
  costLog2: number = DEFAULT_AUTH_CONFIG.scryptCostLog2,
): boolean => {
  const parts = parsePasswordHash(stored);
  return parts === undefined || parts.costLog2 < costLog2;
};
