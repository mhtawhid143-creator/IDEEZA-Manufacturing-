-- CreateTable
CREATE TABLE "TourProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "stopIndex" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TourProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TourProgress_userId_idx" ON "TourProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TourProgress_userId_tourId_key" ON "TourProgress"("userId", "tourId");

-- AddForeignKey
ALTER TABLE "TourProgress" ADD CONSTRAINT "TourProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A stop is an index into a tour's own list of stops, so it cannot be negative.
-- Prisma does not model check constraints, so this is written by hand, in the
-- same folder as the table it guards.
ALTER TABLE "TourProgress"
  ADD CONSTRAINT "tour_progress_stop_not_negative" CHECK ("stopIndex" >= 0);
