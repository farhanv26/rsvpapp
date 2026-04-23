-- Cross-event shared guest coordination and counting ownership.
ALTER TABLE "Guest"
ADD COLUMN "excludeFromTotals" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "excludeReason" TEXT,
ADD COLUMN "sharedGuestKey" TEXT,
ADD COLUMN "countOwnerEventId" TEXT;

CREATE INDEX "Guest_eventId_excludeFromTotals_idx" ON "Guest"("eventId", "excludeFromTotals");
CREATE INDEX "Guest_sharedGuestKey_deletedAt_idx" ON "Guest"("sharedGuestKey", "deletedAt");
CREATE INDEX "Guest_countOwnerEventId_idx" ON "Guest"("countOwnerEventId");
