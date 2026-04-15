CREATE TABLE "AuditActivity" (
  "id" TEXT NOT NULL,
  "eventId" TEXT,
  "userId" TEXT,
  "userName" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "entityName" TEXT,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditActivity_createdAt_idx" ON "AuditActivity"("createdAt" DESC);
CREATE INDEX "AuditActivity_eventId_createdAt_idx" ON "AuditActivity"("eventId", "createdAt" DESC);
CREATE INDEX "AuditActivity_userId_createdAt_idx" ON "AuditActivity"("userId", "createdAt" DESC);
CREATE INDEX "AuditActivity_actionType_createdAt_idx" ON "AuditActivity"("actionType", "createdAt" DESC);
