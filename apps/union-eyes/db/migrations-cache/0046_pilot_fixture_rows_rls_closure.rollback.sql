-- 0046_pilot_fixture_rows_rls_closure rollback: removes the policies and row security.
DO $$ BEGIN
  IF to_regclass('public.pilot_fixture_rows') IS NOT NULL THEN
    DROP POLICY IF EXISTS ue_org_isolation_select ON public.pilot_fixture_rows;
    DROP POLICY IF EXISTS ue_org_isolation_insert ON public.pilot_fixture_rows;
    DROP POLICY IF EXISTS ue_org_isolation_update ON public.pilot_fixture_rows;
    DROP POLICY IF EXISTS ue_org_isolation_delete ON public.pilot_fixture_rows;
    DROP POLICY IF EXISTS ue_system_full_access ON public.pilot_fixture_rows;
    ALTER TABLE public.pilot_fixture_rows NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.pilot_fixture_rows DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;
