ALTER TABLE "Event"
ADD COLUMN "inviteFontStyle" TEXT NOT NULL DEFAULT 'elegant_serif';

ALTER TABLE "Guest"
ADD COLUMN "menCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "womenCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "kidsCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Guest"
SET
  "menCount" = COALESCE("maxGuests", 0),
  "womenCount" = 0,
  "kidsCount" = 0
WHERE "menCount" = 0 AND "womenCount" = 0 AND "kidsCount" = 0;

ALTER TABLE "Guest"
ALTER COLUMN "greeting" SET DEFAULT 'Assalamu Alaikum';
