-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_name_key" ON "User"("name");

-- AlterTable
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;

-- Ensure Farhan exists for backfilling ownership
INSERT INTO "User" ("id", "name", "passwordHash", "role")
VALUES ('seed_farhan', 'Farhan', 'placeholder_hash', 'super_admin')
ON CONFLICT ("name") DO NOTHING;

-- Backfill owner on existing events
UPDATE "Event"
SET "ownerUserId" = (SELECT "id" FROM "User" WHERE "name" = 'Farhan' LIMIT 1)
WHERE "ownerUserId" IS NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Event_ownerUserId_createdAt_idx" ON "Event"("ownerUserId", "createdAt" DESC);

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Event_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "Event"
      ADD CONSTRAINT "Event_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId")
      REFERENCES "User"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;
