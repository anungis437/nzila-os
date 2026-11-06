-- Rollback of platform-migration:location_data_organization. It removes exactly the organization_id columns that migration added (each carries its tag) and
-- nothing that existed before it. It refuses while one holds a value: the column records whose location data a row or a deletion-log entry is about, and
-- dropping it would lose that evidence.
DO $rollback$
DECLARE
  r record;
  holds boolean;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
      FROM pg_description d
      JOIN pg_class c ON c.oid = d.objoid AND d.classoid = 'pg_class'::regclass
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
     WHERE d.objsubid > 0 AND d.description = 'platform-migration:location_data_organization:column' AND NOT a.attisdropped
     ORDER BY 1, 2, 3
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I IS NOT NULL)', r.schema_name, r.table_name, r.column_name) INTO holds;
    IF holds THEN
      RAISE EXCEPTION 'platform location data organization rollback refuses: %.%.% holds an organization.', r.schema_name, r.table_name, r.column_name;
    END IF;
  END LOOP;

  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
      FROM pg_description d
      JOIN pg_class c ON c.oid = d.objoid AND d.classoid = 'pg_class'::regclass
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
     WHERE d.objsubid > 0 AND d.description = 'platform-migration:location_data_organization:column' AND NOT a.attisdropped
     ORDER BY 1, 2, 3
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP COLUMN %I', r.schema_name, r.table_name, r.column_name);
  END LOOP;
END
$rollback$;
