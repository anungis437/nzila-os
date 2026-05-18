-- Migration: Dedup Groups & Data Quality Warnings
-- Purpose: Support edge-case deduplication (fuzzy matching) and per-record quality tracking
-- Scope: §5-§9 of the operational polish specification

-- ─── Duplicate Groups ────────────────────────────────────────────────────────
-- Tracks clusters of potential duplicate records detected by fuzzy matching.
-- A group has a type (case, document, timeline_event) and a resolution status.

CREATE TABLE IF NOT EXISTS duplicate_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  group_type    VARCHAR(30) NOT NULL CHECK (group_type IN ('case', 'document', 'timeline_event')),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed', 'merged')),
  auto_score    REAL,                     -- highest pairwise similarity in group (0.0–1.0)
  match_reasons JSONB NOT NULL DEFAULT '[]',  -- [{reason: 'title_similarity', score: 0.92}, ...]
  reviewed_by   VARCHAR(255),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata      JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_duplicate_groups_org ON duplicate_groups (organization_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_groups_status ON duplicate_groups (status);
CREATE INDEX IF NOT EXISTS idx_duplicate_groups_type ON duplicate_groups (group_type);

-- ─── Duplicate Group Members ─────────────────────────────────────────────────
-- Links individual records to a duplicate group.

CREATE TABLE IF NOT EXISTS duplicate_group_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES duplicate_groups(id) ON DELETE CASCADE,
  record_type     VARCHAR(30) NOT NULL CHECK (record_type IN ('grievance', 'document', 'timeline_event')),
  record_id       UUID NOT NULL,
  similarity_score REAL,                  -- pairwise score vs. group anchor
  is_anchor       BOOLEAN NOT NULL DEFAULT false,  -- the "primary" record in the group
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dup_members_group ON duplicate_group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_dup_members_record ON duplicate_group_members (record_type, record_id);

-- Prevent the same record appearing twice in the same group
CREATE UNIQUE INDEX IF NOT EXISTS idx_dup_members_unique
  ON duplicate_group_members (group_id, record_type, record_id);

-- ─── Data Quality Warnings ──────────────────────────────────────────────────
-- Per-record quality issues found during import or post-import verification.

CREATE TABLE IF NOT EXISTS data_quality_warnings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  record_type     VARCHAR(30) NOT NULL,
  record_id       UUID NOT NULL,
  batch_id        UUID REFERENCES ingestion_batches(id),
  severity        VARCHAR(10) NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error')),
  category        VARCHAR(50) NOT NULL,    -- e.g., 'missing_field', 'date_anomaly', 'suspicious_duplicate'
  field_name      VARCHAR(100),
  message         TEXT NOT NULL,
  resolved        BOOLEAN NOT NULL DEFAULT false,
  resolved_by     VARCHAR(255),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quality_warnings_org ON data_quality_warnings (organization_id);
CREATE INDEX IF NOT EXISTS idx_quality_warnings_record ON data_quality_warnings (record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_quality_warnings_batch ON data_quality_warnings (batch_id);
CREATE INDEX IF NOT EXISTS idx_quality_warnings_resolved ON data_quality_warnings (resolved);
