-- 0051_scim_provisioned_users_rls_closure rollback: removes the policies and row security from the two SCIM relations. The functions that 0051 retired
-- are not restored: they were SECURITY DEFINER functions executable by the system role, which the catalog admission contract refuses, and they
-- never belonged to an admitted schema.
DO $$ BEGIN
  IF to_regclass('public.scim_provisioned_users') IS NOT NULL THEN
    DROP POLICY IF EXISTS ue_system_select ON public.scim_provisioned_users;
    DROP POLICY IF EXISTS ue_system_insert ON public.scim_provisioned_users;
    DROP POLICY IF EXISTS ue_system_update ON public.scim_provisioned_users;
    ALTER TABLE public.scim_provisioned_users NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.scim_provisioned_users DISABLE ROW LEVEL SECURITY;
  END IF;
  IF to_regclass('public.scim_events_log') IS NOT NULL THEN
    DROP POLICY IF EXISTS ue_system_select ON public.scim_events_log;
    DROP POLICY IF EXISTS ue_system_insert ON public.scim_events_log;
    ALTER TABLE public.scim_events_log NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.scim_events_log DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;
