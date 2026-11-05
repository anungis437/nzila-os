-- 0052_declared_absent_relations_rls_closure rollback: removes the policies and row security from the twelve relations. Run only with the routes that read
-- them disabled; without row security the runtime grants would expose every organization's rows. Platform 0061 removes the relations themselves.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'anti_scab_violations', 'cnesst_filings', 'joint_hs_committees', 'pay_equity_exercises', 'preventive_withdrawals',
    'right_of_refusal_events', 'wcb_claims', 'wcb_employer_assessments', 'member_dues_issues', 'payroll_deductions',
    'customer_nps_surveys', 'customer_onboarding_milestones'
  ] LOOP
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
