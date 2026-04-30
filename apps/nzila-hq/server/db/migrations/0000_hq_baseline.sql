-- Nzila HQ — Phase 1 persistence baseline.
-- Tables are prefixed `hq_*` so they coexist safely with peer apps sharing
-- the same Postgres instance. Idempotent: safe to re-run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS hq_metrics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL,
  active_ventures bigint NOT NULL,
  total_mrr_cents bigint NOT NULL,
  weighted_pipeline_cents bigint NOT NULL,
  founder_bottleneck_score bigint NOT NULL,
  cash_runway_months bigint,
  extra jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_captured_at ON hq_metrics_snapshots (captured_at);

CREATE TABLE IF NOT EXISTS hq_dependency_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_slug varchar(80) NOT NULL,
  captured_at timestamptz NOT NULL,
  score bigint NOT NULL,
  signal varchar(16) NOT NULL,
  factors jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dependency_scores_venture_captured ON hq_dependency_scores (venture_slug, captured_at);

CREATE TABLE IF NOT EXISTS hq_allocations_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_slug varchar(80) NOT NULL,
  captured_at timestamptz NOT NULL,
  composite bigint NOT NULL,
  recommendation varchar(32) NOT NULL,
  confidence varchar(16) NOT NULL,
  axes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_allocations_history_venture_captured ON hq_allocations_history (venture_slug, captured_at);

CREATE TABLE IF NOT EXISTS hq_cash_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind varchar(16) NOT NULL,
  category varchar(32) NOT NULL,
  amount_cents bigint NOT NULL,
  occurred_at timestamptz NOT NULL,
  venture_slug varchar(80),
  description text NOT NULL DEFAULT '',
  source_system varchar(32) NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_cash_events_occurred_at ON hq_cash_events (occurred_at);

CREATE TABLE IF NOT EXISTS hq_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id varchar(128),
  venture_slug varchar(80) NOT NULL,
  client_org_id varchar(128) NOT NULL,
  client_name varchar(256) NOT NULL,
  issued_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  paid_at timestamptz,
  amount_cents bigint NOT NULL,
  status varchar(16) NOT NULL,
  source_system varchar(32) NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_invoices_venture ON hq_invoices (venture_slug);
CREATE INDEX IF NOT EXISTS idx_invoices_status_due ON hq_invoices (status, due_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_external_id ON hq_invoices (external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS hq_report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind varchar(64) NOT NULL,
  generated_for_user_id varchar(128) NOT NULL,
  generated_for_role varchar(32) NOT NULL,
  content_hash varchar(64) NOT NULL,
  summary text NOT NULL DEFAULT '',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_runs_kind_created ON hq_report_runs (kind, created_at);
CREATE INDEX IF NOT EXISTS idx_report_runs_user_created ON hq_report_runs (generated_for_user_id, created_at);

CREATE TABLE IF NOT EXISTS hq_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id varchar(128) NOT NULL,
  actor_role varchar(32) NOT NULL,
  action varchar(64) NOT NULL,
  resource_kind varchar(64) NOT NULL,
  resource_id varchar(256),
  metadata jsonb,
  ip_address varchar(64),
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_occurred ON hq_audit_log (actor_user_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_occurred ON hq_audit_log (action, occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON hq_audit_log (resource_kind, resource_id);
