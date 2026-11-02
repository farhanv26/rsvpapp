-- Additive only: existing expense/payment/vendor IDs, links and values are preserved.
ALTER TABLE "Wedding" ADD COLUMN "plannedBudgetMinor" INTEGER;
ALTER TABLE "Wedding" ADD CONSTRAINT "Wedding_plannedBudget_check" CHECK ("plannedBudgetMinor" IS NULL OR "plannedBudgetMinor" >= 0);
ALTER TABLE "Vendor" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "requestKey" TEXT;
ALTER TABLE "BudgetItem" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "requestKey" TEXT;
ALTER TABLE "BudgetPayment" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "requestKey" TEXT, ADD COLUMN "method" TEXT, ADD COLUMN "reference" TEXT, ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "VendorContract" ADD COLUMN "requestKey" TEXT, ADD COLUMN "digest" TEXT;
CREATE UNIQUE INDEX "Vendor_requestKey_key" ON "Vendor"("requestKey");
CREATE UNIQUE INDEX "BudgetItem_requestKey_key" ON "BudgetItem"("requestKey");
CREATE UNIQUE INDEX "BudgetPayment_requestKey_key" ON "BudgetPayment"("requestKey");
CREATE UNIQUE INDEX "VendorContract_requestKey_key" ON "VendorContract"("requestKey");
CREATE UNIQUE INDEX "VendorContract_vendorId_digest_key" ON "VendorContract"("vendorId", "digest");
ALTER TABLE "VendorContract" DROP CONSTRAINT "VendorContract_size_check";
ALTER TABLE "VendorContract" ADD CONSTRAINT "VendorContract_size_check" CHECK ("size" > 0 AND "size" <= 10485760 AND octet_length("content") = "size");
