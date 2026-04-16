-- Optional country dial code for structured phone storage (+1, +44, …). Null = legacy rows.
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "phoneCountryCode" TEXT;
