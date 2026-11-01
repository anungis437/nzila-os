-- 0037_ml_prediction_feedback_rls_closure
--
-- FORCE RLS for ml_prediction_feedback (platform 0047): a direct organization_id tenant table, using ue_create_direct_org_rls_policy
-- from 0010. This migration does not grant DML: exact privileges come from the storage-authority manifest
-- (db/rls-storage-authority/analytics-ai.ts), which grants the runtime role SELECT and INSERT only (a recorded outcome is never
-- changed or removed by the application).

DO $$
BEGIN
  IF to_regprocedure('ue_create_direct_org_rls_policy(text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'RLS 0037 fail-closed: ue_create_direct_org_rls_policy() is not installed (0010 not applied).';
  END IF;
  IF to_regclass('public.ml_prediction_feedback') IS NULL THEN
    RAISE EXCEPTION 'RLS 0037 fail-closed: public.ml_prediction_feedback does not exist (platform 0047 not applied).';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
    WHERE c.oid = 'public.ml_prediction_feedback'::regclass AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
  ) THEN
    RAISE EXCEPTION 'RLS 0037 fail-closed: public.ml_prediction_feedback is owned by a runtime role.';
  END IF;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ml_prediction_feedback');
