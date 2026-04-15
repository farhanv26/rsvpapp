-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "invitedAt" TIMESTAMP(3),
ADD COLUMN     "inviteChannelLastUsed" TEXT,
ADD COLUMN     "inviteCount" INTEGER NOT NULL DEFAULT 0;
