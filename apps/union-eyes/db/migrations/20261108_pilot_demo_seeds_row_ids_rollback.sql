-- Rollback for 20261108_pilot_demo_seeds_row_ids.sql
DO $$
BEGIN
  IF to_regclass('pilot_demo_seeds') IS NOT NULL THEN
    ALTER TABLE pilot_demo_seeds
      DROP COLUMN IF EXISTS employer_ids,
      DROP COLUMN IF EXISTS grievance_ids;
  END IF;
END
$$;
