-- Migration 0033: SAGE Phase 3 — review note table (durable persistence)
-- Purpose: complete the sage_* schema for the SQL-backed SageRepository (Phase 3).
-- Context:
--   * Phase 1 (0032) created the SAGE access/domain tables but did not include a
--     sage_review_note table, even though the SAGE domain type (SageReviewNote)
--     and the repository port (addReviewNote) require one.
--   * This migration adds sage_review_note so PostgresSageRepository.addReviewNote
--     persists durably rather than throwing "not implemented".
-- Notes:
--   * org_id is the tenancy boundary (matches migration 0032).
--   * Idempotent: CREATE TABLE IF NOT EXISTS + IF NOT EXISTS indexes.
--   * No new enum types are required.

CREATE TABLE IF NOT EXISTS sage_review_note (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  org_id        text NOT NULL,
  target_id     uuid,
  reviewer_id   text NOT NULL,
  note          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sage_review_note_workspace_idx ON sage_review_note (workspace_id);
CREATE INDEX IF NOT EXISTS sage_review_note_target_idx ON sage_review_note (target_id);
CREATE INDEX IF NOT EXISTS sage_review_note_reviewer_idx ON sage_review_note (reviewer_id);
