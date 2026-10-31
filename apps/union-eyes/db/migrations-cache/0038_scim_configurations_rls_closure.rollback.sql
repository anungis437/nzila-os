-- 0038_scim_configurations_rls_closure rollback: removes the policies and row security. Run only with the SCIM routes disabled.
DO $$ BEGIN
  IF to_regclass('public.scim_configurations') IS NOT NULL THEN
    DROP POLICY IF EXISTS ue_org_isolation_select ON public.scim_configurations;
    DROP POLICY IF EXISTS ue_org_isolation_insert ON public.scim_configurations;
    DROP POLICY IF EXISTS ue_org_isolation_update ON public.scim_configurations;
    DROP POLICY IF EXISTS ue_org_isolation_delete ON public.scim_configurations;
    DROP POLICY IF EXISTS ue_system_full_access ON public.scim_configurations;
    ALTER TABLE public.scim_configurations NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.scim_configurations DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;
