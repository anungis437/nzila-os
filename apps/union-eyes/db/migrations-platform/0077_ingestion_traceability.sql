-- platform-migration:ingestion_traceability: the columns the batch ingestion (lib/ingestion/batch-ingest.ts, lib/ingestion/post-import-verification.ts, POST /api/admin/ingest) was written against and the database never had (UE-CONV-H-014).
-- grievances gains the five a re-import needs (the case's id in the source system, its content fingerprint, the source system, when it was imported and the batch that imported it) and documents gains four (source system, id in the source system, when imported, batch).
-- A re-import must find its rows again and change them, not add a second copy: one case per (organization, source system, external case id) and one document per (organization, source system, external document id), each a partial unique index that is the writer's ON CONFLICT target. A CHECK keeps the key whole: an external id always names its source system.
-- Nothing is invented: every new column is nullable and a row that was not imported keeps NULL. A document's case stays the canonical document_links row and its file a document_versions row; this adds no second link column.
-- Each column, index and constraint this migration adds is tagged, so the rollback removes exactly those, and refuses while an imported row exists (dropping the columns would lose the traceability they carry). One that already exists with the same shape is left alone and untagged; one with another type is refused.
DO $ingestion$
DECLARE
  r record;
  target regclass;
  found_type text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('grievances', 'external_case_id', 'character varying(255)'),
      ('grievances', 'import_batch_id', 'uuid'),
      ('grievances', 'import_fingerprint', 'character varying(64)'),
      ('grievances', 'imported_at', 'timestamp with time zone'),
      ('grievances', 'source_system', 'character varying(100)'),
      ('documents', 'external_document_id', 'character varying(255)'),
      ('documents', 'import_batch_id', 'uuid'),
      ('documents', 'imported_at', 'timestamp with time zone'),
      ('documents', 'source_system', 'character varying(100)')
    ) AS v(table_name, column_name, column_type)
    ORDER BY table_name, column_name
  LOOP
    target := to_regclass(format('public.%I', r.table_name));
    IF target IS NULL THEN
      RAISE EXCEPTION 'platform ingestion traceability fail-closed: public.% does not exist.', r.table_name;
    END IF;
    SELECT format_type(a.atttypid, a.atttypmod) INTO found_type
      FROM pg_attribute a WHERE a.attrelid = target AND a.attname = r.column_name AND a.attnum > 0 AND NOT a.attisdropped;
    IF found_type IS NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', r.table_name, r.column_name, r.column_type);
      EXECUTE format('COMMENT ON COLUMN public.%I.%I IS %L', r.table_name, r.column_name, 'platform-migration:ingestion_traceability:column');
    ELSIF found_type <> r.column_type THEN
      RAISE EXCEPTION 'platform ingestion traceability fail-closed: public.%.% is %, not %.', r.table_name, r.column_name, found_type, r.column_type;
    END IF;
  END LOOP;
END
$ingestion$;
--> statement-breakpoint
DO $ingestion_keys$
BEGIN
  IF to_regclass('public.ux_grievances_org_source_external_case') IS NULL THEN
    CREATE UNIQUE INDEX ux_grievances_org_source_external_case ON public.grievances (organization_id, source_system, external_case_id) WHERE external_case_id IS NOT NULL;
    COMMENT ON INDEX public.ux_grievances_org_source_external_case IS 'platform-migration:ingestion_traceability:index';
  END IF;
  IF to_regclass('public.idx_grievances_import_batch_id') IS NULL THEN
    CREATE INDEX idx_grievances_import_batch_id ON public.grievances (import_batch_id) WHERE import_batch_id IS NOT NULL;
    COMMENT ON INDEX public.idx_grievances_import_batch_id IS 'platform-migration:ingestion_traceability:index';
  END IF;
  IF to_regclass('public.ux_documents_org_source_external_document') IS NULL THEN
    CREATE UNIQUE INDEX ux_documents_org_source_external_document ON public.documents (organization_id, source_system, external_document_id) WHERE external_document_id IS NOT NULL;
    COMMENT ON INDEX public.ux_documents_org_source_external_document IS 'platform-migration:ingestion_traceability:index';
  END IF;
  IF to_regclass('public.idx_documents_import_batch_id') IS NULL THEN
    CREATE INDEX idx_documents_import_batch_id ON public.documents (import_batch_id) WHERE import_batch_id IS NOT NULL;
    COMMENT ON INDEX public.idx_documents_import_batch_id IS 'platform-migration:ingestion_traceability:index';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.grievances'::regclass AND conname = 'grievances_external_case_names_source') THEN
    ALTER TABLE public.grievances ADD CONSTRAINT grievances_external_case_names_source CHECK (external_case_id IS NULL OR source_system IS NOT NULL);
    COMMENT ON CONSTRAINT grievances_external_case_names_source ON public.grievances IS 'platform-migration:ingestion_traceability:constraint';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.documents'::regclass AND conname = 'documents_external_document_names_source') THEN
    ALTER TABLE public.documents ADD CONSTRAINT documents_external_document_names_source CHECK (external_document_id IS NULL OR source_system IS NOT NULL);
    COMMENT ON CONSTRAINT documents_external_document_names_source ON public.documents IS 'platform-migration:ingestion_traceability:constraint';
  END IF;
END
$ingestion_keys$;
