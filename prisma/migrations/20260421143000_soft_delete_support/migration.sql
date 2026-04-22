-- Soft-delete columns
ALTER TABLE "Event" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Guest" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Replace global uniques with partial uniques (active rows only)
DROP INDEX IF EXISTS "Event_slug_key";
CREATE UNIQUE INDEX "Event_slug_active_key" ON "Event"("slug") WHERE "deletedAt" IS NULL;
CREATE INDEX "Event_slug_idx" ON "Event"("slug");

DROP INDEX IF EXISTS "User_name_key";
CREATE UNIQUE INDEX "User_name_active_key" ON "User"("name") WHERE "deletedAt" IS NULL;
CREATE INDEX "User_name_idx" ON "User"("name");

DROP INDEX IF EXISTS "Guest_token_key";
CREATE UNIQUE INDEX "Guest_token_active_key" ON "Guest"("token") WHERE "deletedAt" IS NULL;

CREATE INDEX "Guest_event_deleted_idx" ON "Guest"("eventId", "deletedAt");
CREATE INDEX "Event_owner_deleted_idx" ON "Event"("ownerUserId", "deletedAt");
