-- Per-event guest-list roles and allowances (additive only).
-- Existing guests get no manager or allocation; with no EventRole rows an event keeps today's
-- behaviour (every wedding member can edit every household).

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "allocationId" TEXT,
ADD COLUMN     "managedByUserId" TEXT;

-- CreateTable
CREATE TABLE "EventRole" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "canManageAllGuests" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAllocation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "places" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventRole_eventId_userId_key" ON "EventRole"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventAllocation_eventId_userId_key" ON "EventAllocation"("eventId", "userId");

-- CreateIndex
CREATE INDEX "Guest_allocationId_deletedAt_idx" ON "Guest"("allocationId", "deletedAt");

-- CreateIndex
CREATE INDEX "Guest_eventId_managedByUserId_idx" ON "Guest"("eventId", "managedByUserId");

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_managedByUserId_fkey" FOREIGN KEY ("managedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "EventAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRole" ADD CONSTRAINT "EventRole_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRole" ADD CONSTRAINT "EventRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAllocation" ADD CONSTRAINT "EventAllocation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAllocation" ADD CONSTRAINT "EventAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data integrity
ALTER TABLE "EventRole" ADD CONSTRAINT "EventRole_role_check" CHECK ("role" IN ('organizer', 'contributor'));
ALTER TABLE "EventAllocation" ADD CONSTRAINT "EventAllocation_places_check" CHECK ("places" >= 0);

-- Reached only through Prisma (table owner); keep them out of the Supabase Data API.
ALTER TABLE "EventRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventAllocation" ENABLE ROW LEVEL SECURITY;
