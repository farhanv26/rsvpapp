-- Brings migration history in line with schema changes that reached the hosted database
-- through `prisma db push` and were never captured in a migration (Event.itinerary, the
-- Guest.excluded*Count breakdown, two index renames, User.updatedAt default).
--
-- Every statement is idempotent: on a database that already has these objects (the hosted
-- database) this migration changes nothing; on a fresh database built from migrations it
-- creates them. No existing rows are modified.

-- AlterTable
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "itinerary" JSONB;

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "excludedGuestCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "excludedMenCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "excludedWomenCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "excludedKidsCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable (@updatedAt is maintained by Prisma; dropping a default that is already absent is a no-op)
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex (only when the original name from 20260421143000_soft_delete_support is still present)
DO $$
BEGIN
  IF to_regclass('"Event_owner_deleted_idx"') IS NOT NULL
     AND to_regclass('"Event_ownerUserId_deletedAt_idx"') IS NULL THEN
    ALTER INDEX "Event_owner_deleted_idx" RENAME TO "Event_ownerUserId_deletedAt_idx";
  END IF;
  IF to_regclass('"Guest_event_deleted_idx"') IS NOT NULL
     AND to_regclass('"Guest_eventId_deletedAt_idx"') IS NULL THEN
    ALTER INDEX "Guest_event_deleted_idx" RENAME TO "Guest_eventId_deletedAt_idx";
  END IF;
END $$;
