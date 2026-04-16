-- Rollback: Governed Case Access and Document Controls
-- Rollback for: 070_governed_case_access_documents.sql
-- Created: 2026-04-16

BEGIN;

DROP INDEX IF EXISTS idx_document_access_grants_status;

DROP INDEX IF EXISTS idx_document_search_index_org;
DROP INDEX IF EXISTS idx_document_search_index_document;
DROP INDEX IF EXISTS idx_document_links_entity;
DROP INDEX IF EXISTS idx_document_links_document;
DROP INDEX IF EXISTS idx_document_links_unique;
DROP INDEX IF EXISTS idx_document_versions_org;
DROP INDEX IF EXISTS idx_document_versions_document;
DROP INDEX IF EXISTS idx_document_versions_unique;
DROP INDEX IF EXISTS idx_documents_document_type;
DROP INDEX IF EXISTS idx_documents_status;
DROP INDEX IF EXISTS idx_documents_privacy_label;

ALTER TABLE document_access_grants
  DROP COLUMN IF EXISTS status;

DROP TABLE IF EXISTS document_search_index;
DROP TABLE IF EXISTS document_access_grants;
DROP TABLE IF EXISTS document_links;
DROP TABLE IF EXISTS document_versions;

DROP TABLE IF EXISTS grievance_case_access_assignments;

ALTER TABLE documents
  DROP COLUMN IF EXISTS disciplinary_sensitive,
  DROP COLUMN IF EXISTS medical_sensitive,
  DROP COLUMN IF EXISTS member_pii,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS contains_legal_privilege,
  DROP COLUMN IF EXISTS contains_medical_sensitive,
  DROP COLUMN IF EXISTS contains_pii,
  DROP COLUMN IF EXISTS privacy_label,
  DROP COLUMN IF EXISTS document_type,
  DROP COLUMN IF EXISTS filename,
  DROP COLUMN IF EXISTS title;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_grant_status') THEN
    DROP TYPE document_grant_status;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_linked_entity_type') THEN
    DROP TYPE document_linked_entity_type;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_record_status') THEN
    DROP TYPE document_record_status;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_privacy_label') THEN
    DROP TYPE document_privacy_label;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'case_access_status') THEN
    DROP TYPE case_access_status;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'case_access_role') THEN
    DROP TYPE case_access_role;
  END IF;
END $$;

COMMIT;
