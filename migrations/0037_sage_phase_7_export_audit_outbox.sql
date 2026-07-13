-- Migration 0037: SAGE Phase 7 — durable audit outbox + package immutability
--
-- Crash-consistency + integrity hardening for the controlled export workflow:
--
--   1. A durable audit outbox so a package/approval/denial audit event is
--      written IN THE SAME transaction (single-statement CTE) as the material
--      change, then dispatched to the audit sink after commit (retriable,
--      at-least-once with a stable event_id). No material export action can
--      exist without durable audit evidence. Payloads are safe identifiers/
--      hashes only — never narrative, rationale, evidence content, or
--      credentials.
--
--   2. Immutability triggers so a finalized export package and its private
--      object bytes cannot be UPDATEd by anything. DELETE is intentionally left
--      open for a future privileged Phase 8 destruction path; no Phase 7 code
--      deletes these rows.

-- ── Durable audit outbox ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sage_audit_outbox (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          text NOT NULL UNIQUE,
  org_id            text NOT NULL,
  workspace_id      uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  actor_id          text NOT NULL,
  action            text NOT NULL,
  resource_type     text NOT NULL,
  resource_id       text NOT NULL,
  safe_payload_json jsonb NOT NULL,
  status            text NOT NULL DEFAULT 'pending',
  attempt_count     integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  dispatched_at     timestamptz,
  last_error_code   text
);

-- Dispatcher scans pending events oldest-first.
CREATE INDEX IF NOT EXISTS sage_audit_outbox_pending_idx
  ON sage_audit_outbox (status, created_at);

-- ── Package object immutability constraints (defense in depth) ───────────────
-- (Columns already created in 0036; re-assert NOT NULL for safety.)

ALTER TABLE sage_export_package_object
  ALTER COLUMN content_hash SET NOT NULL,
  ALTER COLUMN size_bytes   SET NOT NULL;

-- ── Immutability triggers ────────────────────────────────────────────────────
-- A finalized package + its object bytes are insert-only. Any UPDATE is a bug or
-- tampering attempt and is rejected. DELETE remains available for a future
-- privileged destruction path (Phase 8) — it is NOT blocked here.

CREATE OR REPLACE FUNCTION sage_reject_row_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'sage: % rows are immutable and cannot be updated', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sage_export_package_no_update ON sage_export_package;
CREATE TRIGGER sage_export_package_no_update
  BEFORE UPDATE ON sage_export_package
  FOR EACH ROW EXECUTE FUNCTION sage_reject_row_update();

DROP TRIGGER IF EXISTS sage_export_package_object_no_update ON sage_export_package_object;
CREATE TRIGGER sage_export_package_object_no_update
  BEFORE UPDATE ON sage_export_package_object
  FOR EACH ROW EXECUTE FUNCTION sage_reject_row_update();
