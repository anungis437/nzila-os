-- PLATFORM_SQL 0028_location_deletion_log_shape
--
-- location_deletion_log is created by the Django backend as a four-column stub (id, created_at, updated_at,
-- deletion_type) with no defaults on id, created_at and updated_at. The application writes a fuller evidence row
-- (reason, record count, date range, initiator, deletion time) on two paths: self-service consent revocation
-- (DELETE /api/location/consent) and the 24-hour retention sweep (app/api/cron/location-retention). Against the stub
-- every such insert fails (no deletion_reason column; NOT NULL id/created_at/updated_at without a default), so
-- consent revocation could not complete and the sweep could not record its evidence.
--
-- Additive and idempotent only: the missing columns are added and the three required stub columns gain defaults.
-- No data is rewritten and nothing is dropped. The relation stays Django-owned; the grants come from the
-- storage-authority manifest (db/rls-storage-authority/reference-latent.ts).

DO $$
BEGIN
  IF to_regclass('public.location_deletion_log') IS NULL THEN
    RAISE EXCEPTION 'PLATFORM 0028 fail-closed: public.location_deletion_log does not exist (Django compliance migrations not applied).';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.location_deletion_log
  ADD COLUMN IF NOT EXISTS deletion_reason text,
  ADD COLUMN IF NOT EXISTS record_count varchar(20) NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS oldest_record_date timestamp,
  ADD COLUMN IF NOT EXISTS newest_record_date timestamp,
  ADD COLUMN IF NOT EXISTS initiated_by varchar(255),
  ADD COLUMN IF NOT EXISTS initiator_role varchar(50),
  ADD COLUMN IF NOT EXISTS deleted_at timestamp NOT NULL DEFAULT now();
--> statement-breakpoint
ALTER TABLE public.location_deletion_log
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();
