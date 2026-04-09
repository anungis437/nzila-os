-- Migration 0080: Audit Remediation
-- Adds columns and indexes required by the Case Ingestion + FSM + Document Integrity audit.

BEGIN;

-- 1. grievance_transitions: optimistic locking version column
ALTER TABLE grievance_transitions
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- 2. documents: checksum for upload integrity verification
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS checksum TEXT;

-- 3. documents: index on deleted_at for soft-delete queries
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents (deleted_at);

-- 4. case_documents: immutability flag for evidence-linked documents
ALTER TABLE case_documents
  ADD COLUMN IF NOT EXISTS is_immutable BOOLEAN DEFAULT FALSE;

-- 5. member_documents: organization scoping
ALTER TABLE member_documents
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_member_documents_org ON member_documents (organization_id);
CREATE INDEX IF NOT EXISTS idx_member_documents_user ON member_documents (user_id);

COMMIT;
