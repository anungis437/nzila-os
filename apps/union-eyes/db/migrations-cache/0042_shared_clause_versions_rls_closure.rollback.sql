-- 0042_shared_clause_versions_rls_closure rollback: removes the policies and row security. Run only with the clause routes that write
-- versions disabled, or with the table dropped.
DO $$ BEGIN
  IF to_regclass('public.shared_clause_versions') IS NOT NULL THEN
    DROP POLICY IF EXISTS ue_org_isolation_select ON public.shared_clause_versions;
    DROP POLICY IF EXISTS ue_org_isolation_insert ON public.shared_clause_versions;
    DROP POLICY IF EXISTS ue_org_isolation_update ON public.shared_clause_versions;
    DROP POLICY IF EXISTS ue_org_isolation_delete ON public.shared_clause_versions;
    DROP POLICY IF EXISTS ue_system_full_access ON public.shared_clause_versions;
    DROP POLICY IF EXISTS ue_system_select ON public.shared_clause_versions;
    ALTER TABLE public.shared_clause_versions NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.shared_clause_versions DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;
