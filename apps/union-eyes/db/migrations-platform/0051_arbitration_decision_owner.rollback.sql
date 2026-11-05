-- Rollback for 0051_arbitration_decision_owner. The owner column is dropped (who supplied each decision is discarded) and is_public
-- returns to defaulting to true. The columns is_public, access_restrictions and imported_from are left in place: they may hold data.
DROP INDEX IF EXISTS public.arbitration_decisions_source_org_idx;
ALTER TABLE IF EXISTS public.arbitration_decisions DROP COLUMN IF EXISTS source_organization_id;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'arbitration_decisions' AND column_name = 'is_public') THEN
    ALTER TABLE public.arbitration_decisions ALTER COLUMN is_public SET DEFAULT true;
  END IF;
END $$;
