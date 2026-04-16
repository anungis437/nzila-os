-- Migration: Governed Case Access and Document Controls
-- Created: 2026-04-16
-- Description:
--   - Adds secondary case access assignment table for grievance collaboration
--   - Adds governed document access-grant status enum + column
--   - Ensures required indexes for access and label-driven filtering

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Enum: document_grant_status
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_grant_status') THEN
    CREATE TYPE document_grant_status AS ENUM ('active', 'revoked', 'expired');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_privacy_label') THEN
    CREATE TYPE document_privacy_label AS ENUM (
      'public_internal',
      'team_confidential',
      'lro_confidential',
      'privileged',
      'case_restricted',
      'highly_sensitive'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_record_status') THEN
    CREATE TYPE document_record_status AS ENUM ('active', 'archived', 'deleted');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_linked_entity_type') THEN
    CREATE TYPE document_linked_entity_type AS ENUM (
      'case',
      'grievance',
      'member',
      'policy_library',
      'template_library',
      'collective_agreement',
      'other'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'case_access_role') THEN
    CREATE TYPE case_access_role AS ENUM ('secondary_lro', 'reviewer', 'read_only');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'case_access_status') THEN
    CREATE TYPE case_access_status AS ENUM ('active', 'revoked', 'expired');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Table: documents updates (governance fields)
-- ---------------------------------------------------------------------------
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS filename TEXT,
  ADD COLUMN IF NOT EXISTS document_type TEXT,
  ADD COLUMN IF NOT EXISTS privacy_label document_privacy_label NOT NULL DEFAULT 'team_confidential',
  ADD COLUMN IF NOT EXISTS contains_pii BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contains_medical_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contains_legal_privilege BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS status document_record_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS member_pii BOOLEAN,
  ADD COLUMN IF NOT EXISTS medical_sensitive BOOLEAN,
  ADD COLUMN IF NOT EXISTS disciplinary_sensitive BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_documents_privacy_label
  ON documents(privacy_label);
CREATE INDEX IF NOT EXISTS idx_documents_status
  ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_document_type
  ON documents(document_type);

-- ---------------------------------------------------------------------------
-- Table: document_versions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_versions_unique
  ON document_versions(document_id, version_no);
CREATE INDEX IF NOT EXISTS idx_document_versions_document
  ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_org
  ON document_versions(organization_id);

-- ---------------------------------------------------------------------------
-- Table: document_links
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  linked_entity_type document_linked_entity_type NOT NULL,
  linked_entity_id UUID NOT NULL,
  linked_by TEXT NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_links_unique
  ON document_links(document_id, linked_entity_type, linked_entity_id);
CREATE INDEX IF NOT EXISTS idx_document_links_document
  ON document_links(document_id);
CREATE INDEX IF NOT EXISTS idx_document_links_entity
  ON document_links(linked_entity_type, linked_entity_id);

-- ---------------------------------------------------------------------------
-- Table: document_access_grants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  granted_by UUID NOT NULL,
  status document_grant_status NOT NULL DEFAULT 'active',
  can_view BOOLEAN NOT NULL DEFAULT TRUE,
  can_download BOOLEAN NOT NULL DEFAULT FALSE,
  can_share BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_access_grants_document
  ON document_access_grants(document_id);
CREATE INDEX IF NOT EXISTS idx_document_access_grants_user
  ON document_access_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_document_access_grants_org
  ON document_access_grants(organization_id);

-- ---------------------------------------------------------------------------
-- Table: document_search_index
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_search_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  title TEXT,
  filename TEXT,
  full_text TEXT,
  tags TEXT[],
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_search_index_document
  ON document_search_index(document_id);
CREATE INDEX IF NOT EXISTS idx_document_search_index_org
  ON document_search_index(organization_id);

-- ---------------------------------------------------------------------------
-- Table: grievance_case_access_assignments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grievance_case_access_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  grievance_id UUID NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  access_role case_access_role NOT NULL DEFAULT 'secondary_lro',
  granted_by UUID NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  can_comment BOOLEAN NOT NULL DEFAULT TRUE,
  can_upload_documents BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit_case_notes BOOLEAN NOT NULL DEFAULT FALSE,
  can_draft_actions BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_private_documents BOOLEAN NOT NULL DEFAULT FALSE,
  status case_access_status NOT NULL DEFAULT 'active',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_access_grievance
  ON grievance_case_access_assignments(grievance_id);
CREATE INDEX IF NOT EXISTS idx_case_access_user
  ON grievance_case_access_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_case_access_org
  ON grievance_case_access_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_case_access_status
  ON grievance_case_access_assignments(status);
CREATE INDEX IF NOT EXISTS idx_case_access_expires
  ON grievance_case_access_assignments(expires_at);

-- ---------------------------------------------------------------------------
-- Table: document_access_grants updates
-- ---------------------------------------------------------------------------
ALTER TABLE document_access_grants
  ADD COLUMN IF NOT EXISTS status document_grant_status NOT NULL DEFAULT 'active';

-- Backfill status from revocation/expiry markers.
UPDATE document_access_grants
SET status = CASE
  WHEN revoked_at IS NOT NULL THEN 'revoked'::document_grant_status
  WHEN expires_at IS NOT NULL AND expires_at <= NOW() THEN 'expired'::document_grant_status
  ELSE 'active'::document_grant_status
END;

CREATE INDEX IF NOT EXISTS idx_document_access_grants_status
  ON document_access_grants(status);

COMMIT;
