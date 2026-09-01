-- CreateEnum
CREATE TYPE "ProblemKind" AS ENUM ('technical_bug', 'design_issue', 'confusion', 'performance', 'feature_request', 'other');

-- CreateEnum
CREATE TYPE "ProblemFrustration" AS ENUM ('informational', 'annoying', 'blocking');

-- CreateTable
CREATE TABLE "ProblemReport" (
    "id" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "kind" "ProblemKind" NOT NULL,
    "frustration" "ProblemFrustration" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "extra" TEXT,
    "pageName" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProblemReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProblemReport_reportedById_createdAt_idx" ON "ProblemReport"("reportedById", "createdAt");

-- CreateIndex
CREATE INDEX "ProblemReport_kind_createdAt_idx" ON "ProblemReport"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "ProblemReport" ADD CONSTRAINT "ProblemReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
