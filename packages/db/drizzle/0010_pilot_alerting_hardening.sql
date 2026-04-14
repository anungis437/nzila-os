ALTER TABLE pilot_alerts
  ADD COLUMN IF NOT EXISTS rule_id uuid,
  ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS dedup_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS occurrence_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS window_start timestamptz,
  ADD COLUMN IF NOT EXISTS window_end timestamptz,
  ADD COLUMN IF NOT EXISTS metric_value numeric(18,6),
  ADD COLUMN IF NOT EXISTS threshold_value numeric(18,6),
  ADD COLUMN IF NOT EXISTS playbook_key varchar(128),
  ADD COLUMN IF NOT EXISTS what_happened text,
  ADD COLUMN IF NOT EXISTS why_it_matters text,
  ADD COLUMN IF NOT EXISTS what_to_do_next text,
  ADD COLUMN IF NOT EXISTS assignee_user_id text,
  ADD COLUMN IF NOT EXISTS acknowledged_by text,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by text,
  ADD COLUMN IF NOT EXISTS resolution_notes text,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

CREATE TABLE IF NOT EXISTS pilot_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  pilot_id uuid NOT NULL REFERENCES pilot_definitions(id),
  metric_name varchar(128) NOT NULL,
  rule_type varchar(32) NOT NULL,
  operator varchar(16) NOT NULL,
  threshold_value numeric(18,6) NOT NULL,
  window_minutes integer NOT NULL,
  severity varchar(16) NOT NULL,
  enabled boolean NOT NULL DEFAULT TRUE,
  cooldown_minutes integer NOT NULL DEFAULT 30,
  playbook_key varchar(128),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE pilot_alerts
  ADD CONSTRAINT IF NOT EXISTS pilot_alerts_rule_fk
  FOREIGN KEY (rule_id) REFERENCES pilot_alert_rules(id);

CREATE INDEX IF NOT EXISTS pilot_alert_rules_org_idx ON pilot_alert_rules(org_id, pilot_id);
CREATE INDEX IF NOT EXISTS pilot_alert_rules_metric_idx ON pilot_alert_rules(org_id, pilot_id, metric_name);
CREATE UNIQUE INDEX IF NOT EXISTS pilot_alert_rules_uni_idx
  ON pilot_alert_rules(org_id, pilot_id, metric_name, rule_type, operator);

CREATE TABLE IF NOT EXISTS pilot_alert_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  pilot_id uuid NOT NULL REFERENCES pilot_definitions(id),
  severity varchar(16) NOT NULL,
  notify_after_minutes integer NOT NULL,
  escalation_channel varchar(32) NOT NULL,
  escalation_target text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pilot_alert_escalations_org_idx ON pilot_alert_escalations(org_id, pilot_id);
CREATE INDEX IF NOT EXISTS pilot_alert_escalations_sev_idx ON pilot_alert_escalations(org_id, pilot_id, severity);

CREATE INDEX IF NOT EXISTS pilot_alerts_dedup_idx ON pilot_alerts(org_id, pilot_id, dedup_key);
CREATE INDEX IF NOT EXISTS pilot_alerts_correlation_idx ON pilot_alerts(org_id, pilot_id, correlation_id);

CREATE UNIQUE INDEX IF NOT EXISTS pilot_alerts_open_dedup_idx
  ON pilot_alerts(org_id, pilot_id, dedup_key)
  WHERE status IN ('open', 'acknowledged', 'in_progress');
