-- ===========================================================================
-- Migration: Correspondence Pipeline
-- Date: 2026-07-14
-- Description: Creates tables for the in-platform correspondence workflow
--   (draft → review → sign → dispatch) including user signature profiles,
--   correspondence records, recipients, and audit trail.
-- ===========================================================================

BEGIN;

-- ── Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE correspondence_status AS ENUM (
    'draft', 'pending_review', 'approved', 'signed',
    'dispatched', 'delivered', 'returned', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE correspondence_type AS ENUM (
    'letter', 'notice', 'memo', 'demand', 'response',
    'proposal', 'agreement', 'report', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE correspondence_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE signature_source AS ENUM ('drawn', 'uploaded', 'typed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE correspondence_audit_event AS ENUM (
    'created', 'edited', 'submitted_for_review', 'review_requested',
    'approved', 'revision_requested', 'signed', 'signature_affixed',
    'dispatched', 'delivered', 'returned', 'cancelled',
    'recipient_added', 'recipient_removed', 'attachment_added',
    'attachment_removed', 'template_applied', 'reassigned', 'viewed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── User Signatures ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_signatures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id       TEXT NOT NULL,
  display_name  VARCHAR(255) NOT NULL,
  display_title VARCHAR(255),
  source        signature_source NOT NULL DEFAULT 'drawn',
  image_url     TEXT NOT NULL,
  image_hash    VARCHAR(64) NOT NULL,
  is_default    BOOLEAN NOT NULL DEFAULT TRUE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_signatures_user ON user_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_user_signatures_org  ON user_signatures(organization_id);

-- ── Correspondence ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS correspondence (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id),
  reference_number    VARCHAR(50),
  subject             VARCHAR(500) NOT NULL,
  body                TEXT NOT NULL,
  type                correspondence_type NOT NULL DEFAULT 'letter',
  priority            correspondence_priority NOT NULL DEFAULT 'normal',
  template_id         UUID,
  template_variables  JSONB,
  status              correspondence_status NOT NULL DEFAULT 'draft',
  drafted_by          TEXT NOT NULL,
  assigned_signer_id  TEXT,
  approved_by         TEXT,
  approved_at         TIMESTAMPTZ,
  signature_id        UUID,
  signed_at           TIMESTAMPTZ,
  signed_by           TEXT,
  dispatched_at       TIMESTAMPTZ,
  dispatched_by       TEXT,
  dispatch_method     VARCHAR(50),
  signed_pdf_url      TEXT,
  signed_pdf_hash     VARCHAR(64),
  attachments         JSONB,
  grievance_id        UUID,
  internal_notes      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_correspondence_org       ON correspondence(organization_id);
CREATE INDEX IF NOT EXISTS idx_correspondence_status    ON correspondence(status);
CREATE INDEX IF NOT EXISTS idx_correspondence_drafter   ON correspondence(drafted_by);
CREATE INDEX IF NOT EXISTS idx_correspondence_signer    ON correspondence(assigned_signer_id);
CREATE INDEX IF NOT EXISTS idx_correspondence_ref       ON correspondence(reference_number);
CREATE INDEX IF NOT EXISTS idx_correspondence_grievance ON correspondence(grievance_id);

-- ── Correspondence Recipients ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS correspondence_recipients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondence_id UUID NOT NULL REFERENCES correspondence(id) ON DELETE CASCADE,
  recipient_type    VARCHAR(10) NOT NULL DEFAULT 'to',
  name              VARCHAR(255) NOT NULL,
  email             VARCHAR(320),
  mailing_address   TEXT,
  organization      VARCHAR(255),
  title             VARCHAR(255),
  delivery_status   VARCHAR(50) DEFAULT 'pending',
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corr_recipients_corr ON correspondence_recipients(correspondence_id);

-- ── Correspondence Audit Trail ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS correspondence_audit_trail (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondence_id UUID NOT NULL REFERENCES correspondence(id) ON DELETE CASCADE,
  event_type        correspondence_audit_event NOT NULL,
  event_description TEXT,
  actor_user_id     TEXT NOT NULL,
  actor_name        VARCHAR(255),
  actor_role        VARCHAR(100),
  ip_address        VARCHAR(45),
  user_agent        TEXT,
  metadata          JSONB,
  hash_chain        VARCHAR(64),
  timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corr_audit_corr  ON correspondence_audit_trail(correspondence_id);
CREATE INDEX IF NOT EXISTS idx_corr_audit_actor ON correspondence_audit_trail(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_corr_audit_event ON correspondence_audit_trail(event_type);
CREATE INDEX IF NOT EXISTS idx_corr_audit_time  ON correspondence_audit_trail(timestamp);

COMMIT;
