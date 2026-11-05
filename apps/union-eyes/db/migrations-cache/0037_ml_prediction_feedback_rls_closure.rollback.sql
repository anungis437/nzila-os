-- 0037_ml_prediction_feedback_rls_closure rollback: removes the policies and row security. Run only with the feedback route disabled.
DO $$ BEGIN
  IF to_regclass('public.ml_prediction_feedback') IS NOT NULL THEN
    DROP POLICY IF EXISTS ue_org_isolation_select ON public.ml_prediction_feedback;
    DROP POLICY IF EXISTS ue_org_isolation_insert ON public.ml_prediction_feedback;
    DROP POLICY IF EXISTS ue_org_isolation_update ON public.ml_prediction_feedback;
    DROP POLICY IF EXISTS ue_org_isolation_delete ON public.ml_prediction_feedback;
    DROP POLICY IF EXISTS ue_system_full_access ON public.ml_prediction_feedback;
    ALTER TABLE public.ml_prediction_feedback NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.ml_prediction_feedback DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;
