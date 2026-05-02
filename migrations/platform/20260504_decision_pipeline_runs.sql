-- Migration: decision_pipeline_runs
-- Immutable run log for every execution of the decision aggregate
-- materialization pipeline. Never truncated; retained for audit/freshness SLA.

CREATE TABLE IF NOT EXISTS decision_pipeline_runs (
  id                TEXT PRIMARY KEY,
  pipeline_name     TEXT NOT NULL,

  -- Execution parameters
  mode              TEXT NOT NULL,           -- 'incremental'|'full_rebuild'|'org_specific'|'dry_run'
  organization_id   TEXT,                   -- null except in org_specific mode

  -- Timing
  started_at    TIMESTAMPTZ NOT NULL,
  completed_at  TIMESTAMPTZ,

  -- Outcome
  status  TEXT NOT NULL DEFAULT 'running',  -- 'running'|'succeeded'|'failed'|'skipped'

  -- Volume
  records_scanned      INTEGER NOT NULL DEFAULT 0,
  records_materialized INTEGER NOT NULL DEFAULT 0,
  aggregates_written   INTEGER NOT NULL DEFAULT 0,

  -- Freshness
  freshness_lag_ms  INTEGER,

  -- Error context (populated on failure)
  error_code     TEXT,
  error_message  TEXT,

  -- Arbitrary extra context (window size, from/to range, etc.)
  metadata  JSONB
);

CREATE INDEX IF NOT EXISTS dpr_name_started_idx    ON decision_pipeline_runs (pipeline_name, started_at);
CREATE INDEX IF NOT EXISTS dpr_org_started_idx     ON decision_pipeline_runs (organization_id, started_at);
CREATE INDEX IF NOT EXISTS dpr_status_started_idx  ON decision_pipeline_runs (status, started_at);
