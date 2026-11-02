-- Wedding settings, vendors and budget (additive only; existing rows get defaults).

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "timezone" TEXT;

-- AlterTable
ALTER TABLE "Wedding" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "defaultGreeting" TEXT,
ADD COLUMN     "timezone" TEXT;

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "status" TEXT NOT NULL DEFAULT 'considering',
    "quoteMinor" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetItem" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "eventId" TEXT,
    "vendorId" TEXT,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "estimateMinor" INTEGER NOT NULL DEFAULT 0,
    "agreedMinor" INTEGER,
    "perPersonMinor" INTEGER,
    "perPersonBasis" TEXT,
    "nextPaymentDueAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BudgetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetPayment" (
    "id" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vendor_weddingId_deletedAt_idx" ON "Vendor"("weddingId", "deletedAt");

-- CreateIndex
CREATE INDEX "BudgetItem_weddingId_deletedAt_idx" ON "BudgetItem"("weddingId", "deletedAt");

-- CreateIndex
CREATE INDEX "BudgetItem_eventId_idx" ON "BudgetItem"("eventId");

-- CreateIndex
CREATE INDEX "BudgetItem_vendorId_idx" ON "BudgetItem"("vendorId");

-- CreateIndex
CREATE INDEX "BudgetPayment_budgetItemId_idx" ON "BudgetPayment"("budgetItemId");

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPayment" ADD CONSTRAINT "BudgetPayment_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data integrity
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_status_check" CHECK ("status" IN ('considering', 'quoted', 'booked', 'declined'));
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_quote_check" CHECK ("quoteMinor" IS NULL OR "quoteMinor" >= 0);
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_amounts_check" CHECK ("estimateMinor" >= 0 AND ("agreedMinor" IS NULL OR "agreedMinor" >= 0) AND ("perPersonMinor" IS NULL OR "perPersonMinor" >= 0));
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_basis_check" CHECK ("perPersonBasis" IS NULL OR "perPersonBasis" IN ('invited', 'confirmed'));
ALTER TABLE "BudgetPayment" ADD CONSTRAINT "BudgetPayment_amount_check" CHECK ("amountMinor" > 0);
ALTER TABLE "Wedding" ADD CONSTRAINT "Wedding_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');
