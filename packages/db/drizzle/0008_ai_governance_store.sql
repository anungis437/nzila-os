-- Migration 0008: Durable AI Governance Store
--
-- Adds persistence tables used by @nzila/platform-ai-governance so
-- model registry, prompt versions, decision logs, and review flags survive
-- process restarts.

--> statement-breakpoint

CREATE TYPE "public"."ai_governance_risk_level" AS ENUM('low', 'medium', 'high');
--> statement-breakpoint
CREATE TYPE "public"."ai_governance_review_status" AS ENUM('pending', 'approved', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."ai_governance_flag_priority" AS ENUM('low', 'medium', 'high', 'critical');

--> statement-breakpoint

CREATE TABLE "ai_governance_models" (
  "id" uuid PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "version" text NOT NULL,
  "provider" text NOT NULL,
  "capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "risk_level" "ai_governance_risk_level" NOT NULL,
  "approved_for_production" boolean DEFAULT false NOT NULL,
  "registered_at" timestamp with time zone NOT NULL,
  "last_audited_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_governance_models_name_version_provider" ON "ai_governance_models" USING btree ("name","version","provider");

--> statement-breakpoint

CREATE TABLE "ai_governance_prompt_versions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "prompt_name" text NOT NULL,
  "version" integer NOT NULL,
  "template" text NOT NULL,
  "author" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "change_reason" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_governance_prompt_name_version" ON "ai_governance_prompt_versions" USING btree ("prompt_name","version");
--> statement-breakpoint
CREATE INDEX "idx_ai_governance_prompt_name_active" ON "ai_governance_prompt_versions" USING btree ("prompt_name","active");

--> statement-breakpoint

CREATE TABLE "ai_governance_decision_log" (
  "id" uuid PRIMARY KEY NOT NULL,
  "timestamp" timestamp with time zone NOT NULL,
  "model_id" text NOT NULL,
  "prompt_id" text NOT NULL,
  "app" text NOT NULL,
  "org_id" text NOT NULL,
  "input_summary" text NOT NULL,
  "output_summary" text NOT NULL,
  "confidence" numeric(5,4) NOT NULL,
  "requires_human_review" boolean DEFAULT true NOT NULL,
  "review_status" "ai_governance_review_status",
  "reviewed_by" text,
  "reviewed_at" timestamp with time zone,
  "model_version" text,
  "engine_version" text,
  "evidence_refs" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_ai_governance_decision_app" ON "ai_governance_decision_log" USING btree ("app");
--> statement-breakpoint
CREATE INDEX "idx_ai_governance_decision_model" ON "ai_governance_decision_log" USING btree ("model_id");
--> statement-breakpoint
CREATE INDEX "idx_ai_governance_decision_review_status" ON "ai_governance_decision_log" USING btree ("review_status");

--> statement-breakpoint

CREATE TABLE "ai_governance_review_flags" (
  "id" uuid PRIMARY KEY NOT NULL,
  "decision_id" uuid NOT NULL,
  "reason" text NOT NULL,
  "flagged_at" timestamp with time zone NOT NULL,
  "flagged_by" text NOT NULL,
  "priority" "ai_governance_flag_priority" NOT NULL,
  "resolved" boolean DEFAULT false NOT NULL,
  "resolution" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_governance_review_flags_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "ai_governance_decision_log"("id")
);
--> statement-breakpoint
CREATE INDEX "idx_ai_governance_flags_pending" ON "ai_governance_review_flags" USING btree ("resolved");
--> statement-breakpoint
CREATE INDEX "idx_ai_governance_flags_decision" ON "ai_governance_review_flags" USING btree ("decision_id");
