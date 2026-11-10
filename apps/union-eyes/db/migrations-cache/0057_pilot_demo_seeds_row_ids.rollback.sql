-- 0057_pilot_demo_seeds_row_ids rollback: removes the seeded-row-id columns. Any purge still in flight that relies on them
-- falls back to the legacy name/email pattern match (the same path already used for rows seeded before this column existed).
DO $$
BEGIN
  IF to_regclass('public.pilot_demo_seeds') IS NOT NULL THEN
    ALTER TABLE "pilot_demo_seeds" DROP COLUMN IF EXISTS "employer_ids";
    ALTER TABLE "pilot_demo_seeds" DROP COLUMN IF EXISTS "grievance_ids";
  END IF;
END $$;
