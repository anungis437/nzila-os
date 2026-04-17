-- Idempotent migration for platform_request_metrics used by /performance
-- Source of truth: packages/db/src/schema/platform.ts

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS platform_request_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route varchar(512) NOT NULL,
  org_id uuid NOT NULL REFERENCES orgs(id),
  latency_ms integer NOT NULL,
  status_code integer NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_request_metrics_recorded_at_idx
  ON platform_request_metrics (recorded_at);

CREATE INDEX IF NOT EXISTS platform_request_metrics_latency_ms_idx
  ON platform_request_metrics (latency_ms);
