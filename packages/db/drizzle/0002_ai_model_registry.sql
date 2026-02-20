-- Phase C: AI Model Registry
-- Adds DB-backed model registry replacing env-only deployment routing.
-- Three new tables: ai_models, ai_deployments, ai_deployment_routes.
-- Two new enums: ai_model_modality, ai_deployment_feature.

-- ── New enums ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "ai_model_modality" AS ENUM ('text', 'embeddings');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ai_deployment_feature" AS ENUM ('chat', 'generate', 'embed', 'rag', 'extract');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 1) ai_models ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ai_models" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider"   varchar(60)  NOT NULL,
  "family"     varchar(120) NOT NULL,
  "modality"   "ai_model_modality" NOT NULL,
  "notes"      text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_ai_model_provider_family"
  ON "ai_models" ("provider", "family");

-- ── 2) ai_deployments ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ai_deployments" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "model_id"              uuid NOT NULL REFERENCES "ai_models"("id"),
  "deployment_name"       varchar(200) NOT NULL,
  "environment"           "ai_environment" NOT NULL DEFAULT 'dev',
  "allowed_data_classes"  jsonb NOT NULL DEFAULT '["public","internal"]',
  "max_tokens"            integer NOT NULL DEFAULT 4096,
  "default_temperature"   numeric(3,2) NOT NULL DEFAULT 0.70,
  "cost_profile"          jsonb DEFAULT '{}',
  "enabled"               boolean NOT NULL DEFAULT true,
  "fallback_deployment_id" uuid REFERENCES "ai_deployments"("id"),
  "approved_by"           text,
  "approved_at"           timestamp with time zone,
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_ai_deployment_name_env"
  ON "ai_deployments" ("deployment_name", "environment");

CREATE INDEX IF NOT EXISTS "idx_ai_deployments_model"
  ON "ai_deployments" ("model_id");

-- ── 3) ai_deployment_routes ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ai_deployment_routes" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_id"      uuid NOT NULL REFERENCES "entities"("id"),
  "app_key"        varchar(60)  NOT NULL,
  "profile_key"    varchar(120) NOT NULL,
  "feature"        "ai_deployment_feature" NOT NULL,
  "deployment_id"  uuid NOT NULL REFERENCES "ai_deployments"("id"),
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_ai_route"
  ON "ai_deployment_routes" ("entity_id", "app_key", "profile_key", "feature");

CREATE INDEX IF NOT EXISTS "idx_ai_routes_entity_app"
  ON "ai_deployment_routes" ("entity_id", "app_key");

CREATE INDEX IF NOT EXISTS "idx_ai_routes_deployment"
  ON "ai_deployment_routes" ("deployment_id");

-- ── Seed: baseline model entries ───────────────────────────────────────────
-- Insert known Azure OpenAI deployments. Deployment routes must be seeded
-- per-entity by operators once entity IDs are known.

INSERT INTO "ai_models" ("provider", "family", "modality", "notes")
VALUES
  ('azure_openai', 'gpt-4o',                   'text',       'Azure OpenAI GPT-4o — primary text generation model'),
  ('azure_openai', 'text-embedding-ada-002',   'embeddings', 'Azure OpenAI Ada-002 — legacy RAG embeddings'),
  ('azure_openai', 'text-embedding-3-large',   'embeddings', 'Azure OpenAI text-embedding-3-large — high-quality RAG embeddings')
ON CONFLICT DO NOTHING;
