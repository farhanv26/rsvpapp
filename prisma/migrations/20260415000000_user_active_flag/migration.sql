-- AlterTable
ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "User_active_name_idx" ON "User"("active", "name");
