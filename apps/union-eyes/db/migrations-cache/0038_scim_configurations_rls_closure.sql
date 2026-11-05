-- 0038_scim_configurations_rls_closure
--
-- FORCE RLS for scim_configurations (platform 0048): a direct organization_id tenant table, using ue_create_direct_org_rls_policy
-- from 0010. This migration does not grant DML: exact privileges come from the storage-authority manifest
-- (db/rls-storage-authority/reference-latent.ts). The runtime role (an organization administrator, under the tenant session) reads,
-- issues and rotates its own organization's configuration; the system role authenticates the IdP's bearer token by its hash before any
-- tenant is known, and records last use.

DO $$
BEGIN
  IF to_regprocedure('ue_create_direct_org_rls_policy(text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'RLS 0038 fail-closed: ue_create_direct_org_rls_policy() is not installed (0010 not applied).';
  END IF;
  IF to_regclass('public.scim_configurations') IS NULL THEN
    RAISE EXCEPTION 'RLS 0038 fail-closed: public.scim_configurations does not exist.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scim_configurations' AND column_name = 'token_hash') THEN
    RAISE EXCEPTION 'RLS 0038 fail-closed: scim_configurations.token_hash is missing (platform 0048 not applied).';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
    WHERE c.oid = 'public.scim_configurations'::regclass AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
  ) THEN
    RAISE EXCEPTION 'RLS 0038 fail-closed: public.scim_configurations is owned by a runtime role.';
  END IF;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('scim_configurations');
