-- Idempotent migration for platform_proof_packs used by /proof-pack
-- Source of truth: packages/db/src/schema/platform.ts

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS platform_proof_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_test_hash varchar(128) NOT NULL,
  ci_pipeline_status varchar(64) NOT NULL,
  last_migration_id varchar(256) NOT NULL,
  audit_integrity_hash varchar(128) NOT NULL,
  secret_scan_status varchar(64) NOT NULL,
  red_team_summary text NOT NULL,
  signature_hash varchar(256) NOT NULL,
  immutable boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);
