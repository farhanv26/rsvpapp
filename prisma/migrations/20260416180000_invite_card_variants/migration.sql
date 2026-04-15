-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "genericCardImage" TEXT,
ADD COLUMN     "cardImage1" TEXT,
ADD COLUMN     "cardImage2" TEXT,
ADD COLUMN     "cardImage3" TEXT,
ADD COLUMN     "cardImage4" TEXT,
ADD COLUMN     "familyCardImage" TEXT;

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "isFamilyInvite" BOOLEAN NOT NULL DEFAULT false;
