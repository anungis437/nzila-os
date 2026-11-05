-- 0053_enhanced_rbac_rls_closure
--
-- Row security for the relations platform 0075 creates for the enhanced RBAC (UE-CONV-H-010), in the shape the storage-authority manifest gives each of them:
--   * member_roles, permission_exceptions and rbac_audit_log carry organization_id uuid NOT NULL and reuse ue_create_direct_org_rls_policy from 0010: FORCE RLS, one
--     runtime policy per command, and the system-role policy. The runtime role is granted only SELECT on all three (the manifest names no runtime write: assigning a
--     role, granting an exception and writing an audit entry are privileged acts that run under the system role), so the policies for the other commands do nothing
--     until a grant exists.
--   * role_definitions is GLOBAL_REFERENCE_DATA: no tenant column, a role means the same thing in every organization, so it takes no policy. The runtime role may only
--     read it; changing the catalog is a system-role act.
-- This migration does not grant DML: exact privileges come from the storage-authority manifest at grant activation. Without these policies the catalog preflight leaves the
-- relations unclassified and runtime grant activation aborts.

DO $$
DECLARE
  t text;
BEGIN
  IF to_regprocedure('ue_create_direct_org_rls_policy(text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'RLS 0053 fail-closed: ue_create_direct_org_rls_policy() is not installed (0010 not applied).';
  END IF;
  IF to_regrole('union_eyes_system') IS NULL THEN
    RAISE EXCEPTION 'RLS 0053 fail-closed: role union_eyes_system does not exist.';
  END IF;
  FOREACH t IN ARRAY ARRAY['member_roles', 'permission_exceptions', 'rbac_audit_log'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'RLS 0053 fail-closed: public.% does not exist (platform 0075 not applied).', t;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id' AND udt_name = 'uuid' AND is_nullable = 'NO'
    ) THEN
      RAISE EXCEPTION 'RLS 0053 fail-closed: public.% organization_id is not uuid NOT NULL.', t;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
      WHERE c.oid = ('public.' || t)::regclass AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
    ) THEN
      RAISE EXCEPTION 'RLS 0053 fail-closed: public.% is owned by a runtime role.', t;
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('member_roles');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('permission_exceptions');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('rbac_audit_log');
