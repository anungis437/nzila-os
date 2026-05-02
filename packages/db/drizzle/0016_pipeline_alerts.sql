-- Migration 0016: Pipeline Alerts table
-- Persists alert records emitted by pipeline-alerting (@nzila/pipeline-alerting).
-- Severities: 'critical' | 'warning' | 'info'
-- The /api/pipeline-health endpoint queries this table; HTTP 503 on any critical alert.
--
-- Apply manually:
--   $env:PGPASSWORD="nzila_dev"
--   Get-Content packages/db/drizzle/0016_pipeline_alerts.sql |
--     & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U nzila -d nzila_automation -p 5433 -h localhost

CREATE TABLE IF NOT EXISTS "pipeline_alerts" (
  "id"            text PRIMARY KEY,
  "pipeline_name" text NOT NULL,
  "error_code"    text NOT NULL,
  "severity"      text NOT NULL,
  "message"       text NOT NULL,
  "metadata"      jsonb,
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  "resolved_at"   timestamptz
);

CREATE INDEX IF NOT EXISTS "pa_pipeline_created_idx"
  ON "pipeline_alerts" ("pipeline_name", "created_at");

CREATE INDEX IF NOT EXISTS "pa_severity_created_idx"
  ON "pipeline_alerts" ("severity", "created_at");

CREATE INDEX IF NOT EXISTS "pa_resolved_at_idx"
  ON "pipeline_alerts" ("resolved_at");
