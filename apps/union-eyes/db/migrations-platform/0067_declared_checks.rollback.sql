-- Rollback of platform-migration:declared_checks. It drops exactly the checks that migration added (they carry its tag), and nothing that existed before it.
DO $rollback$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, k.conname
      FROM pg_constraint k
      JOIN pg_class c ON c.oid = k.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE k.contype = 'c' AND obj_description(k.oid, 'pg_constraint') = 'platform-migration:declared_checks'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', r.schema_name, r.table_name, r.conname);
  END LOOP;
END
$rollback$;
