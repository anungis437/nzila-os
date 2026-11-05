-- 0054_staging_proof_ledger_rls_closure rollback: removes the policy and row security from the three staging proof ledger relations. Run only with the staging
-- proof route disabled; platform 0078 removes the relations themselves.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['staging_proof_nonce_uses', 'staging_proof_runs', 'staging_proof_run_events'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON public.%I', t);
      EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;
