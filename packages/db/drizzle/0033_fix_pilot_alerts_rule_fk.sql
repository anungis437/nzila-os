-- 0033_fix_pilot_alerts_rule_fk.sql
--
-- Root-cause fix for a defect in 0010_pilot_alerting_hardening.sql:
--
--   ALTER TABLE pilot_alerts
--     ADD CONSTRAINT IF NOT EXISTS pilot_alerts_rule_fk ...;
--
-- PostgreSQL (through at least PG 17) does not support `ADD CONSTRAINT IF NOT EXISTS`.
-- The affected line caused 0010 to abort partway on any fresh database, leaving:
--   - pilot_alerts columns added (OK)
--   - pilot_alert_rules table created (OK)
--   - pilot_alerts.rule_id → pilot_alert_rules(id) FK missing (BROKEN)
--   - all statements after the failing line unexecuted (BROKEN)
--
-- Historical migrations are never modified; this file re-applies the missing
-- constraint and the subsequent idempotent statements that 0010 was supposed
-- to leave in place. All statements are guarded so re-runs are safe.
--
-- Apply manually with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/drizzle/0033_fix_pilot_alerts_rule_fk.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'pilot_alerts'
      AND c.conname = 'pilot_alerts_rule_fk'
  ) THEN
    ALTER TABLE pilot_alerts
      ADD CONSTRAINT pilot_alerts_rule_fk
      FOREIGN KEY (rule_id) REFERENCES pilot_alert_rules(id);
  END IF;
END $$;

-- The following idempotent statements were originally in 0010 after the
-- failing ADD CONSTRAINT. Restated here so a database that failed midway
-- through 0010 lands in the same terminal state as one that ran a corrected
-- 0010 end-to-end.
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

CREATE INDEX IF NOT EXISTS pilot_alert_escalations_org_idx
  ON pilot_alert_escalations(org_id, pilot_id);
CREATE INDEX IF NOT EXISTS pilot_alert_escalations_sev_idx
  ON pilot_alert_escalations(org_id, pilot_id, severity);

CREATE INDEX IF NOT EXISTS pilot_alerts_dedup_idx
  ON pilot_alerts(org_id, pilot_id, dedup_key);
CREATE INDEX IF NOT EXISTS pilot_alerts_correlation_idx
  ON pilot_alerts(org_id, pilot_id, correlation_id);

CREATE UNIQUE INDEX IF NOT EXISTS pilot_alerts_open_dedup_idx
  ON pilot_alerts(org_id, pilot_id, dedup_key)
  WHERE status IN ('open', 'acknowledged', 'in_progress');
