CREATE TABLE IF NOT EXISTS decision_aggregates (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  domain varchar(64) NOT NULL,
  decision_type varchar(255) NOT NULL,
  policy_version varchar(64) NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  total integer NOT NULL,
  approvals integer NOT NULL,
  rejections integer NOT NULL,
  escalations integer NOT NULL,
  pending integer NOT NULL,
  avg_decision_time_ms integer NOT NULL,
  override_rate numeric(8,4) NOT NULL,
  human_intervention_rate numeric(8,4) NOT NULL,
  effectiveness_score numeric(8,4) NOT NULL,
  source varchar(32) NOT NULL DEFAULT 'audit_records',
  metrics jsonb NOT NULL,
  behavior jsonb NOT NULL,
  meta jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT decision_aggregates_org_type_window_uidx UNIQUE (
    organization_id,
    decision_type,
    policy_version,
    window_start,
    window_end
  )
);

CREATE INDEX IF NOT EXISTS decision_aggregates_org_window_idx ON decision_aggregates (organization_id, window_start, window_end);
CREATE INDEX IF NOT EXISTS decision_aggregates_type_window_idx ON decision_aggregates (decision_type, window_start, window_end);
CREATE INDEX IF NOT EXISTS decision_aggregates_domain_window_idx ON decision_aggregates (domain, window_start, window_end);