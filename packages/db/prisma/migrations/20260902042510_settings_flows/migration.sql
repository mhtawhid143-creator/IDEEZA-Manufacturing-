-- CreateEnum
CREATE TYPE "TwoStepMethod" AS ENUM ('email', 'sms');

-- CreateEnum
CREATE TYPE "NotificationTopic" AS ENUM ('product', 'message', 'dispute', 'blog', 'policy_community', 'other');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('web', 'email', 'mobile');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('not_submitted', 'in_review', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "PayoutMethodKind" AS ENUM ('direct_bank', 'swift');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarPreset" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserSecurity" (
    "userId" TEXT NOT NULL,
    "twoStepEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoStepMethod" "TwoStepMethod" NOT NULL DEFAULT 'email',
    "securityQuestion" TEXT,
    "securityAnswerHash" TEXT,
    "loginAlerts" BOOLEAN NOT NULL DEFAULT false,
    "deactivatedAt" TIMESTAMP(3),
    "deactivateReason" TEXT,
    "reactivateAfter" TIMESTAMP(3),
    "deletionRequestedAt" TIMESTAMP(3),
    "deletionReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSecurity_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en-US',
    "dateLocale" TEXT NOT NULL DEFAULT 'en-US',
    "profileLocked" BOOLEAN NOT NULL DEFAULT false,
    "shareActivityOnFacebook" BOOLEAN NOT NULL DEFAULT false,
    "publishWishlistOnFacebook" BOOLEAN NOT NULL DEFAULT false,
    "linkWithSearchEngine" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "NotificationChoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" "NotificationTopic" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NotificationChoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'not_submitted',
    "rejectReason" TEXT,
    "fullLegalName" TEXT,
    "contactEmail" TEXT,
    "mobileNumber" TEXT,
    "countryOfResidence" TEXT,
    "agreedToTerms" BOOLEAN NOT NULL DEFAULT false,
    "dateOfBirth" TIMESTAMP(3),
    "residentialAddress" TEXT,
    "taxResidencyCountry" TEXT,
    "documentNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutMethod" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "kind" "PayoutMethodKind" NOT NULL,
    "label" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountLast4" VARCHAR(4) NOT NULL,
    "bankName" TEXT,
    "swiftCode" TEXT,
    "countryCode" CHAR(2) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxProfile" (
    "userId" TEXT NOT NULL,
    "residenceCountry" CHAR(2),
    "isUsPerson" BOOLEAN NOT NULL DEFAULT false,
    "taxIdKind" TEXT,
    "taxIdLast4" VARCHAR(4),
    "submittedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "NotificationChoice_userId_idx" ON "NotificationChoice"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationChoice_userId_topic_channel_key" ON "NotificationChoice"("userId", "topic", "channel");

-- CreateIndex
CREATE INDEX "KycSubmission_userId_idx" ON "KycSubmission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KycSubmission_userId_level_key" ON "KycSubmission"("userId", "level");

-- CreateIndex
CREATE INDEX "PayoutMethod_manufacturerId_isDefault_idx" ON "PayoutMethod"("manufacturerId", "isDefault");

-- AddForeignKey
ALTER TABLE "UserSecurity" ADD CONSTRAINT "UserSecurity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationChoice" ADD CONSTRAINT "NotificationChoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycSubmission" ADD CONSTRAINT "KycSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutMethod" ADD CONSTRAINT "PayoutMethod_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "ManufacturerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxProfile" ADD CONSTRAINT "TaxProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
