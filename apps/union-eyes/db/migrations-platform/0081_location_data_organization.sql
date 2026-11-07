-- platform-migration:location_data_organization: the organization a member's location record, geofence event and location deletion-log entry belongs to
-- (DEF-0B6-SYS-LOCATION-DELETION-LOG-FABRICATES-DATES-AND-HAS-NO-ORGANIZATION).
-- location_tracking and geofence_events had no organization, so the 24-hour retention sweep (app/api/cron/location-retention) wrote one undifferentiated
-- location_deletion_log entry for a run that removed several organizations' rows, and nothing could say whose data an entry was about.
-- Each of the three gains a nullable organization_id. The writers set it from the server-resolved organization (the tracking route's caller organization,
-- the geofence's owning organization), and the sweep and the member's own erasure write one log entry per organization of the rows they removed.
-- Nothing is invented: a row written before this migration keeps NULL, and its deletion is logged in an entry whose organization is NULL (unattributed),
-- never assigned to an organization it cannot be shown to belong to. No backfill, no key, no RLS or grant change (those stay in the cache root).
-- Each column this migration adds is tagged, so the rollback removes exactly those, and refuses while one holds a value. One that already exists as uuid is
-- left alone and untagged; one of another type is refused.
DO $location_org$
DECLARE
  r record;
  target regclass;
  found_type text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES ('geofence_events'), ('location_deletion_log'), ('location_tracking')) AS v(table_name) ORDER BY table_name
  LOOP
    target := to_regclass(format('public.%I', r.table_name));
    IF target IS NULL THEN
      RAISE EXCEPTION 'platform location data organization fail-closed: public.% does not exist (Django compliance migrations not applied).', r.table_name;
    END IF;
    SELECT format_type(a.atttypid, a.atttypmod) INTO found_type
      FROM pg_attribute a WHERE a.attrelid = target AND a.attname = 'organization_id' AND a.attnum > 0 AND NOT a.attisdropped;
    IF found_type IS NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN organization_id uuid', r.table_name);
      EXECUTE format('COMMENT ON COLUMN public.%I.organization_id IS %L', r.table_name, 'platform-migration:location_data_organization:column');
    ELSIF found_type <> 'uuid' THEN
      RAISE EXCEPTION 'platform location data organization fail-closed: public.%.organization_id is %, not uuid.', r.table_name, found_type;
    END IF;
  END LOOP;
END
$location_org$;
