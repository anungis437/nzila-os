CREATE TYPE "public"."ai_action_run_status" AS ENUM('started', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_action_status" AS ENUM('proposed', 'policy_checked', 'awaiting_approval', 'approved', 'executing', 'executed', 'failed', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."ai_app_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."ai_budget_status" AS ENUM('ok', 'warning', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."ai_environment" AS ENUM('dev', 'staging', 'prod');--> statement-breakpoint
CREATE TYPE "public"."ai_knowledge_ingestion_status" AS ENUM('queued', 'chunked', 'embedded', 'stored', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_knowledge_source_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."ai_knowledge_source_type" AS ENUM('blob_document', 'url', 'manual');--> statement-breakpoint
CREATE TYPE "public"."ai_prompt_status" AS ENUM('draft', 'staged', 'active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."ai_redaction_mode" AS ENUM('strict', 'balanced', 'off');--> statement-breakpoint
CREATE TYPE "public"."ai_request_feature" AS ENUM('chat', 'generate', 'embed', 'rag_query', 'extract', 'actions_propose', 'summarize', 'classify');--> statement-breakpoint
CREATE TYPE "public"."ai_request_status" AS ENUM('success', 'refused', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_risk_tier" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
ALTER TYPE "public"."document_category" ADD VALUE 'ingestion_report' BEFORE 'other';--> statement-breakpoint
CREATE TABLE "ai_action_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"status" "ai_action_run_status" DEFAULT 'started' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"tool_calls_json" jsonb DEFAULT '[]'::jsonb,
	"output_artifacts_json" jsonb DEFAULT '{}'::jsonb,
	"attestation_document_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"app_key" varchar(60) NOT NULL,
	"profile_key" varchar(120) NOT NULL,
	"action_type" varchar(120) NOT NULL,
	"risk_tier" "ai_risk_tier" DEFAULT 'low' NOT NULL,
	"status" "ai_action_status" DEFAULT 'proposed' NOT NULL,
	"proposal_json" jsonb NOT NULL,
	"policy_decision_json" jsonb,
	"approvals_required_json" jsonb,
	"requested_by" text NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"related_domain_type" varchar(60),
	"related_domain_id" uuid,
	"ai_request_id" uuid,
	"evidence_pack_eligible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_key" varchar(60) NOT NULL,
	"name" text NOT NULL,
	"status" "ai_app_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_apps_app_key_unique" UNIQUE("app_key")
);
--> statement-breakpoint
CREATE TABLE "ai_capability_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"app_key" varchar(60) NOT NULL,
	"environment" "ai_environment" DEFAULT 'dev' NOT NULL,
	"profile_key" varchar(120) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"allowed_providers" jsonb DEFAULT '["azure_openai"]'::jsonb NOT NULL,
	"allowed_models" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"modalities" jsonb DEFAULT '["text","embeddings"]'::jsonb NOT NULL,
	"features" jsonb DEFAULT '["chat","generate"]'::jsonb NOT NULL,
	"data_classes_allowed" jsonb DEFAULT '["public","internal"]'::jsonb NOT NULL,
	"streaming_allowed" boolean DEFAULT true NOT NULL,
	"determinism_required" boolean DEFAULT false NOT NULL,
	"retention_days" integer DEFAULT 90,
	"tool_permissions" jsonb DEFAULT '[]'::jsonb,
	"budgets" jsonb DEFAULT '{}'::jsonb,
	"redaction_mode" "ai_redaction_mode" DEFAULT 'strict' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"app_key" varchar(60) NOT NULL,
	"source_id" uuid NOT NULL,
	"chunk_id" varchar(255) NOT NULL,
	"chunk_text" text NOT NULL,
	"embedding" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_knowledge_ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"status" "ai_knowledge_ingestion_status" DEFAULT 'queued' NOT NULL,
	"metrics_json" jsonb DEFAULT '{}'::jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_knowledge_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"app_key" varchar(60) NOT NULL,
	"source_type" "ai_knowledge_source_type" NOT NULL,
	"title" text NOT NULL,
	"document_id" uuid,
	"url" text,
	"status" "ai_knowledge_source_status" DEFAULT 'active' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "ai_prompt_status" DEFAULT 'draft' NOT NULL,
	"template" text NOT NULL,
	"system_template" text,
	"output_schema" jsonb,
	"allowed_features" jsonb DEFAULT '[]'::jsonb,
	"default_params" jsonb DEFAULT '{}'::jsonb,
	"created_by" text NOT NULL,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_key" varchar(60) NOT NULL,
	"prompt_key" varchar(120) NOT NULL,
	"description" text,
	"owner_role" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_request_payloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"request_json" jsonb,
	"response_json" jsonb,
	"encrypted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"app_key" varchar(60) NOT NULL,
	"profile_key" varchar(120) NOT NULL,
	"feature" "ai_request_feature" NOT NULL,
	"prompt_version_id" uuid,
	"provider" varchar(60) NOT NULL,
	"model_or_deployment" varchar(120) NOT NULL,
	"request_hash" text NOT NULL,
	"response_hash" text NOT NULL,
	"input_redacted" boolean DEFAULT false NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"cost_usd" numeric(12, 6),
	"latency_ms" integer,
	"status" "ai_request_status" NOT NULL,
	"error_code" varchar(60),
	"created_by" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"app_key" varchar(60) NOT NULL,
	"profile_key" varchar(120) NOT NULL,
	"month" varchar(7) NOT NULL,
	"budget_usd" numeric(12, 2) NOT NULL,
	"spent_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"status" "ai_budget_status" DEFAULT 'ok' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_action_runs" ADD CONSTRAINT "ai_action_runs_action_id_ai_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."ai_actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_action_runs" ADD CONSTRAINT "ai_action_runs_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_action_runs" ADD CONSTRAINT "ai_action_runs_attestation_document_id_documents_id_fk" FOREIGN KEY ("attestation_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_ai_request_id_ai_requests_id_fk" FOREIGN KEY ("ai_request_id") REFERENCES "public"."ai_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_capability_profiles" ADD CONSTRAINT "ai_capability_profiles_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_embeddings" ADD CONSTRAINT "ai_embeddings_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_embeddings" ADD CONSTRAINT "ai_embeddings_source_id_ai_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."ai_knowledge_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_knowledge_ingestion_runs" ADD CONSTRAINT "ai_knowledge_ingestion_runs_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_knowledge_ingestion_runs" ADD CONSTRAINT "ai_knowledge_ingestion_runs_source_id_ai_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."ai_knowledge_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_knowledge_sources" ADD CONSTRAINT "ai_knowledge_sources_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_knowledge_sources" ADD CONSTRAINT "ai_knowledge_sources_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_prompt_versions" ADD CONSTRAINT "ai_prompt_versions_prompt_id_ai_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."ai_prompts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_request_payloads" ADD CONSTRAINT "ai_request_payloads_request_id_ai_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."ai_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_prompt_version_id_ai_prompt_versions_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."ai_prompt_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_budgets" ADD CONSTRAINT "ai_usage_budgets_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_action_runs_action" ON "ai_action_runs" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "idx_ai_action_runs_entity" ON "ai_action_runs" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_ai_actions_entity_app" ON "ai_actions" USING btree ("entity_id","app_key");--> statement-breakpoint
CREATE INDEX "idx_ai_actions_status" ON "ai_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_actions_type" ON "ai_actions" USING btree ("action_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_profile" ON "ai_capability_profiles" USING btree ("entity_id","app_key","environment","profile_key");--> statement-breakpoint
CREATE INDEX "idx_ai_embeddings_entity_app" ON "ai_embeddings" USING btree ("entity_id","app_key");--> statement-breakpoint
CREATE INDEX "idx_ai_embeddings_source" ON "ai_embeddings" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_ai_ingestion_runs_source" ON "ai_knowledge_ingestion_runs" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_ai_ingestion_runs_entity" ON "ai_knowledge_ingestion_runs" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_ai_knowledge_entity_app" ON "ai_knowledge_sources" USING btree ("entity_id","app_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_prompt_version" ON "ai_prompt_versions" USING btree ("prompt_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_prompt_key" ON "ai_prompts" USING btree ("app_key","prompt_key");--> statement-breakpoint
CREATE INDEX "idx_ai_requests_entity_app" ON "ai_requests" USING btree ("entity_id","app_key");--> statement-breakpoint
CREATE INDEX "idx_ai_requests_occurred" ON "ai_requests" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_budget" ON "ai_usage_budgets" USING btree ("entity_id","app_key","profile_key","month");