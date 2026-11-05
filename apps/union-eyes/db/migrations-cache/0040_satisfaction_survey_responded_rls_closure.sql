-- 0040_satisfaction_survey_responded_rls_closure
--
-- FORCE RLS for satisfaction_survey_responded (platform 0050): a direct organization_id tenant table (0010's
-- ue_create_direct_org_rls_policy), narrowed to read-only for the application roles. The record that a member has answered is written
-- only by the anonymization trigger of 0050 (SECURITY DEFINER, running as the table owner): the insert policy 0010 installs is
-- replaced by one that admits an insert only from a role that is neither application role, and the update and delete policies are
-- removed. The manifest (db/rls-storage-authority/reference-latent.ts) grants SELECT only.

DO $$
BEGIN
  IF to_regprocedure('ue_create_direct_org_rls_policy(text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'RLS 0040 fail-closed: ue_create_direct_org_rls_policy() is not installed (0010 not applied).';
  END IF;
  IF to_regclass('public.satisfaction_survey_responded') IS NULL THEN
    RAISE EXCEPTION 'RLS 0040 fail-closed: public.satisfaction_survey_responded does not exist (platform 0050 not applied).';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
    WHERE c.oid = 'public.satisfaction_survey_responded'::regclass AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
  ) THEN
    RAISE EXCEPTION 'RLS 0040 fail-closed: public.satisfaction_survey_responded is owned by a runtime role.';
  END IF;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('satisfaction_survey_responded');
--> statement-breakpoint
DROP POLICY IF EXISTS ue_org_isolation_insert ON public.satisfaction_survey_responded;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_org_isolation_update ON public.satisfaction_survey_responded;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_org_isolation_delete ON public.satisfaction_survey_responded;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_full_access ON public.satisfaction_survey_responded;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_select ON public.satisfaction_survey_responded;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_responded_trigger_insert ON public.satisfaction_survey_responded;
--> statement-breakpoint
CREATE POLICY ue_system_select ON public.satisfaction_survey_responded FOR SELECT TO union_eyes_system USING (true);
--> statement-breakpoint
CREATE POLICY ue_responded_trigger_insert ON public.satisfaction_survey_responded FOR INSERT TO PUBLIC
  WITH CHECK (current_user NOT IN ('union_eyes_runtime', 'union_eyes_system'));
