-- Nzila OS — AI Control Plane table creation (idempotent)
-- Run when the DB was bootstrapped without the full Drizzle migration chain.
-- Uses IF NOT EXISTS / DO-EXCEPTION blocks for safety.

-- ── 1) Enum types (skip if already exists) ──────────────────────────────────

DO $$
BEGIN
  CREATE TYPE ai_action_run_status AS ENUM ('started', 'success', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ai_action_status AS ENUM (
    'proposed','policy_checked','awaiting_approval','approved',
    'executing','executed','failed','rejected','expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ai_app_status AS ENUM ('active', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ai_budget_status AS ENUM ('ok', 'warning', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ai_environment AS ENUM ('dev', 'staging', 'prod');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ai_knowledge_ingestion_status AS ENUM (
    'queued','chunked','embedded','stored','failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ai_knowledge_source_status AS ENUM ('active', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ai_knowledge_source_type AS ENUM ('blob_document', 'url', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ai_prompt_status AS ENUM ('draft', 'staged', 'active', 'retired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ai_redaction_mode AS ENUM ('strict', 'balanced', 'off');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ai_request_feature AS ENUM (
    'chat','generate','embed','rag_query','extract',
    'actions_propose','summarize','classify'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ai_request_status AS ENUM ('success', 'refused', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ai_risk_tier AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2) ai_apps ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_apps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_key    varchar(60) NOT NULL UNIQUE,
  name       text NOT NULL,
  status     ai_app_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── 3) ai_capability_profiles ────────────────────────────────────────────────
-- References orgs(id) — uses org_id per current Drizzle schema.

CREATE TABLE IF NOT EXISTS ai_capability_profiles (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES orgs(id),
  app_key              varchar(60) NOT NULL,
  environment          ai_environment NOT NULL DEFAULT 'dev',
  profile_key          varchar(120) NOT NULL,
  enabled              boolean NOT NULL DEFAULT true,
  allowed_providers    jsonb NOT NULL DEFAULT '["openai"]',
  allowed_models       jsonb NOT NULL DEFAULT '[]',
  modalities           jsonb NOT NULL DEFAULT '["text","embeddings"]',
  features             jsonb NOT NULL DEFAULT '["chat","generate"]',
  data_classes_allowed jsonb NOT NULL DEFAULT '["public","internal"]',
  streaming_allowed    boolean NOT NULL DEFAULT true,
  determinism_required boolean NOT NULL DEFAULT false,
  retention_days       integer DEFAULT 90,
  tool_permissions     jsonb DEFAULT '[]',
  budgets              jsonb DEFAULT '{}',
  redaction_mode       ai_redaction_mode NOT NULL DEFAULT 'strict',
  created_by           text NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_profile
  ON ai_capability_profiles (org_id, app_key, environment, profile_key);

-- ── 4) ai_prompts + ai_prompt_versions ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_prompts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_key    varchar(60) NOT NULL,
  prompt_key varchar(120) NOT NULL,
  description text,
  owner_role text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_prompt_key ON ai_prompts (app_key, prompt_key);

CREATE TABLE IF NOT EXISTS ai_prompt_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id       uuid NOT NULL REFERENCES ai_prompts(id),
  version         integer NOT NULL,
  status          ai_prompt_status NOT NULL DEFAULT 'draft',
  template        text NOT NULL,
  system_template text,
  output_schema   jsonb,
  allowed_features jsonb DEFAULT '[]',
  default_params  jsonb DEFAULT '{}',
  created_by      text NOT NULL,
  activated_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_prompt_version ON ai_prompt_versions (prompt_id, version);

-- ── 5) ai_requests + ai_request_payloads ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES orgs(id),
  app_key             varchar(60) NOT NULL,
  profile_key         varchar(120) NOT NULL,
  feature             ai_request_feature NOT NULL,
  prompt_version_id   uuid REFERENCES ai_prompt_versions(id),
  provider            varchar(60) NOT NULL,
  model_or_deployment varchar(120) NOT NULL,
  request_hash        text NOT NULL,
  response_hash       text NOT NULL,
  input_redacted      boolean NOT NULL DEFAULT false,
  tokens_in           integer,
  tokens_out          integer,
  cost_usd            numeric(12,6),
  latency_ms          integer,
  status              ai_request_status NOT NULL,
  error_code          varchar(60),
  created_by          text,
  occurred_at         timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_requests_org_app ON ai_requests (org_id, app_key);
CREATE INDEX IF NOT EXISTS idx_ai_requests_occurred ON ai_requests (occurred_at);

CREATE TABLE IF NOT EXISTS ai_request_payloads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL REFERENCES ai_requests(id),
  request_json  jsonb,
  response_json jsonb,
  encrypted     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 6) ai_usage_budgets ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_usage_budgets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES orgs(id),
  app_key     varchar(60) NOT NULL,
  profile_key varchar(120) NOT NULL,
  month       varchar(7) NOT NULL,
  budget_usd  numeric(12,2) NOT NULL,
  spent_usd   numeric(12,6) NOT NULL DEFAULT 0,
  status      ai_budget_status NOT NULL DEFAULT 'ok',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_budget
  ON ai_usage_budgets (org_id, app_key, profile_key, month);

-- ── 7) AI knowledge base ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_knowledge_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES orgs(id),
  app_key     varchar(60) NOT NULL,
  source_type ai_knowledge_source_type NOT NULL,
  title       text NOT NULL,
  document_id uuid,
  url         text,
  status      ai_knowledge_source_status NOT NULL DEFAULT 'active',
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_org_app ON ai_knowledge_sources (org_id, app_key);

CREATE TABLE IF NOT EXISTS ai_embeddings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES orgs(id),
  app_key    varchar(60) NOT NULL,
  source_id  uuid NOT NULL REFERENCES ai_knowledge_sources(id),
  chunk_id   varchar(255) NOT NULL,
  chunk_text text NOT NULL,
  embedding  text,
  metadata   jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_org_app ON ai_embeddings (org_id, app_key);
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_source ON ai_embeddings (source_id);

CREATE TABLE IF NOT EXISTS ai_knowledge_ingestion_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES orgs(id),
  source_id   uuid NOT NULL REFERENCES ai_knowledge_sources(id),
  status      ai_knowledge_ingestion_status NOT NULL DEFAULT 'queued',
  metrics_json jsonb DEFAULT '{}',
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_ingestion_runs_source ON ai_knowledge_ingestion_runs (source_id);

-- ── 8) ai_actions + ai_action_runs ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_actions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES orgs(id),
  app_key               varchar(60) NOT NULL,
  profile_key           varchar(120) NOT NULL,
  action_type           varchar(120) NOT NULL,
  risk_tier             ai_risk_tier NOT NULL DEFAULT 'low',
  status                ai_action_status NOT NULL DEFAULT 'proposed',
  proposal_json         jsonb NOT NULL,
  policy_decision_json  jsonb,
  approvals_required_json jsonb,
  requested_by          text NOT NULL,
  approved_by           text,
  approved_at           timestamptz,
  related_domain_type   varchar(60),
  related_domain_id     uuid,
  ai_request_id         uuid REFERENCES ai_requests(id),
  evidence_pack_eligible boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_actions_org_app ON ai_actions (org_id, app_key);
CREATE INDEX IF NOT EXISTS idx_ai_actions_status ON ai_actions (status);
CREATE INDEX IF NOT EXISTS idx_ai_actions_type ON ai_actions (action_type);

CREATE TABLE IF NOT EXISTS ai_action_runs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id                uuid NOT NULL REFERENCES ai_actions(id),
  org_id                   uuid NOT NULL REFERENCES orgs(id),
  status                   ai_action_run_status NOT NULL DEFAULT 'started',
  started_at               timestamptz NOT NULL DEFAULT now(),
  finished_at              timestamptz,
  tool_calls_json          jsonb DEFAULT '[]',
  output_artifacts_json    jsonb DEFAULT '{}',
  attestation_document_id  uuid,
  error                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_action_runs_action ON ai_action_runs (action_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_runs_org ON ai_action_runs (org_id);

-- ── 9) AI model registry (from migration 0005) ───────────────────────────────

CREATE TABLE IF NOT EXISTS ai_models (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider   varchar(60) NOT NULL,
  family     varchar(120) NOT NULL,
  modality   varchar(60) NOT NULL DEFAULT 'text',
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_deployments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id            uuid NOT NULL REFERENCES ai_models(id),
  deployment_name     varchar(120) NOT NULL,
  environment         ai_environment NOT NULL DEFAULT 'prod',
  allowed_data_classes jsonb DEFAULT '[]',
  max_tokens          integer,
  default_temperature numeric(4,3),
  cost_profile        jsonb DEFAULT '{}',
  enabled             boolean NOT NULL DEFAULT true,
  approved_by         varchar(120),
  approved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_deployments_model ON ai_deployments (model_id);
CREATE INDEX IF NOT EXISTS idx_ai_deployments_env ON ai_deployments (environment);

CREATE TABLE IF NOT EXISTS ai_deployment_routes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id uuid NOT NULL REFERENCES ai_deployments(id),
  org_id        uuid NOT NULL REFERENCES orgs(id),
  app_key       varchar(60) NOT NULL,
  profile_key   varchar(60) NOT NULL,
  feature       ai_request_feature NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_routes_unique
  ON ai_deployment_routes (org_id, app_key, profile_key, feature);
CREATE INDEX IF NOT EXISTS idx_ai_routes_deployment ON ai_deployment_routes (deployment_id);

-- ── 10) Add document_category enum values if missing ─────────────────────────

DO $$
BEGIN
  ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'ingestion_report';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE document_category ADD VALUE IF NOT EXISTS 'attestation';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

RAISE NOTICE 'AI Control Plane tables created successfully.';
