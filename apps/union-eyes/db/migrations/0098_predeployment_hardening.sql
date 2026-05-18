-- =============================================================================
-- Migration 0070: Pre-deployment Hardening
-- =============================================================================
-- Addresses all critical blockers and high-risk findings from the
-- PREDEPLOYMENT_AUDIT_2026-04-09.md
--
-- Changes:
--   1. claims.organization_id: SET NOT NULL + FK to organizations
--   2. claims: Add 6 performance indexes
--   3. claims: Add idempotency_hash column (unique)
--   4. documents: Add 5 performance indexes
--   5. case_documents: New join table with FKs + CASCADE
--   6. defensibility_packs.case_id: Add FK to claims
--   7. pack_download_log.pack_id: Add FK to defensibility_packs
--   8. grievance workflow tables: Add ON DELETE CASCADE to claim_id FKs
-- =============================================================================

BEGIN;

-- ─── 1. Claims: organization_id NOT NULL + FK ───────────────────────────────

-- First backfill any NULLs (should not exist in production)
-- UPDATE claims SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;

ALTER TABLE claims
  ALTER COLUMN organization_id SET NOT NULL;

-- Add FK only if it doesn't already exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'claims_organization_id_organizations_id_fk'
  ) THEN
    ALTER TABLE claims
      ADD CONSTRAINT claims_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES organizations(id);
  END IF;
END $$;

-- ─── 2. Claims: Performance indexes ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_claims_org ON claims(organization_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_member ON claims(member_id);
CREATE INDEX IF NOT EXISTS idx_claims_created ON claims(created_at);
CREATE INDEX IF NOT EXISTS idx_claims_type ON claims(claim_type);
CREATE INDEX IF NOT EXISTS idx_claims_priority ON claims(priority);

-- ─── 3. Claims: Idempotency hash ────────────────────────────────────────────

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS idempotency_hash VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_idempotency_hash
  ON claims(idempotency_hash) WHERE idempotency_hash IS NOT NULL;

-- ─── 4. Documents: Performance indexes ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);

-- ─── 5. Case Documents: Join table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS case_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  linked_by VARCHAR(255) NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  link_type VARCHAR(20) NOT NULL DEFAULT 'attachment',
  notes TEXT,
  CONSTRAINT chk_case_documents_link_type CHECK (link_type IN ('attachment', 'evidence', 'correspondence', 'settlement'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_case_documents_claim_doc
  ON case_documents(claim_id, document_id);
CREATE INDEX IF NOT EXISTS idx_case_documents_claim ON case_documents(claim_id);
CREATE INDEX IF NOT EXISTS idx_case_documents_document ON case_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_case_documents_org ON case_documents(organization_id);

-- ─── 6. Defensibility Packs: Add FK to claims ──────────────────────────────

-- Clean orphan case_id values before adding FK constraint
DELETE FROM pack_download_log WHERE pack_id IN (
  SELECT pack_id FROM defensibility_packs WHERE case_id NOT IN (SELECT claim_id FROM claims)
);
DELETE FROM pack_verification_log WHERE pack_id IN (
  SELECT pack_id FROM defensibility_packs WHERE case_id NOT IN (SELECT claim_id FROM claims)
);
DELETE FROM defensibility_packs WHERE case_id NOT IN (SELECT claim_id FROM claims);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'defensibility_packs_case_id_claims_claim_id_fk'
  ) THEN
    ALTER TABLE defensibility_packs
      ADD CONSTRAINT defensibility_packs_case_id_claims_claim_id_fk
      FOREIGN KEY (case_id) REFERENCES claims(claim_id);
  END IF;
END $$;

-- ─── 7. Pack Download Log: Add FK to defensibility_packs ────────────────────

-- Clean orphan pack_id values before adding FK constraint
DELETE FROM pack_download_log WHERE pack_id NOT IN (SELECT pack_id FROM defensibility_packs);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pack_download_log_pack_id_defensibility_packs_pack_id_fk'
  ) THEN
    ALTER TABLE pack_download_log
      ADD CONSTRAINT pack_download_log_pack_id_defensibility_packs_pack_id_fk
      FOREIGN KEY (pack_id) REFERENCES defensibility_packs(pack_id);
  END IF;
END $$;

-- ─── 8. Grievance Workflow Tables: Add ON DELETE CASCADE ────────────────────
-- Drop existing FK constraints and re-add with CASCADE

-- grievance_transitions
DO $$ BEGIN
  -- Find and drop the existing FK, then re-add with CASCADE
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'grievance_transitions'::regclass 
    AND confrelid = 'claims'::regclass
    AND contype = 'f'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE grievance_transitions DROP CONSTRAINT ' || conname
      FROM pg_constraint 
      WHERE conrelid = 'grievance_transitions'::regclass 
      AND confrelid = 'claims'::regclass
      AND contype = 'f'
      LIMIT 1
    );
  END IF;
  ALTER TABLE grievance_transitions
    ADD CONSTRAINT grievance_transitions_claim_id_claims_fk
    FOREIGN KEY (claim_id) REFERENCES claims(claim_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- grievance_assignments
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'grievance_assignments'::regclass 
    AND confrelid = 'claims'::regclass
    AND contype = 'f'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE grievance_assignments DROP CONSTRAINT ' || conname
      FROM pg_constraint 
      WHERE conrelid = 'grievance_assignments'::regclass 
      AND confrelid = 'claims'::regclass
      AND contype = 'f'
      LIMIT 1
    );
  END IF;
  ALTER TABLE grievance_assignments
    ADD CONSTRAINT grievance_assignments_claim_id_claims_fk
    FOREIGN KEY (claim_id) REFERENCES claims(claim_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- grievance_documents
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'grievance_documents'::regclass 
    AND confrelid = 'claims'::regclass
    AND contype = 'f'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE grievance_documents DROP CONSTRAINT ' || conname
      FROM pg_constraint 
      WHERE conrelid = 'grievance_documents'::regclass 
      AND confrelid = 'claims'::regclass
      AND contype = 'f'
      LIMIT 1
    );
  END IF;
  ALTER TABLE grievance_documents
    ADD CONSTRAINT grievance_documents_claim_id_claims_fk
    FOREIGN KEY (claim_id) REFERENCES claims(claim_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- grievance_deadlines — SKIPPED
-- This table uses grievance_id→grievances.id (not claim_id→claims.claim_id).
-- The existing FK already has correct lifecycle management.
-- The Drizzle schema references claim_id but the actual DB column is grievance_id.

-- grievance_settlements
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'grievance_settlements'::regclass 
    AND confrelid = 'claims'::regclass
    AND contype = 'f'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE grievance_settlements DROP CONSTRAINT ' || conname
      FROM pg_constraint 
      WHERE conrelid = 'grievance_settlements'::regclass 
      AND confrelid = 'claims'::regclass
      AND contype = 'f'
      LIMIT 1
    );
  END IF;
  ALTER TABLE grievance_settlements
    ADD CONSTRAINT grievance_settlements_claim_id_claims_fk
    FOREIGN KEY (claim_id) REFERENCES claims(claim_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- grievance_communications
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'grievance_communications'::regclass 
    AND confrelid = 'claims'::regclass
    AND contype = 'f'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE grievance_communications DROP CONSTRAINT ' || conname
      FROM pg_constraint 
      WHERE conrelid = 'grievance_communications'::regclass 
      AND confrelid = 'claims'::regclass
      AND contype = 'f'
      LIMIT 1
    );
  END IF;
  ALTER TABLE grievance_communications
    ADD CONSTRAINT grievance_communications_claim_id_claims_fk
    FOREIGN KEY (claim_id) REFERENCES claims(claim_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
