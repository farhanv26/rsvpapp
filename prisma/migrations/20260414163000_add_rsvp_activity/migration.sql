-- CreateTable
CREATE TABLE "RsvpActivity" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RsvpActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RsvpActivity_eventId_createdAt_idx" ON "RsvpActivity"("eventId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "RsvpActivity_guestId_createdAt_idx" ON "RsvpActivity"("guestId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "RsvpActivity" ADD CONSTRAINT "RsvpActivity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RsvpActivity" ADD CONSTRAINT "RsvpActivity_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
