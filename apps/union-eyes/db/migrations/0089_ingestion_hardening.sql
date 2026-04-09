-- Migration: 0089_ingestion_hardening.sql
-- Purpose: Schema additions for real-world data ingestion hardening (CUPE pilot)
-- Sections: Idempotency, traceability, batch safety, timeline integrity, entity links

BEGIN;

-- ─── §1 Strict Idempotency ─────────────────────────────────────────────────

-- External case ID for dedup across imports (per org)
ALTER TABLE grievances
  ADD COLUMN IF NOT EXISTS external_case_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS import_fingerprint VARCHAR(64);

-- Unique constraint: one external case per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_grievances_external_case_org
  ON grievances (organization_id, external_case_id)
  WHERE external_case_id IS NOT NULL;

-- Unique fingerprint constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_grievances_import_fingerprint
  ON grievances (import_fingerprint)
  WHERE import_fingerprint IS NOT NULL;

-- Claims: external_case_id for dedup
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS external_case_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS import_fingerprint VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_external_case_org
  ON claims (organization_id, external_case_id)
  WHERE external_case_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_import_fingerprint
  ON claims (import_fingerprint)
  WHERE import_fingerprint IS NOT NULL;

-- ─── §2 Migration Traceability ─────────────────────────────────────────────

-- Traceability columns on grievances
ALTER TABLE grievances
  ADD COLUMN IF NOT EXISTS source_system VARCHAR(100),
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS import_batch_id UUID;

-- Traceability columns on claims
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS source_system VARCHAR(100),
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS import_batch_id UUID;

-- Traceability columns on documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS source_system VARCHAR(100),
  ADD COLUMN IF NOT EXISTS external_document_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS import_batch_id UUID;

-- ─── §3 Batch Ingestion Tracking ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ingestion_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  source_system VARCHAR(100) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','processing','completed','failed','partial')),
  total_records INTEGER NOT NULL DEFAULT 0,
  processed     INTEGER NOT NULL DEFAULT 0,
  succeeded     INTEGER NOT NULL DEFAULT 0,
  failed        INTEGER NOT NULL DEFAULT 0,
  skipped       INTEGER NOT NULL DEFAULT 0,
  error_summary JSONB DEFAULT '[]'::jsonb,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_by    VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata      JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ingestion_batches_org ON ingestion_batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_batches_status ON ingestion_batches(status);

CREATE TABLE IF NOT EXISTS ingestion_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      UUID NOT NULL REFERENCES ingestion_batches(id) ON DELETE CASCADE,
  record_index  INTEGER NOT NULL,
  record_type   VARCHAR(50) NOT NULL, -- 'grievance', 'claim', 'document', 'member'
  external_id   VARCHAR(255),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','processing','succeeded','failed','skipped')),
  entity_id     UUID,  -- PK of created/updated row
  error_message TEXT,
  error_details JSONB,
  fingerprint   VARCHAR(64),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ingestion_records_batch ON ingestion_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_records_status ON ingestion_records(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_records_ext_id ON ingestion_records(external_id);

-- ─── §5 Timeline Event Dedup ──────────────────────────────────────────────

-- Add content_hash to grievance timeline entries for dedup
-- (Timeline is JSONB array on grievances, but we add a dedicated events table
--  for hardened imports where dedup + ordering is critical)

CREATE TABLE IF NOT EXISTS grievance_timeline_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grievance_id   UUID NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  event_type     VARCHAR(100) NOT NULL,
  event_date     TIMESTAMPTZ NOT NULL,
  actor          VARCHAR(255),
  description    TEXT,
  content_hash   VARCHAR(64) NOT NULL,
  source_system  VARCHAR(100),
  import_batch_id UUID,
  sequence_number INTEGER NOT NULL DEFAULT 0,
  metadata       JSONB DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dedup: same grievance + timestamp + event_type + content_hash = skip
CREATE UNIQUE INDEX IF NOT EXISTS idx_timeline_events_dedup
  ON grievance_timeline_events (grievance_id, event_date, event_type, content_hash);

CREATE INDEX IF NOT EXISTS idx_timeline_events_grievance ON grievance_timeline_events(grievance_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_org ON grievance_timeline_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_date ON grievance_timeline_events(event_date);

-- ─── §6 Document Normalization ────────────────────────────────────────────

-- Document type enum for normalized classification
DO $$ BEGIN
  CREATE TYPE document_category_type AS ENUM (
    'grievance', 'contract', 'evidence', 'correspondence', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add normalized fields to documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS linked_case_id UUID,
  ADD COLUMN IF NOT EXISTS is_orphan BOOLEAN DEFAULT false;

-- ─── §8 Entity Link Integrity ─────────────────────────────────────────────

-- Ensure org boundary validation index
CREATE INDEX IF NOT EXISTS idx_case_documents_org_claim
  ON case_documents(organization_id, claim_id);

-- ─── §10 Performance Safety ───────────────────────────────────────────────

-- Composite indexes for batch lookups
CREATE INDEX IF NOT EXISTS idx_grievances_org_external
  ON grievances(organization_id, external_case_id)
  WHERE external_case_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_grievances_import_batch
  ON grievances(import_batch_id)
  WHERE import_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_claims_import_batch
  ON claims(import_batch_id)
  WHERE import_batch_id IS NOT NULL;

COMMIT;
