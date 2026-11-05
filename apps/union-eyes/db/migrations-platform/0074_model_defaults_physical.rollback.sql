-- Rollback of platform-migration:model_defaults_physical. It drops exactly the defaults that migration set (each carries its tag) and nothing that existed before it.
DO $rollback$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
      FROM pg_description d
      JOIN pg_class c ON c.oid = d.objoid AND d.classoid = 'pg_class'::regclass
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
     WHERE d.objsubid > 0 AND d.description = 'platform-migration:model_defaults_physical:default' AND NOT a.attisdropped
     ORDER BY 1, 2, 3
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP DEFAULT', r.schema_name, r.table_name, r.column_name);
    EXECUTE format('COMMENT ON COLUMN %I.%I.%I IS NULL', r.schema_name, r.table_name, r.column_name);
  END LOOP;
END
$rollback$;
