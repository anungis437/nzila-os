-- Migration 0043: SAGE Phase 8B — controlled export-package records lifecycle
--
-- Completes the immutable export-package lifecycle AFTER creation (Phase 7) and
-- recipient delivery (Phase 8A): versioned retention policy, retention
-- assignment, legal holds, independently-approved destruction, verified object
-- deletion, immutable destruction evidence, and a non-downloadable package
-- tombstone.
--
-- Non-negotiable controls:
--   • default is RETAIN, not destroy — a package with no retention assignment
--     can never be destroyed;
--   • any ACTIVE legal hold blocks destruction;
--   • the destruction requester and approver MUST be different named humans;
--   • service/system actors may EXECUTE an approved destruction job but may
--     never request, approve, deny, or place/release a legal hold;
--   • database metadata deletion is NOT object destruction — the storage object
--     must be independently verified absent before a package is tombstoned;
--   • package rows, approvals, receipts, audit, and destruction evidence are
--     NEVER hard-deleted; a destroyed package remains as an immutable tombstone;
--   • raw storage references and provider error bodies are never persisted in
--     evidence/audit — only hashed references and safe codes.

-- ── New records-lifecycle application roles (distinct authorities) ───────────
-- Generic platform/org administration NEVER inherits these. Records management,
-- legal-hold authority, destruction approval, and destruction execution are all
-- separate roles so no single actor can drive an unchecked destruction.
ALTER TYPE sage_application_role ADD VALUE IF NOT EXISTS 'records_manager';
ALTER TYPE sage_application_role ADD VALUE IF NOT EXISTS 'legal_hold_manager';
ALTER TYPE sage_application_role ADD VALUE IF NOT EXISTS 'destruction_approver';
ALTER TYPE sage_application_role ADD VALUE IF NOT EXISTS 'destruction_executor';

-- ── Versioned retention policy (immutable historical versions) ───────────────
CREATE TABLE IF NOT EXISTS sage_retention_policy (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   text NOT NULL,
  policy_code              text NOT NULL,
  version                  integer NOT NULL,
  name                     text NOT NULL,
  description              text,
  retention_basis          text NOT NULL,
  retention_duration_days  integer NOT NULL,
  effective_from           timestamptz NOT NULL,
  effective_to             timestamptz,
  is_active                boolean NOT NULL DEFAULT true,
  created_by               text NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  -- Each (code, version) is a distinct immutable historical version.
  UNIQUE (org_id, policy_code, version),
  CONSTRAINT sage_retention_policy_duration_nonneg CHECK (retention_duration_days >= 0),
  CONSTRAINT sage_retention_policy_basis_valid
    CHECK (retention_basis IN ('created_at', 'delivered_at', 'event_date'))
);

CREATE INDEX IF NOT EXISTS sage_retention_policy_code_idx
  ON sage_retention_policy (org_id, policy_code, version);

-- Only the is_active flag and effective_to window may change on an existing
-- version (deactivation / supersession). Every other column is frozen so an
-- applied version's terms can never be rewritten under governed packages.
CREATE OR REPLACE FUNCTION sage_retention_policy_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.org_id                  IS DISTINCT FROM OLD.org_id
     OR NEW.policy_code          IS DISTINCT FROM OLD.policy_code
     OR NEW.version              IS DISTINCT FROM OLD.version
     OR NEW.name                 IS DISTINCT FROM OLD.name
     OR NEW.description          IS DISTINCT FROM OLD.description
     OR NEW.retention_basis      IS DISTINCT FROM OLD.retention_basis
     OR NEW.retention_duration_days IS DISTINCT FROM OLD.retention_duration_days
     OR NEW.effective_from       IS DISTINCT FROM OLD.effective_from
     OR NEW.created_by           IS DISTINCT FROM OLD.created_by
     OR NEW.created_at           IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'sage: retention policy version terms are immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sage_retention_policy_immutable ON sage_retention_policy;
CREATE TRIGGER sage_retention_policy_immutable
  BEFORE UPDATE ON sage_retention_policy
  FOR EACH ROW EXECUTE FUNCTION sage_retention_policy_guard();

-- ── One authoritative retention assignment per package (append-only) ─────────
CREATE TABLE IF NOT EXISTS sage_export_retention_assignment (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               text NOT NULL,
  workspace_id         uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  export_package_id    uuid NOT NULL REFERENCES sage_export_package (id) ON DELETE CASCADE,
  retention_policy_id  uuid NOT NULL REFERENCES sage_retention_policy (id),
  -- Snapshot of the applied policy version so later edits cannot move retention.
  policy_code          text NOT NULL,
  policy_version       integer NOT NULL,
  retention_basis      text NOT NULL,
  retention_started_at timestamptz NOT NULL,
  retain_until         timestamptz NOT NULL,
  assigned_by          text NOT NULL,
  assigned_at          timestamptz NOT NULL DEFAULT now(),
  -- Exactly one authoritative assignment per package.
  UNIQUE (export_package_id)
);

CREATE INDEX IF NOT EXISTS sage_export_retention_assignment_ws_idx
  ON sage_export_retention_assignment (workspace_id, org_id);

DROP TRIGGER IF EXISTS sage_export_retention_assignment_no_update ON sage_export_retention_assignment;
CREATE TRIGGER sage_export_retention_assignment_no_update
  BEFORE UPDATE ON sage_export_retention_assignment
  FOR EACH ROW EXECUTE FUNCTION sage_reject_row_update();

-- ── Legal holds (multiple allowed; any active hold blocks destruction) ───────
CREATE TABLE IF NOT EXISTS sage_export_legal_hold (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            text NOT NULL,
  workspace_id      uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  export_package_id uuid NOT NULL REFERENCES sage_export_package (id) ON DELETE CASCADE,
  hold_code         text NOT NULL,
  status            text NOT NULL DEFAULT 'active',
  reason            text NOT NULL,
  placed_by         text NOT NULL,
  placed_at         timestamptz NOT NULL DEFAULT now(),
  released_by       text,
  released_at       timestamptz,
  release_reason    text,
  CONSTRAINT sage_export_legal_hold_status_valid CHECK (status IN ('active', 'released')),
  -- Release fields are set together with the released status, and only then.
  CONSTRAINT sage_export_legal_hold_release_shape CHECK (
    (status = 'active'   AND released_by IS NULL AND released_at IS NULL AND release_reason IS NULL)
    OR
    (status = 'released' AND released_by IS NOT NULL AND released_at IS NOT NULL AND release_reason IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS sage_export_legal_hold_pkg_idx
  ON sage_export_legal_hold (export_package_id, status);
CREATE INDEX IF NOT EXISTS sage_export_legal_hold_ws_idx
  ON sage_export_legal_hold (workspace_id, org_id);

-- A hold is placed once and may transition active → released exactly once. The
-- original hold facts (code, reason, placed_by/at) are frozen; only the release
-- fields and status may change.
CREATE OR REPLACE FUNCTION sage_export_legal_hold_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.org_id            IS DISTINCT FROM OLD.org_id
     OR NEW.workspace_id   IS DISTINCT FROM OLD.workspace_id
     OR NEW.export_package_id IS DISTINCT FROM OLD.export_package_id
     OR NEW.hold_code      IS DISTINCT FROM OLD.hold_code
     OR NEW.reason         IS DISTINCT FROM OLD.reason
     OR NEW.placed_by      IS DISTINCT FROM OLD.placed_by
     OR NEW.placed_at      IS DISTINCT FROM OLD.placed_at THEN
    RAISE EXCEPTION 'sage: legal hold origin facts are immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.status = 'released' THEN
    RAISE EXCEPTION 'sage: a released legal hold cannot change'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sage_export_legal_hold_immutable ON sage_export_legal_hold;
CREATE TRIGGER sage_export_legal_hold_immutable
  BEFORE UPDATE ON sage_export_legal_hold
  FOR EACH ROW EXECUTE FUNCTION sage_export_legal_hold_guard();

-- ── Destruction request (frozen scope; CAS state machine) ────────────────────
CREATE TABLE IF NOT EXISTS sage_export_destruction_request (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    text NOT NULL,
  workspace_id              uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  export_package_id         uuid NOT NULL REFERENCES sage_export_package (id) ON DELETE CASCADE,
  requested_by              text NOT NULL,
  reason                    text NOT NULL,
  status                    text NOT NULL DEFAULT 'requested',
  -- Frozen-at-request scope; approval and execution recompute and compare each.
  package_content_hash      text NOT NULL,
  package_manifest_hash     text NOT NULL,
  storage_reference_hash    text NOT NULL,
  retention_policy_code     text NOT NULL,
  retention_policy_version  integer NOT NULL,
  retain_until              timestamptz NOT NULL,
  active_hold_count         integer NOT NULL,
  -- Dispatch lease for idempotent, fenced execution (mirrors notification outbox).
  execution_owner           text,
  lease_expires_at          timestamptz,
  destruction_evidence_id   uuid,
  requested_at              timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sage_export_destruction_request_status_valid CHECK (
    status IN ('requested', 'approved', 'denied', 'executing', 'destroyed', 'failed', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS sage_export_destruction_request_ws_idx
  ON sage_export_destruction_request (workspace_id, org_id);
CREATE INDEX IF NOT EXISTS sage_export_destruction_request_pkg_idx
  ON sage_export_destruction_request (export_package_id, status);
-- At most one non-terminal (open) destruction request per package.
CREATE UNIQUE INDEX IF NOT EXISTS sage_export_destruction_request_open_uniq
  ON sage_export_destruction_request (export_package_id)
  WHERE status IN ('requested', 'approved', 'executing');

-- ── Independent destruction approval (append-only; approver ≠ requester) ──────
CREATE TABLE IF NOT EXISTS sage_export_destruction_approval (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                          text NOT NULL,
  workspace_id                    uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  destruction_request_id          uuid NOT NULL REFERENCES sage_export_destruction_request (id) ON DELETE CASCADE,
  decision                        text NOT NULL,
  approver_id                     text NOT NULL,
  rationale                       text,
  approved_package_content_hash   text NOT NULL,
  approved_manifest_hash          text NOT NULL,
  approved_storage_reference_hash text NOT NULL,
  approved_retention_policy_code  text NOT NULL,
  approved_retention_policy_version integer NOT NULL,
  approved_retain_until           timestamptz NOT NULL,
  approved_active_hold_count      integer NOT NULL,
  decided_at                      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sage_export_destruction_approval_decision_valid
    CHECK (decision IN ('approved', 'denied')),
  -- Exactly one decision per request.
  UNIQUE (destruction_request_id)
);

CREATE INDEX IF NOT EXISTS sage_export_destruction_approval_ws_idx
  ON sage_export_destruction_approval (workspace_id, org_id);

DROP TRIGGER IF EXISTS sage_export_destruction_approval_no_update ON sage_export_destruction_approval;
CREATE TRIGGER sage_export_destruction_approval_no_update
  BEFORE UPDATE ON sage_export_destruction_approval
  FOR EACH ROW EXECUTE FUNCTION sage_reject_row_update();

-- ── Immutable destruction evidence (append-only) ─────────────────────────────
CREATE TABLE IF NOT EXISTS sage_export_destruction_evidence (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                    text NOT NULL UNIQUE,
  org_id                      text NOT NULL,
  workspace_id                uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  destruction_request_id      uuid NOT NULL REFERENCES sage_export_destruction_request (id) ON DELETE CASCADE,
  export_package_id           uuid NOT NULL REFERENCES sage_export_package (id) ON DELETE CASCADE,
  object_id                   text,
  storage_provider            text NOT NULL,
  -- Only a HASH of the storage reference is retained — never the raw locator.
  storage_reference_hash      text NOT NULL,
  pre_destruction_content_hash  text NOT NULL,
  pre_destruction_manifest_hash text NOT NULL,
  deletion_attempted_at       timestamptz,
  deletion_verified_at        timestamptz,
  verification_method         text,
  result                      text NOT NULL,
  provider_request_id         text,
  safe_error_code             text,
  executed_by                 text NOT NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sage_export_destruction_evidence_result_valid CHECK (
    result IN ('verified_destroyed', 'not_found_before_delete', 'verification_failed', 'provider_failed')
  )
);

CREATE INDEX IF NOT EXISTS sage_export_destruction_evidence_request_idx
  ON sage_export_destruction_evidence (destruction_request_id);
CREATE INDEX IF NOT EXISTS sage_export_destruction_evidence_pkg_idx
  ON sage_export_destruction_evidence (export_package_id);

DROP TRIGGER IF EXISTS sage_export_destruction_evidence_no_update ON sage_export_destruction_evidence;
CREATE TRIGGER sage_export_destruction_evidence_no_update
  BEFORE UPDATE ON sage_export_destruction_evidence
  FOR EACH ROW EXECUTE FUNCTION sage_reject_row_update();

-- ── Package tombstone (metadata retained; bytes become unreachable) ──────────
-- The Phase 7 trigger froze sage_export_package against ALL updates. Replace it
-- with a guard that permits ONLY the controlled tombstone transition so the
-- immutable package facts stay frozen while availability can move once, and only
-- forward, to 'destroyed'.
ALTER TABLE sage_export_package
  ADD COLUMN IF NOT EXISTS availability_status     text NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS destroyed_at            timestamptz,
  ADD COLUMN IF NOT EXISTS destroyed_by            text,
  ADD COLUMN IF NOT EXISTS destruction_request_id  uuid,
  ADD COLUMN IF NOT EXISTS destruction_evidence_id uuid;

DO $$ BEGIN
  ALTER TABLE sage_export_package
    ADD CONSTRAINT sage_export_package_availability_valid
    CHECK (availability_status IN ('available', 'destroyed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION sage_export_package_tombstone_guard() RETURNS trigger AS $$
BEGIN
  -- All immutable package facts remain frozen.
  IF NEW.id                IS DISTINCT FROM OLD.id
     OR NEW.org_id         IS DISTINCT FROM OLD.org_id
     OR NEW.workspace_id   IS DISTINCT FROM OLD.workspace_id
     OR NEW.export_request_id IS DISTINCT FROM OLD.export_request_id
     OR NEW.status         IS DISTINCT FROM OLD.status
     OR NEW.package_type   IS DISTINCT FROM OLD.package_type
     OR NEW.manifest_json  IS DISTINCT FROM OLD.manifest_json
     OR NEW.manifest_hash  IS DISTINCT FROM OLD.manifest_hash
     OR NEW.content_hash   IS DISTINCT FROM OLD.content_hash
     OR NEW.storage_reference IS DISTINCT FROM OLD.storage_reference
     OR NEW.media_type     IS DISTINCT FROM OLD.media_type
     OR NEW.size_bytes     IS DISTINCT FROM OLD.size_bytes
     OR NEW.policy_version IS DISTINCT FROM OLD.policy_version
     OR NEW.generated_by   IS DISTINCT FROM OLD.generated_by
     OR NEW.generated_at   IS DISTINCT FROM OLD.generated_at THEN
    RAISE EXCEPTION 'sage: export package facts are immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  -- Availability only moves available → destroyed, once.
  IF OLD.availability_status = 'destroyed' THEN
    RAISE EXCEPTION 'sage: a destroyed package tombstone is terminal'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.availability_status NOT IN ('available', 'destroyed') THEN
    RAISE EXCEPTION 'sage: invalid package availability transition'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sage_export_package_no_update ON sage_export_package;
DROP TRIGGER IF EXISTS sage_export_package_tombstone ON sage_export_package;
CREATE TRIGGER sage_export_package_tombstone
  BEFORE UPDATE ON sage_export_package
  FOR EACH ROW EXECUTE FUNCTION sage_export_package_tombstone_guard();

-- ── Row-level security (tenant isolation on every lifecycle table) ───────────
ALTER TABLE sage_retention_policy               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sage_export_retention_assignment    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sage_export_legal_hold              ENABLE ROW LEVEL SECURITY;
ALTER TABLE sage_export_destruction_request     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sage_export_destruction_approval    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sage_export_destruction_evidence    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY sage_retention_policy_rls ON sage_retention_policy
    USING (org_id = current_setting('app.tenant_id'))
    WITH CHECK (org_id = current_setting('app.tenant_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY sage_export_retention_assignment_rls ON sage_export_retention_assignment
    USING (org_id = current_setting('app.tenant_id'))
    WITH CHECK (org_id = current_setting('app.tenant_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY sage_export_legal_hold_rls ON sage_export_legal_hold
    USING (org_id = current_setting('app.tenant_id'))
    WITH CHECK (org_id = current_setting('app.tenant_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY sage_export_destruction_request_rls ON sage_export_destruction_request
    USING (org_id = current_setting('app.tenant_id'))
    WITH CHECK (org_id = current_setting('app.tenant_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY sage_export_destruction_approval_rls ON sage_export_destruction_approval
    USING (org_id = current_setting('app.tenant_id'))
    WITH CHECK (org_id = current_setting('app.tenant_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY sage_export_destruction_evidence_rls ON sage_export_destruction_evidence
    USING (org_id = current_setting('app.tenant_id'))
    WITH CHECK (org_id = current_setting('app.tenant_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
