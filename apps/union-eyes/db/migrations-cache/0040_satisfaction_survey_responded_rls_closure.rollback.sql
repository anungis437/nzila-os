-- 0040_satisfaction_survey_responded_rls_closure rollback: removes the policies and row security. Run only with the anonymization
-- trigger of platform 0050 removed or the table dropped.
DO $$ BEGIN
  IF to_regclass('public.satisfaction_survey_responded') IS NOT NULL THEN
    DROP POLICY IF EXISTS ue_org_isolation_select ON public.satisfaction_survey_responded;
    DROP POLICY IF EXISTS ue_org_isolation_insert ON public.satisfaction_survey_responded;
    DROP POLICY IF EXISTS ue_org_isolation_update ON public.satisfaction_survey_responded;
    DROP POLICY IF EXISTS ue_org_isolation_delete ON public.satisfaction_survey_responded;
    DROP POLICY IF EXISTS ue_system_full_access ON public.satisfaction_survey_responded;
    DROP POLICY IF EXISTS ue_system_select ON public.satisfaction_survey_responded;
    DROP POLICY IF EXISTS ue_responded_trigger_insert ON public.satisfaction_survey_responded;
    ALTER TABLE public.satisfaction_survey_responded NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.satisfaction_survey_responded DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;
