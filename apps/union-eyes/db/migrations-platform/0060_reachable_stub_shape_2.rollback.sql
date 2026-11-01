-- PLATFORM_SQL_ROLLBACK 0060_reachable_stub_shape_2
--
-- Reverses 0060: drops exactly the columns that migration added (they carry the tag platform-migration:0060_reachable_stub_shape_2) and
-- the enum types it created, once no column uses them. A column or enum type that existed before 0060 was applied has no tag and is never
-- touched. Dropping a column discards what was written to it since 0060 was applied.
--
-- The defaults 0060 set on id, created_at and updated_at are left in place on purpose: they only repair inserts through the ORM, nothing
-- depends on their absence, and removing them would put back the failure 0060 repaired.
--> statement-breakpoint
DO $rollback$
DECLARE
  r record;
BEGIN
  -- Only the columns this migration tagged when it added them; a column that existed before it was applied is never touched.
  FOR r IN
    SELECT c.relname AS table_name, a.attname AS column_name
      FROM pg_description d
      JOIN pg_class c ON c.oid = d.objoid AND d.classoid = 'pg_class'::regclass
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
     WHERE n.nspname = 'public' AND d.objsubid > 0 AND d.description = 'platform-migration:0060_reachable_stub_shape_2' AND NOT a.attisdropped
     ORDER BY c.relname, a.attnum
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS %I', r.table_name, r.column_name);
  END LOOP;
  -- Only the enum types this migration created, and only when no column uses them any more.
  FOR r IN
    SELECT t.oid AS type_oid, t.typarray AS array_oid, t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public' AND t.typtype = 'e' AND obj_description(t.oid, 'pg_type') = 'platform-migration:0060_reachable_stub_shape_2'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
       WHERE a.atttypid IN (r.type_oid, r.array_oid) AND NOT a.attisdropped AND c.relkind IN ('r', 'p')
    ) THEN
      EXECUTE format('DROP TYPE public.%I', r.typname);
    END IF;
  END LOOP;
END
$rollback$;
