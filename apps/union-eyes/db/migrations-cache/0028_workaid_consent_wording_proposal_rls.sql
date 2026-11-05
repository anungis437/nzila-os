-- 0028_workaid_consent_wording_proposal_rls
--
-- FORCE RLS for the consent-wording proposal relation created by platform 0036.
-- This migration does not grant DML and does not insert wording.

DO $$
BEGIN
  IF to_regprocedure('ue_create_direct_org_rls_policy(text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'RLS 0028 fail-closed: ue_create_direct_org_rls_policy() is not installed.';
  END IF;
  IF to_regclass('public.ue_authority_workaid_consent_text_proposals') IS NULL THEN
    RAISE EXCEPTION 'RLS 0028 fail-closed: public.ue_authority_workaid_consent_text_proposals does not exist.';
  END IF;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_authority_workaid_consent_text_proposals');
