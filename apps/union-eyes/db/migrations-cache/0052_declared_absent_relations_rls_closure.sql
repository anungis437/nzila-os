-- 0052_declared_absent_relations_rls_closure
--
-- Row security for the relations platform 0061 creates, in the shape the storage-authority manifest gives each of them:
--   * ten tenant tables carry organization_id uuid NOT NULL and reuse ue_create_direct_org_rls_policy from 0010: FORCE RLS, one runtime
--     policy per command, and the system-role policy. The runtime role is granted only what the manifest names (member_dues_issues:
--     SELECT and INSERT; payroll_deductions: SELECT), so the policies for the other commands do nothing until a grant exists.
--   * two customer-success tables are SYSTEM_ONLY: FORCE RLS with a single system-role policy and no runtime policy (the 0036 and 0043 shape).
--   * the cba_intel_* relations are GLOBAL_REFERENCE_DATA or LATENT_UNREACHABLE: the CBA intelligence domain has no tenant column by design
--     (manifest rounds 43 and 51, which also record the accepted risk of steward-level writes to shared content), so they take no policy.
-- This migration does not grant DML: exact privileges come from the storage-authority manifest at grant activation. Without these policies the
-- catalog preflight leaves the relations unclassified and runtime grant activation aborts.

DO $$
DECLARE
  t text;
BEGIN
  IF to_regprocedure('ue_create_direct_org_rls_policy(text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'RLS 0052 fail-closed: ue_create_direct_org_rls_policy() is not installed (0010 not applied).';
  END IF;
  IF to_regrole('union_eyes_system') IS NULL THEN
    RAISE EXCEPTION 'RLS 0052 fail-closed: role union_eyes_system does not exist.';
  END IF;
  FOREACH t IN ARRAY ARRAY[
    'anti_scab_violations', 'cnesst_filings', 'joint_hs_committees', 'pay_equity_exercises', 'preventive_withdrawals',
    'right_of_refusal_events', 'wcb_claims', 'wcb_employer_assessments', 'member_dues_issues', 'payroll_deductions',
    'customer_nps_surveys', 'customer_onboarding_milestones'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'RLS 0052 fail-closed: public.% does not exist (platform 0061 not applied).', t;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id' AND udt_name = 'uuid' AND is_nullable = 'NO'
    ) THEN
      RAISE EXCEPTION 'RLS 0052 fail-closed: public.% organization_id is not uuid NOT NULL.', t;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
      WHERE c.oid = ('public.' || t)::regclass AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
    ) THEN
      RAISE EXCEPTION 'RLS 0052 fail-closed: public.% is owned by a runtime role.', t;
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('anti_scab_violations');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('cnesst_filings');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('joint_hs_committees');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('pay_equity_exercises');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('preventive_withdrawals');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('right_of_refusal_events');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('wcb_claims');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('wcb_employer_assessments');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('member_dues_issues');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('payroll_deductions');
--> statement-breakpoint
ALTER TABLE public.customer_nps_surveys ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.customer_nps_surveys FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_full_access ON public.customer_nps_surveys;
--> statement-breakpoint
CREATE POLICY ue_system_full_access ON public.customer_nps_surveys FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE public.customer_onboarding_milestones ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.customer_onboarding_milestones FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_full_access ON public.customer_onboarding_milestones;
--> statement-breakpoint
CREATE POLICY ue_system_full_access ON public.customer_onboarding_milestones FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
