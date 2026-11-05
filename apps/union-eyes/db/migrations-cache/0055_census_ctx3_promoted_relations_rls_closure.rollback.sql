-- 0055_census_ctx3_promoted_relations_rls_closure rollback: removes the policies and row security from job_classifications, committee_memberships,
-- integration_sync_logs and shopify_config. Run only with the code that reads them disabled; without row security the runtime grants would expose every
-- organization's rows. The relations themselves belong to the Django migrations.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['job_classifications', 'committee_memberships', 'integration_sync_logs', 'shopify_config'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_select ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_insert ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_update ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_delete ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_parent_org_isolation_v2 ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON public.%I', t);
      EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;
