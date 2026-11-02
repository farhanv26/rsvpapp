-- Authorization stays in Prisma. The Data API must have no access to private attachments.
ALTER TABLE "VendorContract" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "VendorContract" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "VendorContract" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "VendorContract" FROM authenticated;
  END IF;
END $$;
