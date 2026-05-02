-- Migration: decision_pipeline_checkpoints
-- Stores the durable cursor for the incremental materialization pipeline.

CREATE TABLE IF NOT EXISTS decision_pipeline_checkpoints (
  id                              TEXT PRIMARY KEY,
  pipeline_name                   TEXT NOT NULL UNIQUE,

  -- Cursor (both fields required for unambiguous resume)
  last_successful_audit_created_at  TIMESTAMPTZ,
  last_successful_audit_id          TEXT,

  -- Last run metadata
  last_run_started_at              TIMESTAMPTZ NOT NULL,
  last_run_completed_at            TIMESTAMPTZ,
  last_run_status                  TEXT NOT NULL DEFAULT 'running',

  -- Counters
  records_scanned                  INTEGER NOT NULL DEFAULT 0,
  records_materialized             INTEGER NOT NULL DEFAULT 0,

  -- Failure context
  failure_reason                   TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dpc_pipeline_name_idx    ON decision_pipeline_checkpoints (pipeline_name);
CREATE INDEX IF NOT EXISTS dpc_last_run_status_idx  ON decision_pipeline_checkpoints (last_run_status);
