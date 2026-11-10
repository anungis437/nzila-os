-- 0059_verified_dependency_evidence_rls_closure
--
-- Forward RLS for ue_verified_dependency_evidence (platform 0085). Direct-org tenant table: reuses
-- ue_create_direct_org_rls_policy from 0010, which enables and FORCES row level security and creates the
-- union_eyes_runtime policies. This migration does not grant DML. Exact privileges come from the storage-authority
-- manifest at grant activation.

DO $$
BEGIN
  IF to_regclass('public.ue_verified_dependency_evidence') IS NULL THEN
    RAISE EXCEPTION 'RLS 0059 fail-closed: public.ue_verified_dependency_evidence does not exist.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ue_verified_dependency_evidence'
      AND column_name = 'organization_id'
      AND udt_name = 'uuid'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'RLS 0059 fail-closed: public.ue_verified_dependency_evidence organization_id is not uuid NOT NULL.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_roles r ON r.oid = c.relowner
    WHERE c.oid = 'public.ue_verified_dependency_evidence'::regclass
      AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
  ) THEN
    RAISE EXCEPTION 'RLS 0059 fail-closed: public.ue_verified_dependency_evidence is owned by a runtime role.';
  END IF;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_verified_dependency_evidence');
