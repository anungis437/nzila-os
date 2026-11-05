-- 0053_enhanced_rbac_rls_closure rollback: removes the policies and row security from member_roles, permission_exceptions and rbac_audit_log. Run only with the code that
-- reads them disabled; without row security the runtime grants would expose every organization's rows. Platform 0075 removes the relations themselves.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['member_roles', 'permission_exceptions', 'rbac_audit_log'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_select ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_insert ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_update ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_delete ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON public.%I', t);
      EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;
