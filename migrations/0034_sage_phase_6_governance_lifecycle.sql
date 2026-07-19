-- Migration 0034: SAGE Phase 6 — human review governance lifecycle
--
-- Adds the fields required by the Phase 6 human-governance workflow on top of
-- the Phase 1/3 governance tables. Purely additive (ALTER ... ADD COLUMN IF NOT
-- EXISTS), so existing rows keep their meaning:
--
--   * sage_boundary_flag gains a resolution lifecycle (status + resolution
--     metadata) and a target_type discriminator (needed so the read layer can
--     redact a flag whose evidence target the actor may not access). Existing
--     rows default to status 'open'.
--   * sage_review_note gains target_type (redaction) and note_type (the
--     structured kind of the human observation).
--   * sage_decision_record gains an uncertainty/limitations statement plus the
--     reviewed-evidence and related-boundary-flag references (persisted as JSON
--     arrays of ids). Decision records remain immutable after creation.
--
-- No automated decisions, scores, or conclusions are introduced. Every mutation
-- over these tables continues to require an authenticated, workspace-authorized,
-- role-authorized human actor.

ALTER TABLE sage_boundary_flag
  ADD COLUMN IF NOT EXISTS target_type      text,
  ADD COLUMN IF NOT EXISTS status           text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS resolved_at      timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by      text,
  ADD COLUMN IF NOT EXISTS resolution_note  text,
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS sage_boundary_flag_status_idx
  ON sage_boundary_flag (workspace_id, status);

ALTER TABLE sage_review_note
  ADD COLUMN IF NOT EXISTS target_type text,
  ADD COLUMN IF NOT EXISTS note_type   text;

ALTER TABLE sage_decision_record
  ADD COLUMN IF NOT EXISTS uncertainty                   text,
  ADD COLUMN IF NOT EXISTS referenced_evidence_item_ids  jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS referenced_boundary_flag_ids  jsonb NOT NULL DEFAULT '[]'::jsonb;
