import { createHash, randomBytes, randomUUID } from 'node:crypto';

const TOKEN_BYTES = 32;

/**
 * Session tokens are opaque random strings. Only their hash is persisted, so a
 * database dump cannot be replayed as a live session.
 */
export const createSessionToken = (): string => randomBytes(TOKEN_BYTES).toString('base64url');

export const hashSessionToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('base64url');

export const newSessionId = (): string => `sess_${randomUUID()}`;

/** Rejects anything that cannot be a token we issued, before touching the store. */
export const looksLikeSessionToken = (candidate: string): boolean =>
  /^[A-Za-z0-9_-]{40,64}$/.test(candidate);
