-- 0060_graph_node_alias_rls_closure
--
-- Forward RLS for ue_graph_node_alias (platform 0086). Direct-org tenant table: reuses
-- ue_create_direct_org_rls_policy from 0010, which enables and FORCES row level security and creates the
-- union_eyes_runtime policies. This migration does not grant DML. Exact privileges come from the
-- storage-authority manifest at grant activation. ue_verified_dependency_evidence's own RLS (0059) already
-- covers its new columns (source_fingerprint, evidence_reference_type, evidence_document_id) - an ALTER TABLE
-- ADD COLUMN does not require new policies.

DO $$
BEGIN
  IF to_regclass('public.ue_graph_node_alias') IS NULL THEN
    RAISE EXCEPTION 'RLS 0060 fail-closed: public.ue_graph_node_alias does not exist.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ue_graph_node_alias'
      AND column_name = 'organization_id'
      AND udt_name = 'uuid'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'RLS 0060 fail-closed: public.ue_graph_node_alias organization_id is not uuid NOT NULL.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_roles r ON r.oid = c.relowner
    WHERE c.oid = 'public.ue_graph_node_alias'::regclass
      AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
  ) THEN
    RAISE EXCEPTION 'RLS 0060 fail-closed: public.ue_graph_node_alias is owned by a runtime role.';
  END IF;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_graph_node_alias');
