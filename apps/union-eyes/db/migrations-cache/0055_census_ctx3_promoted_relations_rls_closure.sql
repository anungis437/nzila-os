-- 0055_census_ctx3_promoted_relations_rls_closure
--
-- Row security for four relations the tenant-context census (CTX-3) found live code for, in the shape the storage-authority manifest now gives each of them:
--   * job_classifications carries organization_id uuid NOT NULL (Django unions app): TENANT_RLS_REQUIRED, ue_create_direct_org_rls_policy from 0010 (FORCE RLS, one
--     runtime policy per command, the system-role policy). The administrator members page lists, creates and updates classifications inside the caller's organization.
--   * committee_memberships has no organization column; committee_id (uuid NOT NULL, foreign key to committees from platform 0068) owns it and committees carries
--     organization_id uuid NOT NULL: PARENT_OWNED_RLS_REQUIRED, ue_create_parent_owned_rls_policy_v2 from 0012. The committee workspace reads the caller's own active
--     membership row to decide whether the caller may read a committee.
--   * integration_sync_logs has no organization column; integration_id (uuid NOT NULL, foreign key to api_integrations) owns it and api_integrations carries
--     organization_id uuid NOT NULL: PARENT_OWNED_RLS_REQUIRED, the same helper. Deleting an integration first checks whether synchronization history exists.
--   * shopify_config is SYSTEM_ONLY: FORCE RLS with a single system-role policy and no runtime policy (the 0036, 0043, 0052 and 0054 shape). Its secret-reference
--     columns are credential-adjacent, so the tenant runtime role never gets a policy; the Shopify webhook resolves a shop's organization as the system role.
-- This migration does not grant DML: exact privileges come from the storage-authority manifest at grant activation (runtime SELECT, INSERT and UPDATE on
-- job_classifications; runtime SELECT on the two parent-owned relations; system SELECT on shopify_config; no role may delete). Without these policies the catalog
-- preflight leaves the relations unclassified and runtime grant activation aborts.

DO $$
DECLARE
  t text;
  spec text[];
BEGIN
  IF to_regprocedure('ue_create_direct_org_rls_policy(text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'RLS 0055 fail-closed: ue_create_direct_org_rls_policy() is not installed (0010 not applied).';
  END IF;
  IF to_regprocedure('ue_create_parent_owned_rls_policy_v2(text,text,text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'RLS 0055 fail-closed: ue_create_parent_owned_rls_policy_v2() is not installed (0012 not applied).';
  END IF;
  IF to_regrole('union_eyes_system') IS NULL THEN
    RAISE EXCEPTION 'RLS 0055 fail-closed: role union_eyes_system does not exist.';
  END IF;
  FOREACH t IN ARRAY ARRAY['job_classifications', 'committee_memberships', 'committees', 'integration_sync_logs', 'api_integrations', 'shopify_config'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'RLS 0055 fail-closed: public.% does not exist.', t;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
      WHERE c.oid = ('public.' || t)::regclass AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
    ) THEN
      RAISE EXCEPTION 'RLS 0055 fail-closed: public.% is owned by a runtime role.', t;
    END IF;
  END LOOP;
  -- table, column that must be uuid NOT NULL
  FOREACH spec SLICE 1 IN ARRAY ARRAY[
    ARRAY['job_classifications', 'organization_id'],
    ARRAY['committees', 'organization_id'],
    ARRAY['committee_memberships', 'committee_id'],
    ARRAY['api_integrations', 'organization_id'],
    ARRAY['integration_sync_logs', 'integration_id']
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = spec[1] AND column_name = spec[2] AND udt_name = 'uuid' AND is_nullable = 'NO'
    ) THEN
      RAISE EXCEPTION 'RLS 0055 fail-closed: public.%.% is not uuid NOT NULL.', spec[1], spec[2];
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('job_classifications');
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy_v2('committee_memberships', 'committee_id', 'committees', 'organization_id', FALSE);
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy_v2('integration_sync_logs', 'integration_id', 'api_integrations', 'organization_id', FALSE);
--> statement-breakpoint
ALTER TABLE public.shopify_config ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.shopify_config FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_full_access ON public.shopify_config;
--> statement-breakpoint
CREATE POLICY ue_system_full_access ON public.shopify_config FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
