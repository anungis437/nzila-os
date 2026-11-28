-- platform-migration:member_external_identity: a membership can carry the member's stable identifier in an external system of record (a membership registry, a payroll
-- or dues source), so an import or an integration finds the same membership again instead of matching on a name or an email.
-- organization_members gains two nullable columns: external_member_source (which system) and external_member_id (the member's id there). The key is whole or absent: a
-- CHECK refuses an id without its source and a blank value in either. One membership per (organization, source, external id): a partial unique index that is also the
-- concurrency guard (two imports racing to bind the same external id to two people cannot both commit).
-- Nothing is invented: existing rows keep NULL. Each column, index and constraint is tagged so the rollback removes exactly those, and the rollback refuses while a
-- membership holds an external identity. A column that already exists with the same type is left alone and untagged; one with another type is refused.
DO $member_external_identity$
DECLARE
  r record;
  target regclass := to_regclass('public.organization_members');
  found_type text;
BEGIN
  IF target IS NULL THEN
    RAISE EXCEPTION 'platform member external identity fail-closed: public.organization_members does not exist.';
  END IF;
  FOR r IN
    SELECT * FROM (VALUES
      ('external_member_id', 'character varying(255)'),
      ('external_member_source', 'character varying(100)')
    ) AS v(column_name, column_type)
    ORDER BY column_name
  LOOP
    SELECT format_type(a.atttypid, a.atttypmod) INTO found_type
      FROM pg_attribute a WHERE a.attrelid = target AND a.attname = r.column_name AND a.attnum > 0 AND NOT a.attisdropped;
    IF found_type IS NULL THEN
      EXECUTE format('ALTER TABLE public.organization_members ADD COLUMN %I %s', r.column_name, r.column_type);
      EXECUTE format('COMMENT ON COLUMN public.organization_members.%I IS %L', r.column_name, 'platform-migration:member_external_identity:column');
    ELSIF found_type <> r.column_type THEN
      RAISE EXCEPTION 'platform member external identity fail-closed: public.organization_members.% is %, not %.', r.column_name, found_type, r.column_type;
    END IF;
  END LOOP;
END
$member_external_identity$;
--> statement-breakpoint
DO $member_external_identity_keys$
BEGIN
  IF to_regclass('public.ux_organization_members_external_identity') IS NULL THEN
    CREATE UNIQUE INDEX ux_organization_members_external_identity ON public.organization_members (organization_id, external_member_source, external_member_id) WHERE external_member_id IS NOT NULL;
    COMMENT ON INDEX public.ux_organization_members_external_identity IS 'platform-migration:member_external_identity:index';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.organization_members'::regclass AND conname = 'organization_members_external_identity_whole') THEN
    ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_external_identity_whole CHECK (
      (external_member_id IS NULL AND external_member_source IS NULL)
      OR (external_member_id IS NOT NULL AND btrim(external_member_id) <> '' AND external_member_source IS NOT NULL AND btrim(external_member_source) <> '')
    );
    COMMENT ON CONSTRAINT organization_members_external_identity_whole ON public.organization_members IS 'platform-migration:member_external_identity:constraint';
  END IF;
END
$member_external_identity_keys$;
