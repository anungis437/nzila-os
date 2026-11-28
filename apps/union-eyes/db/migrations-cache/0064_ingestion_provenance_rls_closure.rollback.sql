-- Rollback for 0064_ingestion_provenance_rls_closure: disables RLS on the ingestion provenance relations and drops their policies.
-- Forward recovery only; confirm nothing relies on tenant isolation for these tables before rolling back.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ue_ingestion_source_manifests','ue_ingestion_batch_manifests','ue_ingestion_record_provenance','ue_imported_document_evidence'] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_select ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_insert ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_update ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_delete ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON public.%I', t);
    END IF;
  END LOOP;
END $$;
