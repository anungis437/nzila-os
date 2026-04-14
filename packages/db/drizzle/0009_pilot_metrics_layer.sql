CREATE TABLE IF NOT EXISTS pilot_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  app_scope varchar(64) NOT NULL,
  pilot_name text NOT NULL,
  pilot_type varchar(64) NOT NULL,
  status varchar(32) NOT NULL,
  started_at timestamptz,
  target_end_at timestamptz,
  owner_user_id text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pilot_definitions_org_idx ON pilot_definitions(org_id);
CREATE INDEX IF NOT EXISTS pilot_definitions_scope_idx ON pilot_definitions(org_id, app_scope);
CREATE INDEX IF NOT EXISTS pilot_definitions_status_idx ON pilot_definitions(org_id, status);

CREATE TABLE IF NOT EXISTS pilot_metric_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  pilot_id uuid NOT NULL REFERENCES pilot_definitions(id),
  app_scope varchar(64) NOT NULL,
  metric_type varchar(32) NOT NULL,
  metric_name varchar(128) NOT NULL,
  value_numeric numeric(18,6),
  value_json jsonb,
  entity_id text,
  entity_type varchar(64),
  trace_id text,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  idempotency_key text
);

CREATE INDEX IF NOT EXISTS pilot_metric_events_org_pilot_idx ON pilot_metric_events(org_id, pilot_id);
CREATE INDEX IF NOT EXISTS pilot_metric_events_metric_idx ON pilot_metric_events(org_id, metric_name, occurred_at);
CREATE INDEX IF NOT EXISTS pilot_metric_events_trace_idx ON pilot_metric_events(trace_id);
CREATE UNIQUE INDEX IF NOT EXISTS pilot_metric_events_dedupe_idx ON pilot_metric_events(org_id, pilot_id, metric_name, idempotency_key);

CREATE TABLE IF NOT EXISTS pilot_metric_rollups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  pilot_id uuid NOT NULL REFERENCES pilot_definitions(id),
  app_scope varchar(64) NOT NULL,
  metric_name varchar(128) NOT NULL,
  window_type varchar(16) NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  value_numeric numeric(18,6),
  value_json jsonb,
  computed_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS pilot_metric_rollups_uni_idx
  ON pilot_metric_rollups(org_id, pilot_id, metric_name, window_type, window_start);
CREATE INDEX IF NOT EXISTS pilot_metric_rollups_org_idx
  ON pilot_metric_rollups(org_id, pilot_id, window_type);

CREATE TABLE IF NOT EXISTS pilot_health_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  pilot_id uuid NOT NULL REFERENCES pilot_definitions(id),
  score_total integer NOT NULL,
  score_adoption integer NOT NULL,
  score_operations integer NOT NULL,
  score_reliability integer NOT NULL,
  score_revenue integer NOT NULL,
  score_workflow integer NOT NULL,
  risk_level varchar(16) NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT NOW(),
  rationale_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS pilot_health_scores_org_idx ON pilot_health_scores(org_id, pilot_id, computed_at);

CREATE TABLE IF NOT EXISTS pilot_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  pilot_id uuid NOT NULL REFERENCES pilot_definitions(id),
  alert_type varchar(64) NOT NULL,
  severity varchar(16) NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  metric_name varchar(128),
  detected_at timestamptz NOT NULL DEFAULT NOW(),
  resolved_at timestamptz,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS pilot_alerts_org_idx ON pilot_alerts(org_id, pilot_id, detected_at);
CREATE INDEX IF NOT EXISTS pilot_alerts_open_idx ON pilot_alerts(org_id, pilot_id, resolved_at);
