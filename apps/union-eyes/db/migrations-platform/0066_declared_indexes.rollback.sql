-- Rollback of platform-migration:declared_indexes. It drops exactly the indexes that migration created (they carry its tag), and nothing that existed before it.
DO $rollback$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, i.relname AS index_name
      FROM pg_class i
      JOIN pg_namespace n ON n.oid = i.relnamespace
     WHERE i.relkind = 'i' AND obj_description(i.oid, 'pg_class') = 'platform-migration:declared_indexes'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', r.schema_name, r.index_name);
  END LOOP;
END
$rollback$;
