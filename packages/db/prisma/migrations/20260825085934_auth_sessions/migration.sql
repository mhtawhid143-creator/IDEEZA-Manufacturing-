-- CreateEnum
CREATE TYPE "SessionRevocationReason" AS ENUM ('signed_out', 'rotated', 'password_changed', 'revoked_by_operations', 'account_suspended');

-- CreateTable
CREATE TABLE "UserCredential" (
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'scrypt',
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCredential_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "role" "ActorRole" NOT NULL,
    "activeManufacturerId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idleExpiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" "SessionRevocationReason",
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Session_idleExpiresAt_idx" ON "Session"("idleExpiresAt");

-- CreateIndex
CREATE INDEX "Session_absoluteExpiresAt_idx" ON "Session"("absoluteExpiresAt");

-- CreateIndex
CREATE INDEX "Session_activeManufacturerId_idx" ON "Session"("activeManufacturerId");

-- AddForeignKey
ALTER TABLE "UserCredential" ADD CONSTRAINT "UserCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_activeManufacturerId_fkey" FOREIGN KEY ("activeManufacturerId") REFERENCES "ManufacturerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
