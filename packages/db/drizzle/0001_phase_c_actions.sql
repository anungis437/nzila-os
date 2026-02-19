-- Phase C: AI Action Engine + Attestation
-- Expands ai_action_status enum, adds new enums, new tables, and new document categories.

-- ── Enum changes ────────────────────────────────────────────────────────────

-- Expand ai_action_status with execution-grade states
ALTER TYPE "ai_action_status" ADD VALUE IF NOT EXISTS 'policy_checked';
ALTER TYPE "ai_action_status" ADD VALUE IF NOT EXISTS 'awaiting_approval';
ALTER TYPE "ai_action_status" ADD VALUE IF NOT EXISTS 'executing';
ALTER TYPE "ai_action_status" ADD VALUE IF NOT EXISTS 'executed';
ALTER TYPE "ai_action_status" ADD VALUE IF NOT EXISTS 'failed';

-- New enums
DO $$ BEGIN
  CREATE TYPE "ai_risk_tier" AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ai_action_run_status" AS ENUM ('started', 'success', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ai_knowledge_ingestion_status" AS ENUM ('queued', 'chunked', 'embedded', 'stored', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Expand document_category
ALTER TYPE "document_category" ADD VALUE IF NOT EXISTS 'attestation';
ALTER TYPE "document_category" ADD VALUE IF NOT EXISTS 'ingestion_report';

-- ── ai_actions table changes ────────────────────────────────────────────────

ALTER TABLE "ai_actions"
  ADD COLUMN IF NOT EXISTS "risk_tier" "ai_risk_tier" NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS "policy_decision_json" jsonb,
  ADD COLUMN IF NOT EXISTS "approvals_required_json" jsonb,
  ADD COLUMN IF NOT EXISTS "evidence_pack_eligible" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "idx_ai_actions_type" ON "ai_actions" ("action_type");

-- ── ai_action_runs ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ai_action_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "action_id" uuid NOT NULL REFERENCES "ai_actions"("id"),
  "entity_id" uuid NOT NULL REFERENCES "entities"("id"),
  "status" "ai_action_run_status" NOT NULL DEFAULT 'started',
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "finished_at" timestamp with time zone,
  "tool_calls_json" jsonb DEFAULT '[]'::jsonb,
  "output_artifacts_json" jsonb DEFAULT '{}'::jsonb,
  "attestation_document_id" uuid REFERENCES "documents"("id"),
  "error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_ai_action_runs_action" ON "ai_action_runs" ("action_id");
CREATE INDEX IF NOT EXISTS "idx_ai_action_runs_entity" ON "ai_action_runs" ("entity_id");

-- ── ai_knowledge_ingestion_runs ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ai_knowledge_ingestion_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_id" uuid NOT NULL REFERENCES "entities"("id"),
  "source_id" uuid NOT NULL REFERENCES "ai_knowledge_sources"("id"),
  "status" "ai_knowledge_ingestion_status" NOT NULL DEFAULT 'queued',
  "metrics_json" jsonb DEFAULT '{}'::jsonb,
  "error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_ai_ingestion_runs_source" ON "ai_knowledge_ingestion_runs" ("source_id");
CREATE INDEX IF NOT EXISTS "idx_ai_ingestion_runs_entity" ON "ai_knowledge_ingestion_runs" ("entity_id");
