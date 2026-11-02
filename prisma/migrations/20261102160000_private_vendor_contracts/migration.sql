CREATE TABLE "VendorContract" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "content" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "VendorContract_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VendorContract_size_check" CHECK ("size" > 0 AND "size" <= 5242880 AND octet_length("content") = "size"),
  CONSTRAINT "VendorContract_type_check" CHECK ("contentType" IN ('application/pdf', 'image/png', 'image/jpeg'))
);
CREATE INDEX "VendorContract_vendorId_deletedAt_idx" ON "VendorContract"("vendorId", "deletedAt");
ALTER TABLE "VendorContract" ADD CONSTRAINT "VendorContract_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
