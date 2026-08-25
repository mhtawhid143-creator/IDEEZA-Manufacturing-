import type { PrismaClient } from '@ideeza/db';
import { AuthenticationService } from './authentication.js';
import { authConfigFromEnvironment, type AuthConfig } from './config.js';
import type {
  BoundaryStore,
  Clock,
  IdentityStore,
  SessionRecord,
  SessionStore,
} from './ports.js';
import { SessionService } from './session.js';

/**
 * Prisma backed implementations of the auth ports.
 *
 * Each query selects only the columns an authentication or access decision
 * needs. In particular a user lookup never returns the password hash: that lives
 * in its own table and is read only by the credential query.
 */

export const prismaIdentityStore = (prisma: PrismaClient): IdentityStore => ({
  findUserByEmail: async (email) =>
    prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true, role: true, suspendedAt: true },
    }),

  findUserById: async (userId) =>
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, suspendedAt: true },
    }),

  findCredential: async (userId) =>
    prisma.userCredential.findUnique({
      where: { userId },
      select: {
        userId: true,
        passwordHash: true,
        failedAttempts: true,
        lockedUntil: true,
      },
    }),

  saveCredential: async (userId, passwordHash, changedAt) => {
    await prisma.userCredential.upsert({
      where: { userId },
      update: {
        passwordHash,
        passwordChangedAt: changedAt,
        failedAttempts: 0,
        lockedUntil: null,
      },
      create: { userId, passwordHash, passwordChangedAt: changedAt },
    });
  },

  recordFailedAttempt: async (userId, failedAttempts, lockedUntil) => {
    await prisma.userCredential.update({
      where: { userId },
      data: { failedAttempts, lockedUntil },
    });
  },

  recordSuccessfulSignIn: async (userId, at) => {
    await prisma.userCredential.update({
      where: { userId },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: at },
    });
  },

  listManufacturerMemberships: async (userId) => {
    const rows = await prisma.manufacturerMember.findMany({
      where: { userId },
      select: { manufacturerId: true },
      orderBy: { manufacturerId: 'asc' },
    });
    return rows.map((row) => row.manufacturerId);
  },
});

const SESSION_COLUMNS = {
  id: true,
  userId: true,
  tokenHash: true,
  role: true,
  activeManufacturerId: true,
  issuedAt: true,
  lastSeenAt: true,
  idleExpiresAt: true,
  absoluteExpiresAt: true,
  revokedAt: true,
} as const;

export const prismaSessionStore = (prisma: PrismaClient): SessionStore => ({
  create: async (record): Promise<SessionRecord> =>
    prisma.session.create({
      data: {
        id: record.id,
        userId: record.userId,
        tokenHash: record.tokenHash,
        role: record.role,
        activeManufacturerId: record.activeManufacturerId,
        issuedAt: record.issuedAt,
        lastSeenAt: record.issuedAt,
        idleExpiresAt: record.idleExpiresAt,
        absoluteExpiresAt: record.absoluteExpiresAt,
        userAgent: record.userAgent ?? null,
        ipAddress: record.ipAddress ?? null,
      },
      select: SESSION_COLUMNS,
    }),

  findByTokenHash: async (tokenHash) =>
    prisma.session.findUnique({ where: { tokenHash }, select: SESSION_COLUMNS }),

  touch: async (sessionId, lastSeenAt, idleExpiresAt) =>
    prisma.session.update({
      where: { id: sessionId },
      data: { lastSeenAt, idleExpiresAt },
      select: SESSION_COLUMNS,
    }),

  revoke: async (sessionId, at, reason) => {
    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: at, revocationReason: reason },
    });
  },

  revokeAllForUser: async (userId, at, reason) => {
    const result = await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: at, revocationReason: reason },
    });
    return result.count;
  },

  deleteExpiredBefore: async (cutoff) => {
    const result = await prisma.session.deleteMany({
      where: { absoluteExpiresAt: { lt: cutoff } },
    });
    return result.count;
  },
});

export const prismaBoundaryStore = (prisma: PrismaClient): BoundaryStore => ({
  findRfqOwnership: async (rfqId) =>
    prisma.rfq.findUnique({ where: { id: rfqId }, select: { id: true, buyerId: true } }),

  listRfqRecipients: async (rfqId) =>
    prisma.rfqRecipient.findMany({
      where: { rfqId },
      select: { rfqId: true, manufacturerId: true },
    }),

  findQuoteOwnership: async (quoteId) =>
    prisma.quote.findUnique({
      where: { id: quoteId },
      select: { id: true, rfqId: true, manufacturerId: true },
    }),

  listQuotesForRfq: async (rfqId) =>
    prisma.quote.findMany({
      where: { rfqId },
      select: { id: true, rfqId: true, manufacturerId: true },
      orderBy: { id: 'asc' },
    }),

  findOrderOwnership: async (orderId) =>
    prisma.manufacturingOrder.findUnique({
      where: { id: orderId },
      select: { id: true, buyerId: true, manufacturerId: true },
    }),

  findInventoryOwnership: async (itemId) =>
    prisma.inventoryItem.findUnique({
      where: { id: itemId },
      select: { id: true, manufacturerId: true },
    }),

  findPayoutOwnership: async (payoutId) =>
    prisma.payout.findUnique({
      where: { id: payoutId },
      select: { id: true, manufacturerId: true },
    }),
});

export interface AuthServices {
  readonly identity: IdentityStore;
  readonly sessions: SessionStore;
  readonly boundaries: BoundaryStore;
  readonly sessionService: SessionService;
  readonly authentication: AuthenticationService;
}

/** Wires the services against a Prisma client. */
export const createAuthServices = (
  prisma: PrismaClient,
  options: { readonly clock?: Clock; readonly config?: AuthConfig } = {},
): AuthServices => {
  const identity = prismaIdentityStore(prisma);
  const sessions = prismaSessionStore(prisma);
  const boundaries = prismaBoundaryStore(prisma);
  const config = options.config ?? authConfigFromEnvironment();

  const sessionService = new SessionService({
    sessions,
    identity,
    ...(options.clock === undefined ? {} : { clock: options.clock }),
    config,
  });

  const authentication = new AuthenticationService({
    identity,
    sessionService,
    ...(options.clock === undefined ? {} : { clock: options.clock }),
    config,
  });

  return { identity, sessions, boundaries, sessionService, authentication };
};
