-- =====================================================================
-- 20260520_decision_events.sql
-- Durable, append-only Control Plane authority decision ledger.
--
-- See packages/db/src/schema/decision-events.ts for the Drizzle definition
-- and apps/control-plane/server/authority/decision.ts for the writer.
--
-- Append-only semantics are enforced via the shared nzila_deny_mutate()
-- trigger function from hash-chain-immutability-triggers.sql.
-- =====================================================================

CREATE TABLE IF NOT EXISTS decision_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope
  org_id uuid NOT NULL REFERENCES orgs (id),
  domain text NOT NULL,
  workflow_id text,
  case_id text,

  -- Actor
  actor_user_id text,
  actor_role text NOT NULL,

  -- Subject
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,

  -- Outcome
  decision text NOT NULL CHECK (decision IN ('allowed', 'denied', 'approval_required')),
  reason_code text NOT NULL,
  explanation text,

  -- Policy
  policy_id text NOT NULL,
  policy_version text NOT NULL,

  -- Evidence
  evaluated_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_hash text NOT NULL,

  -- Correlation
  correlation_id text,
  trace_id text,

  -- Event taxonomy (mirrors DecisionEventType in platform-contracts)
  event_type text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS decision_events_org_idx        ON decision_events (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS decision_events_domain_idx     ON decision_events (domain, created_at DESC);
CREATE INDEX IF NOT EXISTS decision_events_policy_idx     ON decision_events (policy_id, policy_version);
CREATE INDEX IF NOT EXISTS decision_events_workflow_idx   ON decision_events (workflow_id);
CREATE INDEX IF NOT EXISTS decision_events_case_idx       ON decision_events (case_id);
CREATE INDEX IF NOT EXISTS decision_events_actor_idx      ON decision_events (actor_user_id);
CREATE INDEX IF NOT EXISTS decision_events_resource_idx   ON decision_events (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS decision_events_correlation_idx ON decision_events (correlation_id);
CREATE INDEX IF NOT EXISTS decision_events_created_idx    ON decision_events (created_at DESC);

-- ── Append-only enforcement ──────────────────────────────────────────────
-- Re-uses nzila_deny_mutate() from hash-chain-immutability-triggers.sql.
-- If that function has not yet been installed, this migration will fail
-- loudly rather than silently allowing mutations.

DROP TRIGGER IF EXISTS trg_decision_events_no_update ON decision_events;
CREATE TRIGGER trg_decision_events_no_update
  BEFORE UPDATE ON decision_events
  FOR EACH ROW
  EXECUTE FUNCTION nzila_deny_mutate();

DROP TRIGGER IF EXISTS trg_decision_events_no_delete ON decision_events;
CREATE TRIGGER trg_decision_events_no_delete
  BEFORE DELETE ON decision_events
  FOR EACH ROW
  EXECUTE FUNCTION nzila_deny_mutate();

COMMENT ON TABLE decision_events IS
  'Append-only ledger of every Control Plane authority decision. '
  'UPDATE/DELETE are structurally forbidden. Indexed for replay and audit.';
