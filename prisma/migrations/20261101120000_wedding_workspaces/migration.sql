-- Wedding workspaces foundation (additive only).
-- * No existing column, row, ID, token or URL is modified.
-- * Event.weddingId stays NULL for every existing event until the reviewed
--   backfill mapping is applied with scripts/wedding-backfill.ts.

-- CreateTable
CREATE TABLE "Wedding" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "backfillKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeddingMembership" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeddingMembership_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WeddingMembership_role_check" CHECK ("role" IN ('owner', 'member'))
);

-- AlterTable (nullable, no default: metadata-only change, no table rewrite)
ALTER TABLE "Event" ADD COLUMN "weddingId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Wedding_backfillKey_key" ON "Wedding"("backfillKey");

-- CreateIndex
CREATE INDEX "WeddingMembership_userId_idx" ON "WeddingMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WeddingMembership_weddingId_userId_key" ON "WeddingMembership"("weddingId", "userId");

-- CreateIndex
CREATE INDEX "Event_weddingId_deletedAt_idx" ON "Event"("weddingId", "deletedAt");

-- AddForeignKey
ALTER TABLE "WeddingMembership" ADD CONSTRAINT "WeddingMembership_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeddingMembership" ADD CONSTRAINT "WeddingMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (RESTRICT: a wedding that still has events can never be hard-deleted by accident)
ALTER TABLE "Event" ADD CONSTRAINT "Event_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The app reaches these tables only through Prisma (table-owner role, which bypasses RLS).
-- Enabling RLS with no policies keeps them unreachable through the Supabase Data API.
ALTER TABLE "Wedding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WeddingMembership" ENABLE ROW LEVEL SECURITY;
