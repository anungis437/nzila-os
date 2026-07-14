-- Migration 0044: SAGE Phase 8B closure hardening
--
-- Closes the destructive-lifecycle merge blockers identified in review:
--   1. a DURABLE destruction-attempt record persisted BEFORE the external delete
--      so a crash after deletion is reconstructable (never indeterminate);
--   2. an explicit point of no return (`deletion_started`) on the destruction
--      request, so legal-hold placement and destruction execution coordinate
--      atomically through the same row;
--   3. deterministic RETENTION-BASIS PROVENANCE frozen on the assignment;
--   4. a canonical ACTIVE-HOLD-SET DIGEST frozen on the request/approval so a
--      changed hold set (not just a changed count) invalidates an approval.

-- ── 1. Durable destruction attempt (append-only, persisted before delete) ────
CREATE TABLE IF NOT EXISTS sage_export_destruction_attempt (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id                text NOT NULL UNIQUE,
  org_id                    text NOT NULL,
  workspace_id              uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  destruction_request_id    uuid NOT NULL REFERENCES sage_export_destruction_request (id) ON DELETE CASCADE,
  export_package_id         uuid NOT NULL REFERENCES sage_export_package (id) ON DELETE CASCADE,
  object_id                 text,
  execution_owner           text NOT NULL,
  -- Stable provider idempotency key reused across retries of the SAME attempt.
  provider_idempotency_key  text NOT NULL,
  status                    text NOT NULL DEFAULT 'prepared',
  pre_delete_presence_verified  boolean,
  pre_delete_verified_at    timestamptz,
  delete_started_at         timestamptz,
  provider_result           text,
  provider_request_id       text,
  post_delete_absence_verified  boolean,
  post_delete_verified_at   timestamptz,
  safe_error_code           text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sage_export_destruction_attempt_status_valid CHECK (
    status IN ('prepared', 'deletion_started', 'provider_accepted', 'absence_verified',
               'completed', 'failed', 'indeterminate')
  )
);

CREATE INDEX IF NOT EXISTS sage_export_destruction_attempt_request_idx
  ON sage_export_destruction_attempt (destruction_request_id, status);
CREATE INDEX IF NOT EXISTS sage_export_destruction_attempt_ws_idx
  ON sage_export_destruction_attempt (workspace_id, org_id);

-- The attempt is append-once then progresses through controlled lifecycle
-- fields; the raw storage reference and provider bodies are never stored here.
CREATE OR REPLACE FUNCTION sage_export_destruction_attempt_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.attempt_id             IS DISTINCT FROM OLD.attempt_id
     OR NEW.org_id              IS DISTINCT FROM OLD.org_id
     OR NEW.workspace_id        IS DISTINCT FROM OLD.workspace_id
     OR NEW.destruction_request_id IS DISTINCT FROM OLD.destruction_request_id
     OR NEW.export_package_id   IS DISTINCT FROM OLD.export_package_id
     OR NEW.execution_owner     IS DISTINCT FROM OLD.execution_owner
     OR NEW.provider_idempotency_key IS DISTINCT FROM OLD.provider_idempotency_key
     OR NEW.created_at          IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'sage: destruction attempt identity is immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sage_export_destruction_attempt_immutable ON sage_export_destruction_attempt;
CREATE TRIGGER sage_export_destruction_attempt_immutable
  BEFORE UPDATE ON sage_export_destruction_attempt
  FOR EACH ROW EXECUTE FUNCTION sage_export_destruction_attempt_guard();

ALTER TABLE sage_export_destruction_attempt ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY sage_export_destruction_attempt_rls ON sage_export_destruction_attempt
    USING (org_id = current_setting('app.tenant_id'))
    WITH CHECK (org_id = current_setting('app.tenant_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Point of no return + attempt binding on the destruction request ───────
ALTER TABLE sage_export_destruction_request
  ADD COLUMN IF NOT EXISTS deletion_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_attempt_id  text;

-- Allow 'executing_preflight' as a distinct pre-deletion phase; keep the legacy
-- 'executing' value valid for already-created rows.
ALTER TABLE sage_export_destruction_request
  DROP CONSTRAINT IF EXISTS sage_export_destruction_request_status_valid;
ALTER TABLE sage_export_destruction_request
  ADD CONSTRAINT sage_export_destruction_request_status_valid CHECK (
    status IN ('requested', 'approved', 'executing', 'executing_preflight',
               'deletion_started', 'destroyed', 'failed', 'cancelled')
  );
-- Reshape the open-request uniqueness to include the new in-flight statuses.
DROP INDEX IF EXISTS sage_export_destruction_request_open_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS sage_export_destruction_request_open_uniq
  ON sage_export_destruction_request (export_package_id)
  WHERE status IN ('requested', 'approved', 'executing', 'executing_preflight', 'deletion_started');

-- ── 3. Retention-basis provenance (frozen on the assignment) ─────────────────
ALTER TABLE sage_export_retention_assignment
  ADD COLUMN IF NOT EXISTS retention_basis_source_type      text,
  ADD COLUMN IF NOT EXISTS retention_basis_source_id        text,
  ADD COLUMN IF NOT EXISTS retention_basis_source_timestamp timestamptz;

-- ── 4. Canonical active-hold-set digest (frozen on request + approval) ───────
ALTER TABLE sage_export_destruction_request
  ADD COLUMN IF NOT EXISTS active_hold_set_digest text;
ALTER TABLE sage_export_destruction_approval
  ADD COLUMN IF NOT EXISTS approved_active_hold_set_digest text;
