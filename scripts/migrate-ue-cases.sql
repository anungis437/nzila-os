-- Idempotent UnionEyes UE cases table migration (local recovery)
-- Source of truth: packages/db/src/schema/ue.ts

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ue_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  category text,
  channel text,
  status text,
  assigned_queue text,
  priority text,
  sla_breached boolean,
  reopen_count integer DEFAULT 0,
  message_count integer DEFAULT 0,
  attachment_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ue_cases_entity_id_idx ON ue_cases (org_id);
CREATE INDEX IF NOT EXISTS ue_cases_entity_status_idx ON ue_cases (org_id, status);
CREATE INDEX IF NOT EXISTS ue_cases_entity_created_at_idx ON ue_cases (org_id, created_at);
