-- CreateTable
CREATE TABLE "GuestCommunicationLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "userId" TEXT,
    "actorName" TEXT,
    "channel" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestCommunicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestCommunicationLog_guestId_createdAt_idx" ON "GuestCommunicationLog"("guestId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GuestCommunicationLog_eventId_createdAt_idx" ON "GuestCommunicationLog"("eventId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "GuestCommunicationLog" ADD CONSTRAINT "GuestCommunicationLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestCommunicationLog" ADD CONSTRAINT "GuestCommunicationLog_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestCommunicationLog" ADD CONSTRAINT "GuestCommunicationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
