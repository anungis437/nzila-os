-- Rollback for 0091_ingestion_provenance_and_manifests: forward recovery only. Refuses while any batch manifest exists,
-- because these rows are the only record of what an import was expected to hold, what it received and how it was mapped.
DO $$
BEGIN
  IF to_regclass('public.ue_ingestion_batch_manifests') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.ue_ingestion_batch_manifests) THEN
    RAISE EXCEPTION 'Rollback 0091 refused: ingestion batch manifests exist.';
  END IF;
END $$;
DROP TABLE IF EXISTS public.ue_imported_document_evidence;
DROP TABLE IF EXISTS public.ue_ingestion_record_provenance;
DROP TABLE IF EXISTS public.ue_ingestion_batch_manifests;
DROP TABLE IF EXISTS public.ue_ingestion_source_manifests;
DROP FUNCTION IF EXISTS public.ue_imported_document_evidence_guard();
DROP FUNCTION IF EXISTS public.ue_ingestion_batch_manifest_guard();
DROP FUNCTION IF EXISTS public.ue_ingestion_immutable_guard();
