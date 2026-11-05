-- Rollback of platform-migration:declared-enum-convergence. It removes exactly what that migration added or relaxed, and nothing that existed before it.
-- Widened columns, enum members and lossless retypes are not reversed: narrowing a column could truncate data, and PostgreSQL cannot remove an enum member.
DO $rollback$
DECLARE
  r record;
BEGIN
  -- Constraints added by --uniques.
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, k.conname
      FROM pg_constraint k
      JOIN pg_class c ON c.oid = k.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE k.contype = 'u' AND obj_description(k.oid, 'pg_constraint') = 'platform-migration:declared-enum-convergence'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.schema_name, r.table_name, r.conname);
  END LOOP;
  -- Columns this migration added.
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
      FROM pg_description d
      JOIN pg_class c ON c.oid = d.objoid AND d.classoid = 'pg_class'::regclass
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
     WHERE d.objsubid > 0 AND d.description = 'platform-migration:declared-enum-convergence' AND NOT a.attisdropped
     ORDER BY n.nspname, c.relname, a.attnum
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP COLUMN IF EXISTS %I', r.schema_name, r.table_name, r.column_name);
  END LOOP;
  -- Defaults this migration set on columns that had none.
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
      FROM pg_description d
      JOIN pg_class c ON c.oid = d.objoid AND d.classoid = 'pg_class'::regclass
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
     WHERE d.objsubid > 0 AND d.description = 'platform-migration:declared-enum-convergence:default' AND NOT a.attisdropped
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP DEFAULT', r.schema_name, r.table_name, r.column_name);
    EXECUTE format('COMMENT ON COLUMN %I.%I.%I IS NULL', r.schema_name, r.table_name, r.column_name);
  END LOOP;
  -- NOT NULL this migration dropped: restored only where no row has since stored a NULL.
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
      FROM pg_description d
      JOIN pg_class c ON c.oid = d.objoid AND d.classoid = 'pg_class'::regclass
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
     WHERE d.objsubid > 0 AND d.description = 'platform-migration:declared-enum-convergence:relax' AND NOT a.attisdropped
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET NOT NULL', r.schema_name, r.table_name, r.column_name);
      EXECUTE format('COMMENT ON COLUMN %I.%I.%I IS NULL', r.schema_name, r.table_name, r.column_name);
    EXCEPTION WHEN not_null_violation THEN
      RAISE NOTICE 'platform rollback: %.%.% holds NULL values, so NOT NULL was not restored.', r.schema_name, r.table_name, r.column_name;
    END;
  END LOOP;
  -- Only the enum types this migration created, and only when no column uses them any more.
  FOR r IN
    SELECT t.oid AS type_oid, t.typarray AS array_oid, t.typname, n.nspname AS schema_name
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE t.typtype = 'e' AND obj_description(t.oid, 'pg_type') = 'platform-migration:declared-enum-convergence'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
       WHERE a.atttypid IN (r.type_oid, r.array_oid) AND NOT a.attisdropped AND c.relkind IN ('r', 'p')
    ) THEN
      EXECUTE format('DROP TYPE %I.%I', r.schema_name, r.typname);
    END IF;
  END LOOP;
END
$rollback$;
