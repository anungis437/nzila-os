-- Rollback of platform-migration:ingestion_traceability. It removes exactly what that migration added (each column, index and constraint carries its tag) and nothing that existed before it.
-- It refuses while an imported row exists: the columns hold the traceability of an import (its source, its id in the source and its batch), and dropping them would lose it.
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
     WHERE d.objsubid > 0 AND d.description = 'platform-migration:ingestion_traceability:column' AND NOT a.attisdropped
     ORDER BY 1, 2, 3
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I IS NOT NULL)', r.schema_name, r.table_name, r.column_name) INTO holds;
    IF holds THEN
      RAISE EXCEPTION 'platform ingestion traceability rollback refuses: %.%.% holds imported data.', r.schema_name, r.table_name, r.column_name;
    END IF;
  END LOOP;

  FOR r IN
    SELECT c.conrelid::regclass::text AS table_name, c.conname
      FROM pg_constraint c
      JOIN pg_description d ON d.objoid = c.oid AND d.classoid = 'pg_constraint'::regclass
     WHERE d.description = 'platform-migration:ingestion_traceability:constraint'
     ORDER BY 1, 2
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.table_name, r.conname);
  END LOOP;

  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS index_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_description d ON d.objoid = c.oid AND d.classoid = 'pg_class'::regclass AND d.objsubid = 0
     WHERE c.relkind = 'i' AND d.description = 'platform-migration:ingestion_traceability:index'
     ORDER BY 1, 2
  LOOP
    EXECUTE format('DROP INDEX %I.%I', r.schema_name, r.index_name);
  END LOOP;

  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
      FROM pg_description d
      JOIN pg_class c ON c.oid = d.objoid AND d.classoid = 'pg_class'::regclass
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
     WHERE d.objsubid > 0 AND d.description = 'platform-migration:ingestion_traceability:column' AND NOT a.attisdropped
     ORDER BY 1, 2, 3
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP COLUMN %I', r.schema_name, r.table_name, r.column_name);
  END LOOP;
END
$rollback$;
