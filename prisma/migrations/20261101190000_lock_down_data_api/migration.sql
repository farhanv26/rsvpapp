-- Close the Supabase Data API (PostgREST) for every application table.
--
-- Architecture: the app never queries Postgres through supabase-js or the Data API. All data access
-- goes through Prisma on the server, connected as the table owner, and authorization is enforced in
-- application code (lib/wedding-access.ts, lib/guest-allocation.ts). The `anon` / `authenticated`
-- roles therefore need no access at all. RLS with no policies plus revoked grants means the
-- publishable key can read nothing, while the owner role (which bypasses RLS) is unaffected.
--
-- Safety: if the role running this migration does not own a table and cannot bypass RLS, the
-- migration aborts instead of risking an app connected as a non-owner seeing empty tables.
DO $$
DECLARE
  t record;
  can_bypass boolean;
BEGIN
  SELECT (rolsuper OR rolbypassrls) INTO can_bypass FROM pg_roles WHERE rolname = current_user;

  FOR t IN SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'public' LOOP
    IF t.tableowner <> current_user AND NOT can_bypass THEN
      RAISE EXCEPTION 'Refusing to enable RLS on %: owned by %, migration runs as %. Confirm the app connects as the table owner first.',
        t.tablename, t.tableowner, current_user;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated';
  END IF;
END $$;
