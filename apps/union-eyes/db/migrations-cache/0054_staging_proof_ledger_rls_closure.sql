-- 0054_staging_proof_ledger_rls_closure
--
-- Row security for the relations platform 0078 creates for the staging proof harness (staging_proof_nonce_uses, staging_proof_runs, staging_proof_run_events).
-- They hold no tenant data: a proof run makes and retires its own synthetic organization, and none of the three carries an organization column. They are
-- SYSTEM_ONLY in the storage-authority manifest: FORCE row-level security with a single system-role policy and no runtime policy (the 0036, 0043 and 0052 shape), so
-- the tenant runtime role cannot read or write them even if a grant were ever added by mistake.
-- This migration does not grant DML: exact privileges come from the storage-authority manifest at grant activation (the system role gets INSERT and SELECT on the
-- nonce and event relations, and INSERT, SELECT and UPDATE on the run relation; no role may delete). Without these policies the catalog preflight leaves the
-- relations unclassified and runtime grant activation aborts.

DO $$
DECLARE
  t text;
BEGIN
  IF to_regrole('union_eyes_system') IS NULL THEN
    RAISE EXCEPTION 'RLS 0054 fail-closed: role union_eyes_system does not exist.';
  END IF;
  FOREACH t IN ARRAY ARRAY['staging_proof_nonce_uses', 'staging_proof_runs', 'staging_proof_run_events'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'RLS 0054 fail-closed: public.% does not exist (platform 0078 not applied).', t;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
      WHERE c.oid = ('public.' || t)::regclass AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
    ) THEN
      RAISE EXCEPTION 'RLS 0054 fail-closed: public.% is owned by a runtime role.', t;
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE public.staging_proof_nonce_uses ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.staging_proof_nonce_uses FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_full_access ON public.staging_proof_nonce_uses;
--> statement-breakpoint
CREATE POLICY ue_system_full_access ON public.staging_proof_nonce_uses FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE public.staging_proof_runs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.staging_proof_runs FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_full_access ON public.staging_proof_runs;
--> statement-breakpoint
CREATE POLICY ue_system_full_access ON public.staging_proof_runs FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE public.staging_proof_run_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.staging_proof_run_events FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_full_access ON public.staging_proof_run_events;
--> statement-breakpoint
CREATE POLICY ue_system_full_access ON public.staging_proof_run_events FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
