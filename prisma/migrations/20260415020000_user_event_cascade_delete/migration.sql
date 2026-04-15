-- Drop existing FK
ALTER TABLE "Event" DROP CONSTRAINT IF EXISTS "Event_ownerUserId_fkey";

-- Recreate FK with cascade delete
ALTER TABLE "Event"
  ADD CONSTRAINT "Event_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
