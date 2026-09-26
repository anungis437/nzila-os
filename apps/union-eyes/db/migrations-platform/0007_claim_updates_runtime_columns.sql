-- PLATFORM_SQL 0007 — additive claim_updates columns required by seed + runtime.
-- Authority: apps/union-eyes/db/schema/claims-schema.ts (claimUpdates)
-- Runtime-proven gap on reconstituted snapshots: update_type missing caused
-- seed claim_updates INSERT to be skipped (42703).
-- Idempotent ADD COLUMN IF NOT EXISTS only. No redesign.

ALTER TABLE claim_updates ADD COLUMN IF NOT EXISTS update_type varchar(50);
ALTER TABLE claim_updates ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE claim_updates ADD COLUMN IF NOT EXISTS created_by varchar(255);
ALTER TABLE claim_updates ADD COLUMN IF NOT EXISTS is_internal boolean DEFAULT false;
ALTER TABLE claim_updates ADD COLUMN IF NOT EXISTS visibility_scope text DEFAULT 'member';
ALTER TABLE claim_updates ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE claim_updates ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE claim_updates ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE claim_updates ADD COLUMN IF NOT EXISTS update_id uuid;

-- Snapshot claim_updates.id/update_id may be NOT NULL without server DEFAULT.
DO $$
BEGIN
  BEGIN
    ALTER TABLE claim_updates ALTER COLUMN id SET DEFAULT gen_random_uuid();
  EXCEPTION WHEN undefined_column OR datatype_mismatch OR undefined_function THEN NULL;
  END;
  BEGIN
    ALTER TABLE claim_updates ALTER COLUMN update_id SET DEFAULT gen_random_uuid();
  EXCEPTION WHEN undefined_column OR datatype_mismatch OR undefined_function THEN NULL;
  END;
END $$;
