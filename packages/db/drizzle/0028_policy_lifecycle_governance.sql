-- =============================================================================
-- 0028_policy_lifecycle_governance.sql
--
-- Policy Lifecycle Governance — Platform-level governance operating system.
--
-- Creates:
--   governed_policies           — immutable policy artifact registry
--   policy_approval_chains      — approval workflow definitions per policy
--   policy_approval_actions     — individual approver actions (append-only)
--   policy_governance_events    — governance lifecycle ledger (append-only)
--   policy_replay_sessions      — replay session tracking
--   policy_replay_results       — per-event replay diff (append-only)
--   policy_conflicts            — detected governance conflicts
--   policy_governance_snapshots — point-in-time topology snapshots (append-only)
--
-- Append-only constraints:
--   policy_governance_events, policy_approval_actions, policy_replay_results,
--   and policy_governance_snapshots are protected by UPDATE/DELETE triggers.
-- =============================================================================

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE policy_lifecycle_status AS ENUM (
    'draft', 'review_pending', 'approval_required', 'approved',
    'published', 'active', 'superseded', 'deprecated', 'revoked', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE policy_risk_classification AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE policy_approval_chain_type AS ENUM ('single', 'multi', 'sequential', 'domain', 'emergency');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE policy_approval_action AS ENUM ('approved', 'rejected', 'delegated', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE policy_governance_event_type AS ENUM (
    'policy.created', 'policy.submitted_for_review', 'policy.review_started',
    'policy.approval_requested', 'policy.approved', 'policy.rejected',
    'policy.published', 'policy.activated', 'policy.superseded',
    'policy.deprecated', 'policy.revoked', 'policy.archived',
    'policy.signed', 'policy.integrity_verified', 'policy.integrity_failed',
    'policy.replay_executed', 'policy.conflict_detected', 'policy.conflict_resolved',
    'policy.rollback_initiated', 'policy.approval_delegated', 'policy.snapshot_taken'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE replay_type AS ENUM ('historical', 'candidate', 'drift_check');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE replay_session_status AS ENUM ('pending', 'running', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE policy_conflict_type AS ENUM (
    'workflow_binding', 'contradictory_behavior', 'overlapping_domain',
    'cyclic_approval', 'ambiguous_actor', 'duplicate_ownership'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE policy_conflict_severity AS ENUM ('info', 'warning', 'error', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE snapshot_trigger_type AS ENUM (
    'scheduled', 'on_publish', 'on_activation', 'on_conflict', 'on_revocation', 'manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── governed_policies ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS governed_policies (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_family_id            TEXT NOT NULL,
  semver                      TEXT NOT NULL,
  name                        TEXT NOT NULL,
  domain                      TEXT NOT NULL,
  org_id                      UUID,
  workflow_bindings           JSONB NOT NULL DEFAULT '[]',
  operational_scope           JSONB NOT NULL DEFAULT '{}',
  author_id                   TEXT NOT NULL,
  author_role                 TEXT NOT NULL,
  governance_rationale        TEXT NOT NULL,
  risk_classification         policy_risk_classification NOT NULL DEFAULT 'medium',
  review_cadence_days         INTEGER NOT NULL DEFAULT 365,
  replay_compatibility_version TEXT NOT NULL DEFAULT '1',
  lifecycle_status            policy_lifecycle_status NOT NULL DEFAULT 'draft',
  content_hash                TEXT,
  content_signature           TEXT,
  integrity_verified          BOOLEAN NOT NULL DEFAULT FALSE,
  effective_from              TIMESTAMPTZ,
  effective_until             TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at                TIMESTAMPTZ,
  activated_at                TIMESTAMPTZ,
  deprecated_at               TIMESTAMPTZ,
  revoked_at                  TIMESTAMPTZ,
  archived_at                 TIMESTAMPTZ,
  superseded_by               UUID REFERENCES governed_policies(id),
  last_reviewed_at            TIMESTAMPTZ,
  last_reviewed_by            TEXT,
  next_review_due             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS governed_policies_family_idx    ON governed_policies(policy_family_id);
CREATE INDEX IF NOT EXISTS governed_policies_domain_idx    ON governed_policies(domain, lifecycle_status);
CREATE INDEX IF NOT EXISTS governed_policies_org_idx       ON governed_policies(org_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS governed_policies_status_idx    ON governed_policies(lifecycle_status);
CREATE INDEX IF NOT EXISTS governed_policies_hash_idx      ON governed_policies(content_hash);
CREATE INDEX IF NOT EXISTS governed_policies_superseded_idx ON governed_policies(superseded_by);

-- ── policy_approval_chains ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS policy_approval_chains (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  governed_policy_id      UUID NOT NULL REFERENCES governed_policies(id),
  chain_type              policy_approval_chain_type NOT NULL DEFAULT 'single',
  required_approvals      INTEGER NOT NULL DEFAULT 1,
  requires_named_approvers BOOLEAN NOT NULL DEFAULT FALSE,
  approver_roles          TEXT[] NOT NULL DEFAULT '{}',
  named_approver_ids      TEXT[] NOT NULL DEFAULT '{}',
  delegatable             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by              TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS policy_approval_chains_policy_idx ON policy_approval_chains(governed_policy_id);

-- ── policy_approval_actions (append-only) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS policy_approval_actions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id              UUID NOT NULL REFERENCES policy_approval_chains(id),
  governed_policy_id    UUID NOT NULL REFERENCES governed_policies(id),
  approver_user_id      TEXT NOT NULL,
  approver_role         TEXT NOT NULL,
  action                policy_approval_action NOT NULL,
  comments              TEXT,
  rationale             TEXT,
  delegated_to_user_id  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS policy_approval_actions_chain_idx    ON policy_approval_actions(chain_id);
CREATE INDEX IF NOT EXISTS policy_approval_actions_policy_idx   ON policy_approval_actions(governed_policy_id);
CREATE INDEX IF NOT EXISTS policy_approval_actions_approver_idx ON policy_approval_actions(approver_user_id);

-- ── policy_governance_events (append-only) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS policy_governance_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID,
  policy_id       UUID NOT NULL REFERENCES governed_policies(id),
  policy_version  TEXT NOT NULL,
  domain          TEXT NOT NULL,
  event_type      policy_governance_event_type NOT NULL,
  actor_user_id   TEXT,
  actor_role      TEXT,
  previous_state  TEXT,
  next_state      TEXT,
  content_hash    TEXT,
  payload         JSONB NOT NULL DEFAULT '{}',
  correlation_id  TEXT,
  trace_id        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pge_policy_idx      ON policy_governance_events(policy_id, created_at);
CREATE INDEX IF NOT EXISTS pge_event_type_idx  ON policy_governance_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS pge_domain_idx      ON policy_governance_events(domain, created_at);
CREATE INDEX IF NOT EXISTS pge_org_idx         ON policy_governance_events(org_id, created_at);
CREATE INDEX IF NOT EXISTS pge_actor_idx       ON policy_governance_events(actor_user_id);
CREATE INDEX IF NOT EXISTS pge_correlation_idx ON policy_governance_events(correlation_id);
CREATE INDEX IF NOT EXISTS pge_created_idx     ON policy_governance_events(created_at);

-- ── policy_replay_sessions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS policy_replay_sessions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID,
  initiator_user_id         TEXT NOT NULL,
  initiator_role            TEXT NOT NULL,
  replay_type               replay_type NOT NULL,
  source_policy_id          UUID NOT NULL REFERENCES governed_policies(id),
  source_policy_version     TEXT NOT NULL,
  source_policy_hash        TEXT,
  target_policy_id          UUID REFERENCES governed_policies(id),
  target_policy_version     TEXT,
  target_policy_hash        TEXT,
  from_date                 TIMESTAMPTZ,
  to_date                   TIMESTAMPTZ,
  domain_filter             TEXT,
  status                    replay_session_status NOT NULL DEFAULT 'pending',
  decision_count_replayed   INTEGER NOT NULL DEFAULT 0,
  changed_outcome_count     INTEGER NOT NULL DEFAULT 0,
  drift_detected            BOOLEAN NOT NULL DEFAULT FALSE,
  error_message             TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at                TIMESTAMPTZ,
  completed_at              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS replay_sessions_org_idx    ON policy_replay_sessions(org_id, created_at);
CREATE INDEX IF NOT EXISTS replay_sessions_source_idx ON policy_replay_sessions(source_policy_id);
CREATE INDEX IF NOT EXISTS replay_sessions_target_idx ON policy_replay_sessions(target_policy_id);
CREATE INDEX IF NOT EXISTS replay_sessions_status_idx ON policy_replay_sessions(status);

-- ── policy_replay_results (append-only) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS policy_replay_results (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id                  UUID NOT NULL REFERENCES policy_replay_sessions(id),
  original_decision_event_id  TEXT NOT NULL,
  original_event_created_at   TIMESTAMPTZ,
  original_decision           TEXT NOT NULL,
  original_reason_code        TEXT NOT NULL,
  original_approver_roles     TEXT[],
  replayed_decision           TEXT NOT NULL,
  replayed_reason_code        TEXT NOT NULL,
  replayed_approver_roles     TEXT[],
  drift_detected              BOOLEAN NOT NULL DEFAULT FALSE,
  drift_dimensions            JSONB NOT NULL DEFAULT '[]',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS replay_results_session_idx  ON policy_replay_results(session_id);
CREATE INDEX IF NOT EXISTS replay_results_drift_idx    ON policy_replay_results(session_id, drift_detected);
CREATE INDEX IF NOT EXISTS replay_results_original_idx ON policy_replay_results(original_decision_event_id);

-- ── policy_conflicts ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS policy_conflicts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id_a                 UUID NOT NULL REFERENCES governed_policies(id),
  policy_id_b                 UUID REFERENCES governed_policies(id),
  conflict_type               policy_conflict_type NOT NULL,
  severity                    policy_conflict_severity NOT NULL,
  description                 TEXT NOT NULL,
  conflict_detail             JSONB NOT NULL DEFAULT '{}',
  affected_workflow_ids       TEXT[] NOT NULL DEFAULT '{}',
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  detected_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detected_by                 TEXT,
  detected_during_transition  TEXT,
  resolved_at                 TIMESTAMPTZ,
  resolved_by                 TEXT,
  resolution_notes            TEXT
);

CREATE INDEX IF NOT EXISTS policy_conflicts_a_idx       ON policy_conflicts(policy_id_a);
CREATE INDEX IF NOT EXISTS policy_conflicts_b_idx       ON policy_conflicts(policy_id_b);
CREATE INDEX IF NOT EXISTS policy_conflicts_active_idx  ON policy_conflicts(is_active, severity);
CREATE INDEX IF NOT EXISTS policy_conflicts_severity_idx ON policy_conflicts(severity, detected_at);

-- ── policy_governance_snapshots (append-only) ────────────────────────────────

CREATE TABLE IF NOT EXISTS policy_governance_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID,
  snapshot_hash         TEXT NOT NULL,
  trigger_type          snapshot_trigger_type NOT NULL,
  trigger_event_id      UUID,
  active_policy_graph   JSONB NOT NULL DEFAULT '[]',
  conflict_summary      JSONB NOT NULL DEFAULT '[]',
  replay_drift_summary  JSONB NOT NULL DEFAULT '{}',
  approval_topology     JSONB NOT NULL DEFAULT '[]',
  lineage_state         JSONB NOT NULL DEFAULT '[]',
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by_user_id  TEXT
);

CREATE INDEX IF NOT EXISTS pgs_org_generated_idx ON policy_governance_snapshots(org_id, generated_at);
CREATE INDEX IF NOT EXISTS pgs_generated_idx     ON policy_governance_snapshots(generated_at);
CREATE INDEX IF NOT EXISTS pgs_trigger_idx       ON policy_governance_snapshots(trigger_type, generated_at);
CREATE INDEX IF NOT EXISTS pgs_hash_idx          ON policy_governance_snapshots(snapshot_hash);

-- =============================================================================
-- APPEND-ONLY TRIGGERS
-- policy_governance_events, policy_approval_actions, policy_replay_results,
-- and policy_governance_snapshots must never be updated or deleted.
-- =============================================================================

-- Prevent UPDATE/DELETE on policy_governance_events
CREATE OR REPLACE FUNCTION prevent_policy_governance_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'policy_governance_events is append-only — % is prohibited', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pge_no_update
  BEFORE UPDATE ON policy_governance_events
  FOR EACH ROW EXECUTE FUNCTION prevent_policy_governance_event_mutation();

CREATE TRIGGER trg_pge_no_delete
  BEFORE DELETE ON policy_governance_events
  FOR EACH ROW EXECUTE FUNCTION prevent_policy_governance_event_mutation();

-- Prevent UPDATE/DELETE on policy_approval_actions
CREATE OR REPLACE FUNCTION prevent_policy_approval_action_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'policy_approval_actions is append-only — % is prohibited', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_paa_no_update
  BEFORE UPDATE ON policy_approval_actions
  FOR EACH ROW EXECUTE FUNCTION prevent_policy_approval_action_mutation();

CREATE TRIGGER trg_paa_no_delete
  BEFORE DELETE ON policy_approval_actions
  FOR EACH ROW EXECUTE FUNCTION prevent_policy_approval_action_mutation();

-- Prevent UPDATE/DELETE on policy_replay_results
CREATE OR REPLACE FUNCTION prevent_policy_replay_result_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'policy_replay_results is append-only — % is prohibited', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prr_no_update
  BEFORE UPDATE ON policy_replay_results
  FOR EACH ROW EXECUTE FUNCTION prevent_policy_replay_result_mutation();

CREATE TRIGGER trg_prr_no_delete
  BEFORE DELETE ON policy_replay_results
  FOR EACH ROW EXECUTE FUNCTION prevent_policy_replay_result_mutation();

-- Prevent UPDATE/DELETE on policy_governance_snapshots
CREATE OR REPLACE FUNCTION prevent_policy_governance_snapshot_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'policy_governance_snapshots is append-only — % is prohibited', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pgs_no_update
  BEFORE UPDATE ON policy_governance_snapshots
  FOR EACH ROW EXECUTE FUNCTION prevent_policy_governance_snapshot_mutation();

CREATE TRIGGER trg_pgs_no_delete
  BEFORE DELETE ON policy_governance_snapshots
  FOR EACH ROW EXECUTE FUNCTION prevent_policy_governance_snapshot_mutation();
