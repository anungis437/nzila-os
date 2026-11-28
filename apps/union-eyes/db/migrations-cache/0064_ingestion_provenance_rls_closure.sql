-- 0064_ingestion_provenance_rls_closure
--
-- Forward RLS for the ingestion provenance relations (platform 0091). Each is a direct-org tenant table
-- (organization_id uuid NOT NULL): reuses ue_create_direct_org_rls_policy from 0010, which enables and FORCES row level
-- security and creates the union_eyes_runtime policies. This migration does not grant DML. Exact privileges come from
-- the storage-authority manifest at grant activation.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ue_ingestion_source_manifests','ue_ingestion_batch_manifests','ue_ingestion_record_provenance','ue_imported_document_evidence'] LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE EXCEPTION 'RLS 0064 fail-closed: public.% does not exist.', t;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id'
        AND udt_name = 'uuid' AND is_nullable = 'NO'
    ) THEN
      RAISE EXCEPTION 'RLS 0064 fail-closed: public.% organization_id is not uuid NOT NULL.', t;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
      WHERE c.oid = format('public.%I', t)::regclass AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
    ) THEN
      RAISE EXCEPTION 'RLS 0064 fail-closed: public.% is owned by a runtime role.', t;
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_ingestion_source_manifests ue_ingestion_batch_manifests ue_ingestion_record_provenance ue_imported_document_evidence');
