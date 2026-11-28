-- Rollback for 0063_procedural_rules_rls_closure: disables RLS on the procedural rule tables and drops their policies.
-- Forward recovery only; confirm nothing relies on tenant isolation for these tables before rolling back.
DO $$
DECLARE
  rel text;
BEGIN
  FOREACH rel IN ARRAY ARRAY['procedural_rule_sources','procedural_rule_sets','procedural_holiday_calendars','procedural_rule_lifecycle_events','grievance_procedure_bindings','grievance_procedural_facts','grievance_procedural_exceptions'] LOOP
    IF to_regclass(format('public.%I', rel)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', rel);
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_select ON public.%I', rel);
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_insert ON public.%I', rel);
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_update ON public.%I', rel);
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_delete ON public.%I', rel);
      EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON public.%I', rel);
    END IF;
  END LOOP;
END $$;
