-- 0037_heal_pilot_alerting_hardening.sql
--
-- Phase 0A.1 healer for PH0-OPEN-009 (empirically discovered during the
-- Phase 0A.1 clean-DB replay proof — see §11 of the closure ledger).
--
-- Root-cause defect chain:
--
--   * 0010_pilot_alerting_hardening.sql line 39 contains
--       ALTER TABLE pilot_alerts
--         ADD CONSTRAINT IF NOT EXISTS pilot_alerts_rule_fk ...;
--     PostgreSQL (through PG 17) does not support `ADD CONSTRAINT IF NOT
--     EXISTS`; the parser rejects that statement.
--
--   * The runner uses node-postgres simple-query protocol. Empirical
--     Phase 0A.1 evidence (see reports/audits/cupe-national-phase-0/
--     migration-clean-run.log) shows PostgreSQL evaluates parse errors
--     for the entire submitted string BEFORE executing any statement:
--     on a truly empty database, 0010 commits NOTHING — pilot_alerts
--     keeps only its 0009-era columns and pilot_alert_rules is never
--     created.
--
--   * The Phase 0A allowlist claimed 0010 committed pilot_alert_rules
--     before aborting. That claim held on the dev database (a legacy
--     environment) but NOT on any fresh replay. Hence 0033 (Phase 0A's
--     healer for 0010) fails immediately at its first statement on an
--     empty replay because `pilot_alert_rules` doesn't exist, so
--     `ALTER TABLE pilot_alerts ADD CONSTRAINT ... REFERENCES
--     pilot_alert_rules(id)` raises SQLSTATE 42P01.
--
-- 0033 is inside the historical range that must not be modified, so
-- healing must land in a new forward-only file. This file (0037) is that
-- healer. It restores the full intended terminal state of 0010 plus any
-- statements 0033 was intended to add on top.
--
-- Intended terminal state (aligned with 0010 + 0033 combined):
--   * pilot_alerts extended with the 21 new columns declared in 0010.
--   * pilot_alert_rules created.
--   * pilot_alerts_rule_fk FOREIGN KEY (rule_id) REFERENCES
--     pilot_alert_rules(id).
--   * pilot_alert_rules indexes (org, metric, unique-quad).
--   * pilot_alert_escalations table + 2 indexes.
--   * pilot_alerts dedup, correlation, and partial-open-dedup indexes.
--
-- Design contract:
--   * Forward-only. Does not modify 0010 or 0033.
--   * Idempotent: safe on empty DB, on the dev DB where 0010 partially
--     committed columns, and on any fully-healed DB.
--   * All CREATE statements use IF NOT EXISTS.
--   * All ALTER TABLE ADD COLUMN statements use IF NOT EXISTS.
--   * The ADD CONSTRAINT is guarded by a pg_constraint lookup.

BEGIN;

-- (1) Add the 21 pilot_alerts columns that 0010 was meant to add.
ALTER TABLE pilot_alerts
  ADD COLUMN IF NOT EXISTS rule_id           uuid,
  ADD COLUMN IF NOT EXISTS status            varchar(32) NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS dedup_key         text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS correlation_id    text,
  ADD COLUMN IF NOT EXISTS occurrence_count  integer     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS first_seen_at     timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_seen_at      timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS window_start      timestamptz,
  ADD COLUMN IF NOT EXISTS window_end        timestamptz,
  ADD COLUMN IF NOT EXISTS metric_value      numeric(18,6),
  ADD COLUMN IF NOT EXISTS threshold_value   numeric(18,6),
  ADD COLUMN IF NOT EXISTS playbook_key      varchar(128),
  ADD COLUMN IF NOT EXISTS what_happened     text,
  ADD COLUMN IF NOT EXISTS why_it_matters    text,
  ADD COLUMN IF NOT EXISTS what_to_do_next   text,
  ADD COLUMN IF NOT EXISTS assignee_user_id  text,
  ADD COLUMN IF NOT EXISTS acknowledged_by   text,
  ADD COLUMN IF NOT EXISTS acknowledged_at   timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by       text,
  ADD COLUMN IF NOT EXISTS resolution_notes  text,
  ADD COLUMN IF NOT EXISTS escalated_at      timestamptz;

-- (2) Create pilot_alert_rules.
CREATE TABLE IF NOT EXISTS pilot_alert_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES orgs(id),
  pilot_id          uuid NOT NULL REFERENCES pilot_definitions(id),
  metric_name       varchar(128) NOT NULL,
  rule_type         varchar(32) NOT NULL,
  operator          varchar(16) NOT NULL,
  threshold_value   numeric(18,6) NOT NULL,
  window_minutes    integer NOT NULL,
  severity          varchar(16) NOT NULL,
  enabled           boolean NOT NULL DEFAULT TRUE,
  cooldown_minutes  integer NOT NULL DEFAULT 30,
  playbook_key      varchar(128),
  created_at        timestamptz NOT NULL DEFAULT NOW(),
  updated_at        timestamptz NOT NULL DEFAULT NOW()
);

-- (3) FK from pilot_alerts.rule_id → pilot_alert_rules(id), guarded so
--     that re-runs on an already-healed DB are no-ops.
DO $healer_0037_fk$
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
END
$healer_0037_fk$;

-- (4) pilot_alert_rules indexes.
CREATE INDEX IF NOT EXISTS pilot_alert_rules_org_idx
  ON pilot_alert_rules(org_id, pilot_id);
CREATE INDEX IF NOT EXISTS pilot_alert_rules_metric_idx
  ON pilot_alert_rules(org_id, pilot_id, metric_name);
CREATE UNIQUE INDEX IF NOT EXISTS pilot_alert_rules_uni_idx
  ON pilot_alert_rules(org_id, pilot_id, metric_name, rule_type, operator);

-- (5) pilot_alert_escalations.
CREATE TABLE IF NOT EXISTS pilot_alert_escalations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL REFERENCES orgs(id),
  pilot_id               uuid NOT NULL REFERENCES pilot_definitions(id),
  severity               varchar(16) NOT NULL,
  notify_after_minutes   integer NOT NULL,
  escalation_channel     varchar(32) NOT NULL,
  escalation_target      text NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT NOW(),
  updated_at             timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pilot_alert_escalations_org_idx
  ON pilot_alert_escalations(org_id, pilot_id);
CREATE INDEX IF NOT EXISTS pilot_alert_escalations_sev_idx
  ON pilot_alert_escalations(org_id, pilot_id, severity);

-- (6) pilot_alerts dedup / correlation / partial-open-dedup indexes.
CREATE INDEX IF NOT EXISTS pilot_alerts_dedup_idx
  ON pilot_alerts(org_id, pilot_id, dedup_key);
CREATE INDEX IF NOT EXISTS pilot_alerts_correlation_idx
  ON pilot_alerts(org_id, pilot_id, correlation_id);
CREATE UNIQUE INDEX IF NOT EXISTS pilot_alerts_open_dedup_idx
  ON pilot_alerts(org_id, pilot_id, dedup_key)
  WHERE status IN ('open', 'acknowledged', 'in_progress');

COMMIT;
