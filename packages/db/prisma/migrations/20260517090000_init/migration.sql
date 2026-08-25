-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ActorRole" AS ENUM ('buyer', 'manufacturer', 'ops_admin');

-- CreateEnum
CREATE TYPE "PackageKind" AS ENUM ('pcb', 'module_3d', 'full_product');

-- CreateEnum
CREATE TYPE "AssemblyMode" AS ENUM ('none', 'smt', 'through_hole', 'mixed');

-- CreateEnum
CREATE TYPE "SubstitutionPolicy" AS ENUM ('not_allowed', 'with_approval', 'manufacturer_discretion');

-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('draft', 'submitted', 'closed', 'withdrawn');

-- CreateEnum
CREATE TYPE "RfqRecipientStatus" AS ENUM ('routed', 'viewed', 'quoted', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "RfqDeclineReason" AS ENUM ('capability_mismatch', 'capacity_unavailable', 'below_minimum_order_quantity', 'parts_unavailable', 'lead_time_not_achievable', 'files_incomplete', 'destination_not_served', 'other');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('draft', 'submitted', 'revision_requested', 'revised', 'accepted', 'rejected', 'expired', 'withdrawn');

-- CreateEnum
CREATE TYPE "SubstitutionStatus" AS ENUM ('proposed', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('awaiting_payment', 'confirmed', 'in_production', 'quality_check', 'ready_to_ship', 'shipped', 'delivered', 'completed', 'cancel_requested', 'cancelled', 'refund_requested', 'refunded', 'partially_refunded', 'disputed', 'resolved');

-- CreateEnum
CREATE TYPE "ProductionStageKey" AS ENUM ('quote_accepted', 'payment_secured', 'files_under_review', 'materials_confirmed', 'in_production', 'quality_check', 'ready_to_ship', 'shipped', 'delivered', 'completed');

-- CreateEnum
CREATE TYPE "ProductionProgressStatus" AS ENUM ('pending', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('initiated', 'secured', 'released', 'refunded', 'partially_refunded');

-- CreateEnum
CREATE TYPE "PaymentMethodKind" AS ENUM ('card', 'paypal', 'bank', 'stablecoin', 'platform_token');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('pending_release', 'released', 'refunded', 'disputed');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('requested', 'paid', 'rejected');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('requested', 'mfr_responded', 'ops_review', 'approved', 'partial', 'rejected');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('open', 'responded', 'under_review', 'resolved', 'escalated');

-- CreateEnum
CREATE TYPE "DisputeOutcome" AS ENUM ('no_issue_found', 'rework', 'partial_refund', 'full_refund', 'replacement_shipment', 'cancelled_before_production', 'escalated_to_inspection');

-- CreateEnum
CREATE TYPE "OrderIssueReason" AS ENUM ('failed_quality_check', 'defective_units', 'wrong_specification', 'wrong_quantity', 'unapproved_substitution', 'late_delivery', 'damaged_in_transit', 'not_delivered', 'missing_documentation');

-- CreateEnum
CREATE TYPE "MessageContextKind" AS ENUM ('rfq', 'quote', 'order', 'shipping', 'dispute');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('accepted_quote', 'order_terms', 'design_file', 'bom_revision', 'approved_substitution', 'change_order', 'quality_report', 'measurement_data', 'photo', 'shipping_record', 'delivery_record', 'buyer_statement', 'manufacturer_statement');

-- CreateEnum
CREATE TYPE "EvidenceContextKind" AS ENUM ('rfq', 'quote', 'order', 'production', 'delivery', 'refund', 'dispute');

-- CreateEnum
CREATE TYPE "EventSubjectKind" AS ENUM ('rfq', 'rfq_recipient', 'quote', 'substitution', 'payment', 'order', 'production_stage', 'production_task', 'refund', 'dispute', 'payout', 'evidence', 'review');

-- CreateEnum
CREATE TYPE "DomainEventKind" AS ENUM ('rfq_submitted', 'rfq_withdrawn', 'rfq_recipient_viewed', 'rfq_recipient_declined', 'rfq_recipient_expired', 'rfq_clarification_requested', 'quote_submitted', 'quote_revision_requested', 'quote_revised', 'quote_accepted', 'quote_rejected', 'quote_expired', 'quote_withdrawn', 'substitution_suggested', 'substitution_approved', 'substitution_rejected', 'payment_initiated', 'payment_secured', 'payment_failed', 'order_created', 'order_confirmed', 'order_production_started', 'order_stage_advanced', 'order_task_updated', 'order_shipped', 'order_delivered', 'order_delivery_confirmed', 'order_review_window_expired', 'order_completed', 'order_cancel_requested', 'order_cancelled', 'refund_requested', 'refund_manufacturer_approved', 'refund_manufacturer_challenged', 'refund_decided', 'dispute_opened', 'dispute_responded', 'dispute_under_review', 'dispute_resolved', 'dispute_escalated', 'inspection_evidence_accepted', 'partial_refund_agreed', 'payout_released', 'payout_withheld', 'evidence_captured', 'review_published');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "ActorRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspendedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostalAddress" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "label" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "postalCode" TEXT,
    "countryCode" CHAR(2) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostalAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManufacturerProfile" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "postalCode" TEXT,
    "countryCode" CHAR(2) NOT NULL,
    "rating" DECIMAL(3,2),
    "onTimeDeliveryRate" DECIMAL(5,4),
    "completedOrderCount" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManufacturerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManufacturerCapability" (
    "manufacturerId" TEXT NOT NULL,
    "services" TEXT[],
    "certifications" TEXT[],
    "servedRegions" TEXT[],
    "minimumOrderQuantity" INTEGER NOT NULL,
    "standardLeadTimeDays" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManufacturerCapability_pkey" PRIMARY KEY ("manufacturerId")
);

-- CreateTable
CREATE TABLE "ManufacturerMember" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManufacturerMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileRef" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "contentHash" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFile" (
    "productId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "ProductFile_pkey" PRIMARY KEY ("productId","fileId")
);

-- CreateTable
CREATE TABLE "BomLine" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "manufacturerPartNumber" TEXT,
    "sku" TEXT,
    "footprint" TEXT,
    "quantityPerUnit" INTEGER NOT NULL,

    CONSTRAINT "BomLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManufacturingPackage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "PackageKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManufacturingPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageFile" (
    "packageId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "PackageFile_pkey" PRIMARY KEY ("packageId","fileId")
);

-- CreateTable
CREATE TABLE "PackageBomLine" (
    "packageId" TEXT NOT NULL,
    "bomLineId" TEXT NOT NULL,

    CONSTRAINT "PackageBomLine_pkey" PRIMARY KEY ("packageId","bomLineId")
);

-- CreateTable
CREATE TABLE "ManufacturingRequirements" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "quantity" INTEGER NOT NULL,
    "material" TEXT NOT NULL,
    "manufacturingMethod" TEXT NOT NULL,
    "tolerance" TEXT NOT NULL,
    "leadTimeDays" INTEGER NOT NULL,
    "shippingRequirement" TEXT NOT NULL,
    "assembly" "AssemblyMode" NOT NULL,
    "qualityCheckRequirement" TEXT NOT NULL,
    "substitutionPolicy" "SubstitutionPolicy" NOT NULL,
    "notes" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManufacturingRequirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementsFile" (
    "requirementsId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "RequirementsFile_pkey" PRIMARY KEY ("requirementsId","fileId")
);

-- CreateTable
CREATE TABLE "Rfq" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "requirementsId" TEXT NOT NULL,
    "status" "RfqStatus" NOT NULL DEFAULT 'draft',
    "quantity" INTEGER NOT NULL,
    "volumeTiers" INTEGER[],
    "targetPriceMinor" BIGINT,
    "currency" CHAR(3) NOT NULL,
    "shipToLine1" TEXT NOT NULL,
    "shipToLine2" TEXT,
    "shipToCity" TEXT NOT NULL,
    "shipToRegion" TEXT,
    "shipToPostalCode" TEXT,
    "shipToCountryCode" CHAR(2) NOT NULL,
    "neededBy" TIMESTAMP(3),
    "responseDeadline" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rfq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqRecipient" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "status" "RfqRecipientStatus" NOT NULL DEFAULT 'routed',
    "viewedAt" TIMESTAMP(3),
    "quotedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declineReason" "RfqDeclineReason",
    "declineNote" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqItem" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "manufacturerPartNumber" TEXT,
    "sku" TEXT,
    "quantityRequired" INTEGER NOT NULL,

    CONSTRAINT "RfqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "acceptedForRfqId" TEXT,
    "quantity" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "unitPriceMinor" BIGINT NOT NULL,
    "totalPriceMinor" BIGINT NOT NULL,
    "shippingEstimateMinor" BIGINT,
    "toolingSetupCostMinor" BIGINT,
    "leadTimeDays" INTEGER NOT NULL,
    "materialProcessNotes" TEXT NOT NULL,
    "warrantyTerms" TEXT,
    "terms" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "rfqItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "unitPriceMinor" BIGINT NOT NULL,
    "lineTotalMinor" BIGINT NOT NULL,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteRevision" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "requestedByBuyerAt" TIMESTAMP(3),
    "buyerNote" TEXT,
    "previousTerms" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Substitution" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "rfqItemId" TEXT NOT NULL,
    "status" "SubstitutionStatus" NOT NULL DEFAULT 'proposed',
    "requestedPartReference" TEXT NOT NULL,
    "suggestedPartName" TEXT NOT NULL,
    "suggestedInventoryItemId" TEXT,
    "technicalJustification" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "priceImpactMinor" BIGINT NOT NULL,
    "leadTimeImpactDays" INTEGER NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Substitution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteAttachment" (
    "quoteId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "QuoteAttachment_pkey" PRIMARY KEY ("quoteId","fileId")
);

-- CreateTable
CREATE TABLE "ManufacturingOrder" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "acceptedQuoteId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "paymentId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'awaiting_payment',
    "shipToLine1" TEXT NOT NULL,
    "shipToLine2" TEXT,
    "shipToCity" TEXT NOT NULL,
    "shipToRegion" TEXT,
    "shipToPostalCode" TEXT,
    "shipToCountryCode" CHAR(2) NOT NULL,
    "reviewWindowEndsAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManufacturingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcceptedQuoteSnapshot" (
    "orderId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "quoteVersion" INTEGER NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "unitPriceMinor" BIGINT NOT NULL,
    "totalPriceMinor" BIGINT NOT NULL,
    "shippingEstimateMinor" BIGINT,
    "toolingSetupCostMinor" BIGINT,
    "leadTimeDays" INTEGER NOT NULL,
    "materialProcessNotes" TEXT NOT NULL,
    "warrantyTerms" TEXT,
    "terms" TEXT NOT NULL,
    "requirements" JSONB NOT NULL,
    "approvedSubstitutionIds" TEXT[],
    "checksum" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcceptedQuoteSnapshot_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "ProductionStage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "key" "ProductionStageKey" NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "ProductionProgressStatus" NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "ProductionStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionTask" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "ProductionProgressStatus" NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ProductionTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "unitCostMinor" BIGINT NOT NULL,
    "leadTimeDays" INTEGER NOT NULL,
    "minimumOrderQuantity" INTEGER,
    "storageLocation" TEXT,
    "enabledForMatching" BOOLEAN NOT NULL DEFAULT true,
    "lastCountedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySubstitute" (
    "itemId" TEXT NOT NULL,
    "substituteId" TEXT NOT NULL,

    CONSTRAINT "InventorySubstitute_pkey" PRIMARY KEY ("itemId","substituteId")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'initiated',
    "method" "PaymentMethodKind" NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "goodsAmountMinor" BIGINT NOT NULL,
    "shippingAmountMinor" BIGINT NOT NULL DEFAULT 0,
    "taxAmountMinor" BIGINT NOT NULL DEFAULT 0,
    "platformFeeMinor" BIGINT NOT NULL DEFAULT 0,
    "totalChargedMinor" BIGINT NOT NULL,
    "securedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'pending_release',
    "currency" CHAR(3) NOT NULL,
    "orderAmountMinor" BIGINT NOT NULL,
    "platformFeeMinor" BIGINT NOT NULL,
    "netAmountMinor" BIGINT NOT NULL,
    "releaseTriggerEventId" TEXT,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'requested',
    "currency" CHAR(3) NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageThread" (
    "id" TEXT NOT NULL,
    "contextKind" "MessageContextKind" NOT NULL,
    "rfqId" TEXT,
    "quoteId" TEXT,
    "orderId" TEXT,
    "disputeId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageThreadParticipant" (
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageThreadParticipant_pkey" PRIMARY KEY ("threadId","userId")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT,
    "referencedEventId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "messageId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("messageId","fileId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deepLink" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" TEXT NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "kind" "DomainEventKind" NOT NULL,
    "actorRole" "ActorRole" NOT NULL,
    "actorUserId" TEXT,
    "actorManufacturerId" TEXT,
    "subjectKind" "EventSubjectKind" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "orderId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "contextKind" "EvidenceContextKind" NOT NULL,
    "kind" "EvidenceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "rfqId" TEXT,
    "quoteId" TEXT,
    "orderId" TEXT,
    "productionStageId" TEXT,
    "refundId" TEXT,
    "disputeId" TEXT,
    "fileId" TEXT,
    "payload" JSONB,
    "submittedById" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'requested',
    "reason" "OrderIssueReason" NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "requestedAmountMinor" BIGINT NOT NULL,
    "approvedAmountMinor" BIGINT,
    "description" TEXT NOT NULL,
    "manufacturerRespondedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "refundId" TEXT,
    "openedById" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'open',
    "reason" "OrderIssueReason" NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "claimedAmountMinor" BIGINT NOT NULL,
    "outcome" "DisputeOutcome",
    "outcomeAmountMinor" BIGINT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "PostalAddress_ownerId_idx" ON "PostalAddress"("ownerId");

-- CreateIndex
CREATE INDEX "ManufacturerProfile_countryCode_idx" ON "ManufacturerProfile"("countryCode");

-- CreateIndex
CREATE INDEX "ManufacturerMember_userId_idx" ON "ManufacturerMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ManufacturerMember_manufacturerId_userId_key" ON "ManufacturerMember"("manufacturerId", "userId");

-- CreateIndex
CREATE INDEX "Product_ownerId_idx" ON "Product"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "FileRef_contentHash_revision_key" ON "FileRef"("contentHash", "revision");

-- CreateIndex
CREATE INDEX "BomLine_sku_idx" ON "BomLine"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "BomLine_productId_reference_key" ON "BomLine"("productId", "reference");

-- CreateIndex
CREATE INDEX "ManufacturingPackage_productId_kind_idx" ON "ManufacturingPackage"("productId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ManufacturingRequirements_packageId_version_key" ON "ManufacturingRequirements"("packageId", "version");

-- CreateIndex
CREATE INDEX "Rfq_buyerId_status_idx" ON "Rfq"("buyerId", "status");

-- CreateIndex
CREATE INDEX "Rfq_status_createdAt_idx" ON "Rfq"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Rfq_createdAt_idx" ON "Rfq"("createdAt");

-- CreateIndex
CREATE INDEX "RfqRecipient_manufacturerId_status_idx" ON "RfqRecipient"("manufacturerId", "status");

-- CreateIndex
CREATE INDEX "RfqRecipient_rfqId_status_idx" ON "RfqRecipient"("rfqId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RfqRecipient_rfqId_manufacturerId_key" ON "RfqRecipient"("rfqId", "manufacturerId");

-- CreateIndex
CREATE INDEX "RfqItem_sku_idx" ON "RfqItem"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "RfqItem_rfqId_reference_key" ON "RfqItem"("rfqId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_acceptedForRfqId_key" ON "Quote"("acceptedForRfqId");

-- CreateIndex
CREATE INDEX "Quote_rfqId_status_idx" ON "Quote"("rfqId", "status");

-- CreateIndex
CREATE INDEX "Quote_manufacturerId_status_idx" ON "Quote"("manufacturerId", "status");

-- CreateIndex
CREATE INDEX "Quote_status_expiresAt_idx" ON "Quote"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_rfqId_manufacturerId_version_key" ON "Quote"("rfqId", "manufacturerId", "version");

-- CreateIndex
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRevision_quoteId_version_key" ON "QuoteRevision"("quoteId", "version");

-- CreateIndex
CREATE INDEX "Substitution_quoteId_status_idx" ON "Substitution"("quoteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Substitution_quoteId_rfqItemId_key" ON "Substitution"("quoteId", "rfqItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ManufacturingOrder_acceptedQuoteId_key" ON "ManufacturingOrder"("acceptedQuoteId");

-- CreateIndex
CREATE UNIQUE INDEX "ManufacturingOrder_paymentId_key" ON "ManufacturingOrder"("paymentId");

-- CreateIndex
CREATE INDEX "ManufacturingOrder_buyerId_status_idx" ON "ManufacturingOrder"("buyerId", "status");

-- CreateIndex
CREATE INDEX "ManufacturingOrder_manufacturerId_status_idx" ON "ManufacturingOrder"("manufacturerId", "status");

-- CreateIndex
CREATE INDEX "ManufacturingOrder_status_createdAt_idx" ON "ManufacturingOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ManufacturingOrder_createdAt_idx" ON "ManufacturingOrder"("createdAt");

-- CreateIndex
CREATE INDEX "AcceptedQuoteSnapshot_quoteId_idx" ON "AcceptedQuoteSnapshot"("quoteId");

-- CreateIndex
CREATE INDEX "ProductionStage_orderId_status_idx" ON "ProductionStage"("orderId", "status");

-- CreateIndex
CREATE INDEX "ProductionStage_status_idx" ON "ProductionStage"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionStage_orderId_key_key" ON "ProductionStage"("orderId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionStage_orderId_position_key" ON "ProductionStage"("orderId", "position");

-- CreateIndex
CREATE INDEX "ProductionTask_orderId_idx" ON "ProductionTask"("orderId");

-- CreateIndex
CREATE INDEX "ProductionTask_stageId_status_idx" ON "ProductionTask"("stageId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionTask_stageId_position_key" ON "ProductionTask"("stageId", "position");

-- CreateIndex
CREATE INDEX "InventoryItem_manufacturerId_category_idx" ON "InventoryItem"("manufacturerId", "category");

-- CreateIndex
CREATE INDEX "InventoryItem_manufacturerId_enabledForMatching_idx" ON "InventoryItem"("manufacturerId", "enabledForMatching");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_manufacturerId_sku_key" ON "InventoryItem"("manufacturerId", "sku");

-- CreateIndex
CREATE INDEX "Payment_buyerId_status_idx" ON "Payment"("buyerId", "status");

-- CreateIndex
CREATE INDEX "Payment_quoteId_idx" ON "Payment"("quoteId");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Payout_manufacturerId_status_idx" ON "Payout"("manufacturerId", "status");

-- CreateIndex
CREATE INDEX "Payout_status_createdAt_idx" ON "Payout"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_orderId_key" ON "Payout"("orderId");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_manufacturerId_status_idx" ON "WithdrawalRequest"("manufacturerId", "status");

-- CreateIndex
CREATE INDEX "MessageThread_contextKind_idx" ON "MessageThread"("contextKind");

-- CreateIndex
CREATE INDEX "MessageThread_rfqId_idx" ON "MessageThread"("rfqId");

-- CreateIndex
CREATE INDEX "MessageThread_orderId_idx" ON "MessageThread"("orderId");

-- CreateIndex
CREATE INDEX "MessageThread_lastMessageAt_idx" ON "MessageThread"("lastMessageAt");

-- CreateIndex
CREATE INDEX "MessageThreadParticipant_userId_idx" ON "MessageThreadParticipant"("userId");

-- CreateIndex
CREATE INDEX "Message_threadId_sentAt_idx" ON "Message"("threadId", "sentAt");

-- CreateIndex
CREATE INDEX "Message_sentAt_idx" ON "Message"("sentAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_idx" ON "Notification"("recipientId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "DomainEvent_subjectKind_subjectId_idx" ON "DomainEvent"("subjectKind", "subjectId");

-- CreateIndex
CREATE INDEX "DomainEvent_orderId_occurredAt_idx" ON "DomainEvent"("orderId", "occurredAt");

-- CreateIndex
CREATE INDEX "DomainEvent_kind_occurredAt_idx" ON "DomainEvent"("kind", "occurredAt");

-- CreateIndex
CREATE INDEX "DomainEvent_occurredAt_idx" ON "DomainEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "DomainEvent_sequence_idx" ON "DomainEvent"("sequence");

-- CreateIndex
CREATE INDEX "Evidence_orderId_kind_idx" ON "Evidence"("orderId", "kind");

-- CreateIndex
CREATE INDEX "Evidence_contextKind_idx" ON "Evidence"("contextKind");

-- CreateIndex
CREATE INDEX "Evidence_capturedAt_idx" ON "Evidence"("capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderId_key" ON "Review"("orderId");

-- CreateIndex
CREATE INDEX "Review_manufacturerId_rating_idx" ON "Review"("manufacturerId", "rating");

-- CreateIndex
CREATE INDEX "Refund_orderId_status_idx" ON "Refund"("orderId", "status");

-- CreateIndex
CREATE INDEX "Refund_status_createdAt_idx" ON "Refund"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Dispute_orderId_status_idx" ON "Dispute"("orderId", "status");

-- CreateIndex
CREATE INDEX "Dispute_status_createdAt_idx" ON "Dispute"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PostalAddress" ADD CONSTRAINT "PostalAddress_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturerCapability" ADD CONSTRAINT "ManufacturerCapability_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "ManufacturerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturerMember" ADD CONSTRAINT "ManufacturerMember_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "ManufacturerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturerMember" ADD CONSTRAINT "ManufacturerMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileRef" ADD CONSTRAINT "FileRef_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFile" ADD CONSTRAINT "ProductFile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFile" ADD CONSTRAINT "ProductFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileRef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingPackage" ADD CONSTRAINT "ManufacturingPackage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageFile" ADD CONSTRAINT "PackageFile_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ManufacturingPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageFile" ADD CONSTRAINT "PackageFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileRef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageBomLine" ADD CONSTRAINT "PackageBomLine_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ManufacturingPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageBomLine" ADD CONSTRAINT "PackageBomLine_bomLineId_fkey" FOREIGN KEY ("bomLineId") REFERENCES "BomLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingRequirements" ADD CONSTRAINT "ManufacturingRequirements_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ManufacturingPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementsFile" ADD CONSTRAINT "RequirementsFile_requirementsId_fkey" FOREIGN KEY ("requirementsId") REFERENCES "ManufacturingRequirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementsFile" ADD CONSTRAINT "RequirementsFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileRef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ManufacturingPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_requirementsId_fkey" FOREIGN KEY ("requirementsId") REFERENCES "ManufacturingRequirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqRecipient" ADD CONSTRAINT "RfqRecipient_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqRecipient" ADD CONSTRAINT "RfqRecipient_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "ManufacturerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqItem" ADD CONSTRAINT "RfqItem_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_acceptedForRfqId_fkey" FOREIGN KEY ("acceptedForRfqId") REFERENCES "Rfq"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "ManufacturerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_rfqItemId_fkey" FOREIGN KEY ("rfqItemId") REFERENCES "RfqItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRevision" ADD CONSTRAINT "QuoteRevision_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_rfqItemId_fkey" FOREIGN KEY ("rfqItemId") REFERENCES "RfqItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_suggestedInventoryItemId_fkey" FOREIGN KEY ("suggestedInventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAttachment" ADD CONSTRAINT "QuoteAttachment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAttachment" ADD CONSTRAINT "QuoteAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileRef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_acceptedQuoteId_fkey" FOREIGN KEY ("acceptedQuoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "ManufacturerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingOrder" ADD CONSTRAINT "ManufacturingOrder_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptedQuoteSnapshot" ADD CONSTRAINT "AcceptedQuoteSnapshot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ManufacturingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStage" ADD CONSTRAINT "ProductionStage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ManufacturingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ManufacturingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProductionStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "ManufacturerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySubstitute" ADD CONSTRAINT "InventorySubstitute_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySubstitute" ADD CONSTRAINT "InventorySubstitute_substituteId_fkey" FOREIGN KEY ("substituteId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ManufacturingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "ManufacturerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_releaseTriggerEventId_fkey" FOREIGN KEY ("releaseTriggerEventId") REFERENCES "DomainEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "ManufacturerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ManufacturingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageThreadParticipant" ADD CONSTRAINT "MessageThreadParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageThreadParticipant" ADD CONSTRAINT "MessageThreadParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_referencedEventId_fkey" FOREIGN KEY ("referencedEventId") REFERENCES "DomainEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileRef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainEvent" ADD CONSTRAINT "DomainEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainEvent" ADD CONSTRAINT "DomainEvent_actorManufacturerId_fkey" FOREIGN KEY ("actorManufacturerId") REFERENCES "ManufacturerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainEvent" ADD CONSTRAINT "DomainEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ManufacturingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ManufacturingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_productionStageId_fkey" FOREIGN KEY ("productionStageId") REFERENCES "ProductionStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileRef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ManufacturingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "ManufacturerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ManufacturingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ManufacturingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

