-- ===========================================================================
-- Migration: Integration Fabric
-- Date: 2026-07-15
-- Description: Creates the 7 core tables for the Integration Fabric:
--   integration_connections, integration_event_subscriptions,
--   integration_runs, integration_delivery_attempts,
--   integration_dead_letters, external_identity_links,
--   integration_mapping_rules.
-- ===========================================================================

BEGIN;

-- ── Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE connector_type AS ENUM (
    'webhook', 'rest_api', 'email_ingestion', 'csv_sftp',
    'document_system', 'crm', 'hris', 'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE connection_status AS ENUM (
    'active', 'inactive', 'error', 'pending', 'suspended'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE integration_run_status AS ENUM (
    'pending', 'running', 'completed', 'failed',
    'partial', 'cancelled', 'retrying'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sync_direction AS ENUM (
    'inbound', 'outbound', 'bidirectional'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE delivery_attempt_status AS ENUM (
    'pending', 'success', 'failed', 'retrying'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE source_of_truth_mode AS ENUM (
    'internal', 'external', 'field_level', 'append_only'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Integration Connections ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integration_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  connector_id    VARCHAR(255) NOT NULL,
  connector_type  connector_type NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  status          connection_status NOT NULL DEFAULT 'pending',
  config          JSONB NOT NULL DEFAULT '{}',
  credential_ref  VARCHAR(512),
  app_scopes      JSONB NOT NULL DEFAULT '[]',
  last_health_check_at TIMESTAMPTZ,
  last_health_status   VARCHAR(50),
  created_by      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integration_connections_org_idx
  ON integration_connections (org_id);
CREATE INDEX IF NOT EXISTS integration_connections_connector_idx
  ON integration_connections (connector_id);
CREATE INDEX IF NOT EXISTS integration_connections_status_idx
  ON integration_connections (org_id, status);

-- ── Integration Event Subscriptions ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integration_event_subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL,
  connection_id       UUID NOT NULL REFERENCES integration_connections(id),
  event_type          VARCHAR(255) NOT NULL,
  target_url          TEXT NOT NULL,
  secret              TEXT,
  signature_algorithm VARCHAR(50) DEFAULT 'sha256',
  active              BOOLEAN NOT NULL DEFAULT true,
  filter_expression   JSONB,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_by          TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integration_subscriptions_org_idx
  ON integration_event_subscriptions (org_id);
CREATE INDEX IF NOT EXISTS integration_subscriptions_conn_idx
  ON integration_event_subscriptions (connection_id);
CREATE INDEX IF NOT EXISTS integration_subscriptions_event_idx
  ON integration_event_subscriptions (event_type);
CREATE INDEX IF NOT EXISTS integration_subscriptions_active_idx
  ON integration_event_subscriptions (org_id, event_type, active);

-- ── Integration Runs ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integration_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  connection_id   UUID NOT NULL REFERENCES integration_connections(id),
  direction       sync_direction NOT NULL,
  event_type      VARCHAR(255),
  status          integration_run_status NOT NULL DEFAULT 'pending',
  input_payload   JSONB NOT NULL DEFAULT '{}',
  output_payload  JSONB,
  error_message   TEXT,
  mapping_rule_id UUID,
  idempotency_key VARCHAR(512),
  trace_id        VARCHAR(128),
  duration_ms     INTEGER,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  created_by      TEXT NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS integration_runs_org_idx
  ON integration_runs (org_id);
CREATE INDEX IF NOT EXISTS integration_runs_conn_idx
  ON integration_runs (connection_id);
CREATE INDEX IF NOT EXISTS integration_runs_status_idx
  ON integration_runs (org_id, status);
CREATE INDEX IF NOT EXISTS integration_runs_idempotency_idx
  ON integration_runs (idempotency_key);
CREATE INDEX IF NOT EXISTS integration_runs_trace_idx
  ON integration_runs (trace_id);

-- ── Integration Delivery Attempts ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integration_delivery_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES integration_event_subscriptions(id),
  run_id          UUID REFERENCES integration_runs(id),
  event_type      VARCHAR(255) NOT NULL,
  target_url      TEXT NOT NULL,
  request_body    JSONB NOT NULL DEFAULT '{}',
  request_headers JSONB NOT NULL DEFAULT '{}',
  response_status INTEGER,
  response_body   TEXT,
  status          delivery_attempt_status NOT NULL DEFAULT 'pending',
  attempt         INTEGER NOT NULL DEFAULT 1,
  error_message   TEXT,
  attempted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integration_delivery_org_idx
  ON integration_delivery_attempts (org_id);
CREATE INDEX IF NOT EXISTS integration_delivery_sub_idx
  ON integration_delivery_attempts (subscription_id);
CREATE INDEX IF NOT EXISTS integration_delivery_status_idx
  ON integration_delivery_attempts (org_id, status);

-- ── Integration Dead Letters ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integration_dead_letters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  connection_id   UUID NOT NULL REFERENCES integration_connections(id),
  subscription_id UUID REFERENCES integration_event_subscriptions(id),
  event_type      VARCHAR(255) NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  error_message   TEXT NOT NULL,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_attempts  INTEGER NOT NULL DEFAULT 0,
  replayed        BOOLEAN NOT NULL DEFAULT false,
  replayed_at     TIMESTAMPTZ,
  replayed_by     TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integration_dead_letters_org_idx
  ON integration_dead_letters (org_id);
CREATE INDEX IF NOT EXISTS integration_dead_letters_conn_idx
  ON integration_dead_letters (connection_id);
CREATE INDEX IF NOT EXISTS integration_dead_letters_replayed_idx
  ON integration_dead_letters (org_id, replayed);

-- ── External Identity Links ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS external_identity_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  connection_id   UUID NOT NULL REFERENCES integration_connections(id),
  entity_type     VARCHAR(100) NOT NULL,
  internal_id     UUID NOT NULL,
  external_id     VARCHAR(512) NOT NULL,
  external_system VARCHAR(255) NOT NULL,
  metadata_json   JSONB NOT NULL DEFAULT '{}',
  stale_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ext_identity_org_idx
  ON external_identity_links (org_id);
CREATE INDEX IF NOT EXISTS ext_identity_conn_idx
  ON external_identity_links (connection_id);
CREATE INDEX IF NOT EXISTS ext_identity_resolve_idx
  ON external_identity_links (org_id, entity_type, external_id, external_system);
CREATE INDEX IF NOT EXISTS ext_identity_internal_idx
  ON external_identity_links (org_id, entity_type, internal_id);

-- ── Integration Mapping Rules ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integration_mapping_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  connection_id   UUID NOT NULL REFERENCES integration_connections(id),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  direction       sync_direction NOT NULL,
  entity_type     VARCHAR(100) NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  active          BOOLEAN NOT NULL DEFAULT true,
  definition      JSONB NOT NULL,
  pre_validation  JSONB NOT NULL DEFAULT '[]',
  post_validation JSONB NOT NULL DEFAULT '[]',
  created_by      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integration_mapping_org_idx
  ON integration_mapping_rules (org_id);
CREATE INDEX IF NOT EXISTS integration_mapping_conn_idx
  ON integration_mapping_rules (connection_id);
CREATE INDEX IF NOT EXISTS integration_mapping_entity_idx
  ON integration_mapping_rules (org_id, entity_type, direction);
CREATE INDEX IF NOT EXISTS integration_mapping_active_idx
  ON integration_mapping_rules (org_id, active);

COMMIT;
